package com.axcore.workspace.inventory;

import com.axcore.workspace.inventory.dto.CreateOrdersRequest;
import com.axcore.workspace.inventory.dto.PurchaseOrderDto;
import com.axcore.workspace.inventory.dto.ReceiptRequest;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.SettingsConflictException;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 발주와 입고. 발주를 만드는 사람({@code purchasing})과 입고를 등록하는 사람({@code receiving})은 다른 부서라
 * 탭 권한을 따로 본다.
 *
 * <p>입고는 <b>증분</b>이다. 화면이 계산한 누계가 아니라 이번에 받은 몫만 받아 서버가 더한다 — 두 사람이 같은
 * 발주를 등록해도 한 번의 입고가 사라지지 않는다.
 */
@Service
public class InventoryOrderService {

    private static final Logger log = LoggerFactory.getLogger(InventoryOrderService.class);
    static final String TAB_PURCHASING = "purchasing";
    static final String TAB_RECEIVING = "receiving";
    static final String ORDER_CLOSED = "ORDER_CLOSED";

    private final InventoryAccess access;
    private final InventoryWriteSupport support;
    private final JdbcTemplate jdbc;

    public InventoryOrderService(InventoryAccess access, InventoryWriteSupport support, JdbcTemplate jdbc) {
        this.access = access;
        this.support = support;
        this.jdbc = jdbc;
    }

    /** 그 달 발주번호의 앞부분 — {@code PO-YYMM-}. */
    static String noPrefix(LocalDate date) {
        return String.format("PO-%02d%02d-", date.getYear() % 100, date.getMonthValue());
    }

    /** 같은 달 최댓값({@code maxNo}, 없으면 빈 문자열) 다음 번호. */
    static String nextNo(String prefix, String maxNo) {
        int max = maxNo.startsWith(prefix) ? Integer.parseInt(maxNo.substring(prefix.length())) : 0;
        return prefix + String.format("%04d", max + 1);
    }

