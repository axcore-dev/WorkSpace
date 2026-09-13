package com.axcore.workspace.inventory;

import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.time.LocalDateTime;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 쓰기 서비스들이 함께 쓰는 조각. 이력 한 줄을 남기는 방법과 참조 검사를 한 곳에 둔다 — 세 서비스가 각자
 * {@code insert into inv_movements} 를 쓰면 id 규칙이 서로 달라지는 날이 온다.
 *
 * <p>권한은 여기서 보지 않는다. 부르는 쪽이 {@link InventoryAccess} 로 이미 열었다는 전제다.
 */
@Component
public class InventoryWriteSupport {

    private final JdbcTemplate jdbc;

    public InventoryWriteSupport(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 이력에 남길 사람 이름. 이름 스냅샷이라 나중에 계정이 지워져도 이력은 그대로다(전표의 {@code owner_name} 과
     * 같은 이유).
     */
    public String actorName(TenantContext ctx) {
        String name = jdbc.queryForObject("select name from shared.users where id = ?", String.class, ctx.userId());
        return name == null ? "" : name;
    }

    /**
     * 이력 한 줄. id 는 {@code mv-000001} — 시드가 넣는 고정 id({@code m-0101})와 접두어가 달라 섞이지 않는다.
     *
     * @param judgement 입고가 아닌 이력은 null
     */
    public void insertMovement(
            LocalDateTime at,
            String itemCode,
            String kind,
            int qty,
            String actor,
            String ref,
            String note,
            String poNo,
            String judgement) {
        String id = String.format("mv-%06d", jdbc.queryForObject("select nextval('inv_movement_seq')", Long.class));
        jdbc.update(
                """
                insert into inv_movements (id, moved_at, item_code, kind, qty, actor, ref, note, po_no, judgement)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, at, itemCode, kind, qty, actor, ref == null ? "" : ref, note == null ? "" : note, poNo, judgement);
    }

    public void requireItem(String code) {
        if (jdbc.queryForObject("select count(*) from inv_items where code = ?", Integer.class, code) == 0) {
            throw new SettingsNotFoundException("품목을 찾을 수 없습니다: " + code);
        }
    }

    public void requireVendor(String id) {
        if (jdbc.queryForObject("select count(*) from inv_vendors where id = ?", Integer.class, id) == 0) {
            throw new SettingsNotFoundException("거래처를 찾을 수 없습니다: " + id);
        }
    }
}
