package com.axcore.workspace.design;

import static com.axcore.workspace.design.DesignCodes.FIRST_REV;
import static com.axcore.workspace.design.DesignCodes.MODULE;
import static com.axcore.workspace.design.DesignCodes.STATUS_APPROVED;
import static com.axcore.workspace.design.DesignCodes.STATUS_DISCARDED;
import static com.axcore.workspace.design.DesignCodes.STATUS_REVIEW;
import static com.axcore.workspace.design.DesignCodes.TAB_BOM;
import static com.axcore.workspace.design.DesignCodes.TAB_DRAWINGS;

import com.axcore.workspace.design.dto.BomLineRequest;
import com.axcore.workspace.design.dto.DrawingCreateRequest;
import com.axcore.workspace.design.dto.RevisionRequest;
import com.axcore.workspace.inventory.InventoryWriteSupport;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.ModuleTabAccess;
import com.axcore.workspace.workspace.settings.SettingsConflictException;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 제품설계 쓰기 — 도면 등록 · 리비전 · 파생 · 이름 · 폐기 · 개정 확인(도면 관리 탭), BOM 매핑(BOM 관리 탭).
 *
 * <p>화면 리듀서({@code FE/lib/design-state.ts})와 같은 규칙이다. <b>리비전 하나가 도면 하나</b>(키 (code, rev))다.
 *
 * <ul>
 *   <li>첫 리비전은 언제나 Rev.A. 「새 리비전」은 같은 code 의 지금 리비전(max rev)에서 다음 글자로 행을 하나 더 넣는다 —
 *       앞 리비전과 그 BOM 은 그대로 남는다. 이름 · 차종 · 관리번호 · 근거 도면은 앞 리비전에서 이어 받는다.
 *   <li>원본이 개정되면 그 원본을 근거로 한 파생 도면의 지금 리비전은 「확인 필요」가 된다. 파생이 확인하면 근거 리비전이
 *       원본의 지금 리비전으로 올라간다. 옛 리비전은 건드리지 않는다 — 그때의 근거는 그때의 것이다.
 *   <li>이름 · 폐기는 도면번호 전체(모든 리비전)에 적용한다.
 *   <li>BOM 줄은 넣을 때 품목 마스터에서 <b>호칭+규격 → 품명</b> 순으로 찾아 자동 매핑한다(FE {@code autoMap} 과
 *       같은 순서). 못 찾으면 미매핑으로 남고 BOM 관리에서 사람이 맺는다.
 * </ul>
 */
@Service
public class DesignWriteService {

    private static final Logger log = LoggerFactory.getLogger(DesignWriteService.class);
    static final String DRAWING_EXISTS = "DRAWING_EXISTS";
    static final String DRAWING_DISCARDED = "DRAWING_DISCARDED";

    private final ModuleTabAccess access;
    private final InventoryWriteSupport inventory;
    private final JdbcTemplate jdbc;

    public DesignWriteService(ModuleTabAccess access, InventoryWriteSupport inventory, JdbcTemplate jdbc) {
        this.access = access;
        this.inventory = inventory;
        this.jdbc = jdbc;
    }

    private record Row(String code, String rev, String status, String parent, String parentRev) {}

    private static final String ROW_SELECT = "select code, rev, status, parent_code, parent_rev from dsg_drawings";

    // ---------------------------------------------------------------- 도면 관리

