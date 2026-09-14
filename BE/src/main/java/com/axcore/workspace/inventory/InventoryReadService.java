package com.axcore.workspace.inventory;

import com.axcore.workspace.inventory.dto.DocRulesDto;
import com.axcore.workspace.inventory.dto.ItemDto;
import com.axcore.workspace.inventory.dto.ItemStandardDto;
import com.axcore.workspace.inventory.dto.MovementDto;
import com.axcore.workspace.inventory.dto.PurchaseOrderDto;
import com.axcore.workspace.inventory.dto.SafetyStandardDto;
import com.axcore.workspace.inventory.dto.SettingsResponse;
import com.axcore.workspace.inventory.dto.VendorDto;
import com.axcore.workspace.security.JwtPrincipal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
// Spring Boot 4 는 Jackson 3 이다 — 패키지가 com.fasterxml 이 아니라 tools.jackson 이다.
import tools.jackson.databind.ObjectMapper;

/**
 * 재고·물류 읽기 — 화면이 마운트할 때 부르는 다섯 GET.
 *
 * <p>재고 수량은 여기서 계산하지 않는다. {@code 기초 + Σ 이력} 은 화면({@code lib/inventory-state.ts}
 * {@code stockOf})이 하고, 서버는 기초 · 이력 · 기준을 그대로 준다. 같은 계산을 두 곳에 두면 화면 숫자와 서버
 * 숫자가 갈라지는 날이 온다 — 어느 쪽이 맞는지 아무도 모르게 된다.
 */
@Service
public class InventoryReadService {

    /** 화면이 쓰는 분 단위 ISO 문자열. 타임존을 붙이지 않는다. */
    private static final String AT = "to_char(moved_at, 'YYYY-MM-DD\"T\"HH24:MI')";