    /**
     * 발주서 위저드가 나눈 발주들을 한 트랜잭션으로 만든다. 요청의 {@code poNo} 는 버린다 — 화면의 미리보기 번호는
     * 같은 규칙으로 계산한 추정값이고, 실제 번호는 여기서 정한다.
     */
    @Transactional
    public void create(JwtPrincipal principal, CreateOrdersRequest request) {
        TenantContext ctx = access.open(principal, TAB_PURCHASING);
        for (PurchaseOrderDto order : request.orders()) {
            String no = assignNo(order.orderedOn());
            support.requireVendor(order.vendorId());
            jdbc.update(
                    """
                    insert into inv_purchase_orders
                           (po_no, ordered_on, vendor_id, project_code, drawing, rev, requester, created_by)
                    values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    no,
                    order.orderedOn(),
                    order.vendorId(),
                    text(order.projectCode()),
                    text(order.drawing()),
                    text(order.rev()),
                    order.requester() == null || order.requester().isBlank() ? support.actorName(ctx) : order.requester(),
                    ctx.userId());

            int sort = 0;
            for (PurchaseOrderDto.Line line : order.lines()) {
                support.requireItem(line.itemCode());
                jdbc.update(
                        """
                        insert into inv_po_lines
                               (po_no, line_no, item_code, name_at_order, spec_at_order, size_at_order, ordered, received, note, sort)
                        values (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                        """,
                        no,
                        line.no(),
                        line.itemCode(),
                        text(line.nameAtOrder()),
                        text(line.specAtOrder()),
                        text(line.sizeAtOrder()),
                        line.ordered(),
                        text(line.note()),
                        sort++);
            }
            log.info("워크스페이스 {} 에 발주 {} 를 사용자 {} 가 만들었다", ctx.workspaceId(), no, ctx.userId());
        }
    }

    /**
     * 입고 등록. 화면의 리듀서({@code lib/inventory-state.ts} {@code case "receive"})와 같은 규칙이다.
     *
     * <ul>
     *   <li>받은 수량이 0 이하인 줄은 건너뛴다 — 판정도 남기지 않는다.
     *   <li>초과 입고를 막지 않는다. 잔량은 0 이 되고 초과분은 이력 메모에 남는다.
     *   <li>불합격은 누계에 세지 않는다 — 잔량이 남아 다시 받을 수 있다.
     * </ul>
     */
    @Transactional
    public void receive(JwtPrincipal principal, String poNo, ReceiptRequest request) {
        TenantContext ctx = access.open(principal, TAB_RECEIVING);

        List<String> project =
                jdbc.query(
                        "select project_code from inv_purchase_orders where po_no = ? and closed_on is null",
                        (rs, i) -> rs.getString(1),
                        poNo);
        if (project.isEmpty()) {
            if (jdbc.queryForObject("select count(*) from inv_purchase_orders where po_no = ?", Integer.class, poNo) > 0) {
                throw new SettingsConflictException(ORDER_CLOSED, "이미 마감된 발주입니다");
            }
            throw new SettingsNotFoundException("발주를 찾을 수 없습니다");
        }
        String ref = project.get(0);
        String actor = support.actorName(ctx);
        LocalDateTime at = LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES);

        for (ReceiptRequest.Line in : request.lines()) {
            if (in.received() <= 0) {
                continue;
            }
            record Row(long id, String itemCode, int ordered, int received) {}
            List<Row> rows =
                    jdbc.query(
                            "select id, item_code, ordered, received from inv_po_lines where po_no = ? and line_no = ?",
                            (rs, i) -> new Row(rs.getLong(1), rs.getString(2), rs.getInt(3), rs.getInt(4)),
                            poNo,
                            in.no());
            if (rows.isEmpty()) {
                throw new SettingsNotFoundException("발주에 없는 줄입니다: " + in.no());
            }
            Row row = rows.get(0);
            boolean pass = "pass".equals(in.judgement());
            int remaining = Math.max(0, row.ordered() - row.received());
            int over = pass ? Math.max(0, in.received() - remaining) : 0;
            String note = text(in.note());
            String movementNote = over > 0 ? (note.isEmpty() ? "초과 +" + over : note + " · 초과 +" + over) : note;

            jdbc.update(
                    "update inv_po_lines set received = received + ?, judgement = ?, note = ? where id = ?",
                    pass ? in.received() : 0,
                    in.judgement(),
                    note,
                    row.id());
            support.insertMovement(
                    at, row.itemCode(), "in", in.received(), actor, ref, movementNote, poNo, in.judgement());
        }

        if (request.complete()) {
            jdbc.update(
                    "update inv_purchase_orders set closed_on = ?, updated_at = now() where po_no = ?",
                    at.toLocalDate(),
                    poNo);
        }
        log.info("워크스페이스 {} 의 발주 {} 에 사용자 {} 가 입고를 등록했다 (마감 {})",
                ctx.workspaceId(), poNo, ctx.userId(), request.complete());
    }

    /** 같은 달 안에서 다음 번호. 같은 트랜잭션에서 여러 건을 만들 때도 방금 넣은 행이 보여 겹치지 않는다. */
    private String assignNo(LocalDate orderedOn) {
        if (orderedOn.isAfter(LocalDate.now().plusYears(1))) {
            throw new SettingsValidationException("발주일이 너무 멉니다");
        }
        String prefix = noPrefix(orderedOn);
        String max =
                jdbc.queryForObject(
                        """
                        select coalesce(max(po_no), '') from inv_purchase_orders
                         where po_no like ? and po_no ~ '^PO-[0-9]{4}-[0-9]{4}$'
                        """,
                        String.class,
                        prefix + "%");
        return nextNo(prefix, max);
    }

    private static String text(String v) {
        return v == null ? "" : v.trim();
    }
}