    @Transactional
    public void create(JwtPrincipal principal, DrawingCreateRequest req) {
        TenantContext ctx = access.open(principal, MODULE, TAB_DRAWINGS);
        String code = req.code().trim();
        if (latest(code) != null) {
            throw new SettingsConflictException(DRAWING_EXISTS, "이미 있는 도면번호입니다: " + code);
        }
        String parentCode = text(req.parent());
        String parentRev = text(req.parentRev());
        Row parent = null;
        if (!parentCode.isEmpty()) {
            parent = parentRev.isEmpty() ? latest(parentCode) : find(parentCode, parentRev);
            if (parent == null) {
                throw new SettingsNotFoundException("근거 도면을 찾을 수 없습니다: " + parentCode + " " + parentRev);
            }
            if (STATUS_DISCARDED.equals(parent.status())) {
                throw new SettingsConflictException(DRAWING_DISCARDED, "폐기된 도면 아래에는 파생 도면을 만들 수 없습니다");
            }
        } else if (!parentRev.isEmpty()) {
            throw new SettingsValidationException("근거 리비전은 근거 도면과 함께 적습니다");
        }

        jdbc.update(
                """
                insert into dsg_drawings
                       (code, rev, name, parent_code, parent_rev, vehicle, project_code, has_excel, author, status,
                        change_note, requester, revised_on, created_by)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                code,
                FIRST_REV,
                req.name().trim(),
                parent == null ? null : parent.code(),
                parent == null ? null : parent.rev(),
                parent == null ? text(req.vehicle()) : "",
                parent == null ? text(req.projectCode()) : "",
                req.excel(),
                inventory.actorName(ctx),
                STATUS_APPROVED,
                text(req.change()).isEmpty() ? "최초 등록" : req.change().trim(),
                text(req.requester()),
                LocalDate.now(),
                ctx.userId());
        writeBom(code, FIRST_REV, req.lines());
        log.info("워크스페이스 {} 에 도면 {} {} 를 사용자 {} 가 등록했다 (근거 {})", ctx.workspaceId(), code, FIRST_REV, ctx.userId(), parent == null ? "없음" : parent.code() + " " + parent.rev());
    }

    /** 지금 리비전에서 다음 리비전 도면을 딴다 — 새 행. 앞 리비전은 그대로 남는다. */
    @Transactional
    public void revise(JwtPrincipal principal, String code, RevisionRequest req) {
        TenantContext ctx = access.open(principal, MODULE, TAB_DRAWINGS);
        Row cur = requireLatest(code);
        if (STATUS_DISCARDED.equals(cur.status())) {
            throw new SettingsConflictException(DRAWING_DISCARDED, "폐기된 도면은 개정할 수 없습니다");
        }
        String next = DesignCodes.nextRev(cur.rev());
        LocalDate today = LocalDate.now();
        jdbc.update(
                """
                insert into dsg_drawings
                       (code, rev, name, parent_code, parent_rev, vehicle, project_code, has_excel, author, status,
                        change_note, requester, revised_on, created_by)
                select code, ?, name, parent_code, parent_rev, vehicle, project_code, has_excel or ?, ?, ?, ?, ?, ?, ?
                  from dsg_drawings
                 where code = ? and rev = ?
                """,
                next,
                req.excel(),
                inventory.actorName(ctx),
                STATUS_APPROVED,
                text(req.change()).isEmpty() ? "변경 내용 미기재" : req.change().trim(),
                text(req.requester()),
                today,
                ctx.userId(),
                code,
                cur.rev());
        writeBom(code, next, req.lines());
        // 원본이 바뀌었다 — 이 원본을 근거로 삼은 파생 도면(지금 리비전)은 다시 봐야 한다
        int flagged =
                jdbc.update(
                        """
                        update dsg_drawings d
                           set status = ?, updated_at = now()
                         where d.parent_code = ? and d.status <> ?
                           and d.rev = (select max(x.rev) from dsg_drawings x where x.code = d.code)
                        """,
                        STATUS_REVIEW, code, STATUS_DISCARDED);
        log.info("워크스페이스 {} 의 도면 {} 를 {} 로 개정했다 (사용자 {}, 확인 필요 파생 {}건)", ctx.workspaceId(), code, next, ctx.userId(), flagged);
    }

    /** 도면번호의 모든 리비전. */
    @Transactional
    public void rename(JwtPrincipal principal, String code, String name) {
        access.open(principal, MODULE, TAB_DRAWINGS);
        requireLatest(code);
        jdbc.update("update dsg_drawings set name = ?, updated_at = now() where code = ?", name.trim(), code);
    }

    /** 도면번호의 모든 리비전. */
    @Transactional
    public void discard(JwtPrincipal principal, String code) {
        TenantContext ctx = access.open(principal, MODULE, TAB_DRAWINGS);
        requireLatest(code);
        jdbc.update("update dsg_drawings set status = ?, updated_at = now() where code = ?", STATUS_DISCARDED, code);
        log.info("워크스페이스 {} 의 도면 {} 를 사용자 {} 가 폐기했다", ctx.workspaceId(), code, ctx.userId());
    }

    /** 파생 도면의 지금 리비전이 상위의 개정을 확인했다 — 근거 리비전을 상위의 지금 것으로 올리고 승인으로 돌아간다. */
    @Transactional
    public void acknowledge(JwtPrincipal principal, String code) {
        access.open(principal, MODULE, TAB_DRAWINGS);
        Row d = requireLatest(code);
        if (d.parent() == null) {
            throw new SettingsValidationException("원본 도면은 확인할 개정이 없습니다");
        }
        Row parent = requireLatest(d.parent());
        jdbc.update(
                "update dsg_drawings set status = ?, parent_rev = ?, updated_at = now() where code = ? and rev = ?",
                STATUS_APPROVED, parent.rev(), d.code(), d.rev());
    }

    // ---------------------------------------------------------------- BOM 관리

    /** BOM 한 줄을 품목에 맺는다. {@code itemCode} 가 비면 푼다. 줄 id 는 전역 유일이라 리비전은 받지 않는다. */
    @Transactional
    public void mapBomLine(JwtPrincipal principal, String code, long lineId, String itemCode) {
        TenantContext ctx = access.open(principal, MODULE, TAB_BOM);
        String item = text(itemCode);
        if (!item.isEmpty()) {
            inventory.requireItem(item);
        }
        int n =
                jdbc.update(
                        "update dsg_bom_lines set item_code = ? where id = ? and drawing_code = ?",
                        item.isEmpty() ? null : item, lineId, code);
        if (n == 0) {
            throw new SettingsNotFoundException("도면에 없는 BOM 줄입니다");
        }
        log.info("워크스페이스 {} 의 도면 {} BOM {} 을 사용자 {} 가 {} 에 매핑했다", ctx.workspaceId(), code, lineId, ctx.userId(), item.isEmpty() ? "(해제)" : item);
    }

    // ---------------------------------------------------------------- 공통

    private void writeBom(String code, String rev, List<BomLineRequest> lines) {
        int sort = 0;
        for (BomLineRequest l : lines) {
            jdbc.update(
                    "insert into dsg_bom_lines (drawing_code, drawing_rev, item_name, spec, size_text, qty, item_code, sort) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    code, rev, l.item().trim(), text(l.spec()), text(l.size()), l.qty(), resolveItem(l), sort++);
        }
    }

    /** 화면이 준 매핑이 있으면 그것(있는 품목인지 확인), 없으면 품목 마스터에서 호칭+규격 → 품명 순으로 찾는다. */
    private String resolveItem(BomLineRequest l) {
        String given = text(l.itemCode());
        if (!given.isEmpty()) {
            inventory.requireItem(given);
            return given;
        }
        List<String> bySpec =
                jdbc.query(
                        "select code from inv_items where discontinued = false and spec = ? and size_text = ? order by code limit 1",
                        (rs, i) -> rs.getString(1), text(l.spec()), text(l.size()));
        if (!bySpec.isEmpty()) {
            return bySpec.get(0);
        }
        List<String> byName =
                jdbc.query(
                        "select code from inv_items where discontinued = false and name = ? order by code limit 1",
                        (rs, i) -> rs.getString(1), l.item().trim());
        return byName.isEmpty() ? null : byName.get(0);
    }

    private static Row row(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Row(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getString(5));
    }

    private Row find(String code, String rev) {
        List<Row> rows = jdbc.query(ROW_SELECT + " where code = ? and rev = ?", (rs, i) -> row(rs), code, rev);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 도면번호의 지금 리비전 — rev 가 가장 큰 행. 없으면 null. */
    private Row latest(String code) {
        List<Row> rows = jdbc.query(ROW_SELECT + " where code = ? order by rev desc limit 1", (rs, i) -> row(rs), code);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Row requireLatest(String code) {
        Row row = latest(code);
        if (row == null) {
            throw new SettingsNotFoundException("도면을 찾을 수 없습니다: " + code);
        }
        return row;
    }

    private static String text(String v) {
        return v == null ? "" : v.trim();
    }
}