    private final InventoryAccess access;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public InventoryReadService(InventoryAccess access, JdbcTemplate jdbc, ObjectMapper mapper) {
        this.access = access;
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<VendorDto> vendors(JwtPrincipal principal) {
        access.openRead(principal);
        return readVendors();
    }

    @Transactional(readOnly = true)
    public List<ItemDto> items(JwtPrincipal principal) {
        access.openRead(principal);
        return readItems();
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrderDto> orders(JwtPrincipal principal) {
        access.openRead(principal);
        return readOrders();
    }

    @Transactional(readOnly = true)
    public List<MovementDto> movements(JwtPrincipal principal) {
        access.openRead(principal);
        return readMovements();
    }

    @Transactional(readOnly = true)
    public SettingsResponse settings(JwtPrincipal principal) {
        access.openRead(principal);
        return readSettings();
    }

    // ---------------------------------------------------------------- 읽기 (권한은 위에서 이미 봤다)

    List<VendorDto> readVendors() {
        return jdbc.query(
                """
                select id, name, kind, initial, lead_time_days, owner_name, active
                  from inv_vendors
                 order by active desc, name
                """,
                (rs, i) ->
                        new VendorDto(
                                rs.getString(1),
                                rs.getString(2),
                                rs.getString(3),
                                rs.getString(4),
                                rs.getObject(5, Integer.class),
                                rs.getString(6),
                                rs.getBoolean(7)));
    }

    List<ItemDto> readItems() {
        Map<String, List<String>> vendorIds = new LinkedHashMap<>();
        jdbc.query(
                "select item_code, vendor_id from inv_item_vendors order by item_code, sort, vendor_id",
                rs -> {
                    vendorIds.computeIfAbsent(rs.getString(1), k -> new ArrayList<>()).add(rs.getString(2));
                });
        return jdbc.query(
                """
                select code, name, spec, size_text, unit, category, location, discontinued
                  from inv_items
                 order by code
                """,
                (rs, i) ->
                        new ItemDto(
                                rs.getString(1),
                                rs.getString(2),
                                rs.getString(3),
                                rs.getString(4),
                                rs.getString(5),
                                rs.getString(6),
                                vendorIds.getOrDefault(rs.getString(1), List.of()),
                                rs.getString(7),
                                rs.getBoolean(8)));
    }

    List<PurchaseOrderDto> readOrders() {
        Map<String, List<PurchaseOrderDto.Line>> lines = new LinkedHashMap<>();
        jdbc.query(
                """
                select po_no, line_no, item_code, name_at_order, spec_at_order, size_at_order, ordered, received, judgement, note
                  from inv_po_lines
                 order by po_no, sort, id
                """,
                rs -> {
                    lines.computeIfAbsent(rs.getString(1), k -> new ArrayList<>())
                            .add(
                                    new PurchaseOrderDto.Line(
                                            rs.getString(2),
                                            rs.getString(3),
                                            rs.getString(4),
                                            rs.getString(5),
                                            rs.getString(6),
                                            rs.getInt(7),
                                            rs.getInt(8),
                                            rs.getString(9),
                                            rs.getString(10)));
                });
        return jdbc.query(
                """
                select po_no, ordered_on, vendor_id, project_code, drawing, rev, requester, closed_on
                  from inv_purchase_orders
                 order by ordered_on desc, po_no desc
                """,
                (rs, i) ->
                        new PurchaseOrderDto(
                                rs.getString(1),
                                rs.getObject(2, LocalDate.class),
                                rs.getString(3),
                                rs.getString(4),
                                rs.getString(5),
                                rs.getString(6),
                                rs.getString(7),
                                lines.getOrDefault(rs.getString(1), List.of()),
                                rs.getObject(8, LocalDate.class)));
    }

    List<MovementDto> readMovements() {
        return jdbc.query(
                """
                select id, %s, item_code, kind, qty, actor, ref, note, po_no, judgement
                  from inv_movements
                 order by moved_at desc, id desc
                """
                        .formatted(AT),
                (rs, i) ->
                        new MovementDto(
                                rs.getString(1),
                                rs.getString(2),
                                rs.getString(3),
                                rs.getString(4),
                                rs.getInt(5),
                                rs.getString(6),
                                rs.getString(7),
                                rs.getString(8),
                                rs.getString(9),
                                rs.getString(10)));
    }

    SettingsResponse readSettings() {
        // as_of 가 null 이면 빈 문자열 — 화면은 그것을 「처음부터」로 읽는다(ItemStandardDto 참고).
        List<ItemStandardDto> standards =
                jdbc.query(
                        """
                        select item_code, baseline, coalesce(to_char(as_of, 'YYYY-MM-DD'), ''), safety
                          from inv_item_standards
                         order by item_code
                        """,
                        (rs, i) ->
                                new ItemStandardDto(
                                        rs.getString(1), rs.getInt(2), rs.getString(3), rs.getObject(4, Integer.class)));

        // 행이 없는 회사(아직 아무것도 저장하지 않음)는 기본값을 받는다. 없으면 화면이 빈 규칙으로 발주서를 그린다.
        List<SettingsResponse> one =
                jdbc.query(
                        "select safety_method, avg_window_days, doc_rules::text from inv_settings where id",
                        (rs, i) ->
                                new SettingsResponse(
                                        standards, new SafetyStandardDto(rs.getString(1), rs.getInt(2)), parseRules(rs.getString(3))));
        return one.isEmpty()
                ? new SettingsResponse(standards, new SafetyStandardDto("manual", 30), DocRulesDto.defaults())
                : one.get(0);
    }

    /** jsonb → DTO. 저장할 때 DTO 를 직렬화한 것이라 형태가 깨질 일은 없지만, 손으로 고친 행도 있을 수 있다. */
    private DocRulesDto parseRules(String json) {
        try {
            return mapper.readValue(json, DocRulesDto.class);
        } catch (Exception e) {
            return DocRulesDto.defaults();
        }
    }
}
