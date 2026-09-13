package com.axcore.workspace.inventory;

import com.axcore.workspace.inventory.dto.ItemDto;
import com.axcore.workspace.inventory.dto.VendorDto;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.SettingsConflictException;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 품목 마스터와 거래처 — 설정 화면의 두 탭.
 *
 * <p>품목의 거래처 목록은 순서가 뜻이다({@code [0]} 이 기본 거래처). 그래서 저장할 때마다 지우고 다시 넣는다 —
 * 부분 갱신으로는 순서를 옮긴 것과 지운 것을 구분할 수 없다.
 */
@Service
public class InventoryCatalogService {

    private static final Logger log = LoggerFactory.getLogger(InventoryCatalogService.class);
    static final String TAB_ITEMS = "items";
    static final String TAB_VENDORS = "vendors";
    static final String ITEM_IN_USE = "ITEM_IN_USE";

    private final InventoryAccess access;
    private final InventoryWriteSupport support;
    private final JdbcTemplate jdbc;

    public InventoryCatalogService(InventoryAccess access, InventoryWriteSupport support, JdbcTemplate jdbc) {
        this.access = access;
        this.support = support;
        this.jdbc = jdbc;
    }

    // ---------------------------------------------------------------- 품목

    @Transactional
    public void upsertItem(JwtPrincipal principal, String code, ItemDto item) {
        TenantContext ctx = access.open(principal, TAB_ITEMS);
        if (!code.equals(item.code())) {
            // 코드를 바꾸는 것은 다른 품목이 되는 일이다. 발주 · 이력이 옛 코드를 가리키므로 막는다.
            throw new SettingsValidationException("품목 코드는 바꿀 수 없습니다");
        }
        writeItem(item);
        log.info("워크스페이스 {} 의 품목 {} 를 사용자 {} 가 저장했다", ctx.workspaceId(), code, ctx.userId());
    }

    @Transactional
    public void setDiscontinued(JwtPrincipal principal, String code, boolean discontinued) {
        access.open(principal, TAB_ITEMS);
        support.requireItem(code);
        jdbc.update("update inv_items set discontinued = ?, updated_at = now() where code = ?", discontinued, code);
    }

    /**
     * 품목을 지운다. 발주 라인 · 이력 · 기준이 하나라도 가리키면 막는다 — 화면도 그때만 버튼을 그리지만, 두 사람이
     * 동시에 쓰면 화면이 본 뒤에 생길 수 있다.
     */
    @Transactional
    public void deleteItem(JwtPrincipal principal, String code) {
        TenantContext ctx = access.open(principal, TAB_ITEMS);
        support.requireItem(code);
        Integer used =
                jdbc.queryForObject(
                        """
                        select (select count(*) from inv_po_lines where item_code = ?)
                             + (select count(*) from inv_movements where item_code = ?)
                        """,
                        Integer.class,
                        code,
                        code);
        if (used != null && used > 0) {
            throw new SettingsConflictException(ITEM_IN_USE, "발주나 이력이 있는 품목은 지울 수 없습니다");
        }
        // 기준(inv_item_standards) · 거래처 연결은 FK 의 ON DELETE CASCADE 로 함께 사라진다.
        jdbc.update("delete from inv_items where code = ?", code);
        log.info("워크스페이스 {} 의 품목 {} 를 사용자 {} 가 지웠다", ctx.workspaceId(), code, ctx.userId());
    }

    /** 엑셀 업로드 — 갱신과 신규를 한 번에. 한 행이라도 막히면 전부 되돌린다. */
    @Transactional
    public void importItems(JwtPrincipal principal, List<ItemDto> items) {
        TenantContext ctx = access.open(principal, TAB_ITEMS);
        for (ItemDto item : items) {
            writeItem(item);
        }
        log.info("워크스페이스 {} 에 품목 {}건을 사용자 {} 가 올렸다", ctx.workspaceId(), items.size(), ctx.userId());
    }

    private void writeItem(ItemDto item) {
        jdbc.update(
                """
                insert into inv_items (code, name, spec, size_text, unit, category, location, discontinued)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                on conflict (code) do update set
                    name = excluded.name, spec = excluded.spec, size_text = excluded.size_text, unit = excluded.unit,
                    category = excluded.category, location = excluded.location, discontinued = excluded.discontinued,
                    updated_at = now()
                """,
                item.code(),
                item.name().trim(),
                text(item.spec()),
                text(item.size()),
                item.unit().trim(),
                text(item.category()),
                text(item.location()),
                item.discontinued());

        // 순서가 뜻이라 통째로 다시 쓴다.
        jdbc.update("delete from inv_item_vendors where item_code = ?", item.code());
        int sort = 0;
        for (String vendorId : item.vendorIds()) {
            support.requireVendor(vendorId);
            jdbc.update(
                    "insert into inv_item_vendors (item_code, vendor_id, sort) values (?, ?, ?) on conflict do nothing",
                    item.code(),
                    vendorId,
                    sort++);
        }
    }

    // ---------------------------------------------------------------- 거래처

    @Transactional
    public void upsertVendor(JwtPrincipal principal, String id, VendorDto vendor) {
        TenantContext ctx = access.open(principal, TAB_VENDORS);
        if (!id.equals(vendor.id())) {
            throw new SettingsValidationException("거래처 아이디는 바꿀 수 없습니다");
        }
        boolean wasActive =
                Boolean.TRUE.equals(
                        jdbc.query(
                                        "select active from inv_vendors where id = ?",
                                        (rs, i) -> rs.getBoolean(1),
                                        id)
                                .stream()
                                .findFirst()
                                .orElse(null));
        write(vendor);
        if (wasActive && !vendor.active()) {
            demoteFromDefault(id);
        }
        log.info("워크스페이스 {} 의 거래처 {} 를 사용자 {} 가 저장했다", ctx.workspaceId(), id, ctx.userId());
    }

    /**
     * 품목 수정 팝업의 「만들기」. 이름만 받고 나머지는 기본값이다 — 리드타임이 비어 있어 기한 넘김을 판단하지
     * 않는다(거래처 탭에서 채우라는 뜻).
     *
     * <p>권한은 {@code vendors} 가 아니라 {@code items} 로 본다. 이 경로는 품목 팝업에서만 열리고, 품목을 고치는
     * 사람에게 거래처 탭 권한까지 요구하면 팝업의 「만들기」가 늘 막힌다.
     */
    @Transactional
    public void createVendorInline(JwtPrincipal principal, String name) {
        TenantContext ctx = access.open(principal, TAB_ITEMS);
        String trimmed = name.trim();
        String id = uniqueVendorId(trimmed);
        write(new VendorDto(id, trimmed, "parts", "", null, "", true));
        log.info("워크스페이스 {} 에 거래처 {}({}) 를 사용자 {} 가 만들었다", ctx.workspaceId(), id, trimmed, ctx.userId());
    }

    private void write(VendorDto v) {
        jdbc.update(
                """
                insert into inv_vendors (id, name, kind, initial, lead_time_days, owner_name, active)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict (id) do update set
                    name = excluded.name, kind = excluded.kind, initial = excluded.initial,
                    lead_time_days = excluded.lead_time_days, owner_name = excluded.owner_name,
                    active = excluded.active, updated_at = now()
                """,
                v.id(), v.name().trim(), v.kind(), text(v.initial()), v.leadTimeDays(), text(v.owner()), v.active());
    }

    /**
     * 거래 중지한 거래처를 기본 자리에서 내린다. 이 거래처를 첫 번째로 쓰던 품목은 다음 거래처가 기본이 된다
     * (거래처가 하나뿐이면 그대로 남는다 — 화면 리듀서와 같은 규칙).
     */
    private void demoteFromDefault(String vendorId) {
        List<String> items =
                jdbc.query(
                        """
                        select iv.item_code from inv_item_vendors iv
                         where iv.vendor_id = ?
                           and iv.sort = (select min(sort) from inv_item_vendors where item_code = iv.item_code)
                           and (select count(*) from inv_item_vendors where item_code = iv.item_code) > 1
                        """,
                        (rs, i) -> rs.getString(1),
                        vendorId);
        for (String code : items) {
            // 맨 뒤로 보낸다. 나머지의 상대 순서는 그대로다.
            jdbc.update(
                    """
                    update inv_item_vendors set sort = (select max(sort) + 1 from inv_item_vendors where item_code = ?)
                     where item_code = ? and vendor_id = ?
                    """,
                    code, code, vendorId);
        }
    }

    /**
     * {@code v-<이름의 영문 slug>}. 한글 이름처럼 영문이 없으면 {@code v-1} 부터 센다. 겹치면 뒤에 번호를 붙인다.
     */
    private String uniqueVendorId(String name) {
        String slug = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        String base = slug.isEmpty() ? "v" : "v-" + slug;
        for (int n = 1; ; n++) {
            String id = n == 1 && !slug.isEmpty() ? base : base + "-" + n;
            Integer hit = jdbc.queryForObject("select count(*) from inv_vendors where id = ?", Integer.class, id);
            if (hit != null && hit == 0) {
                return id;
            }
        }
    }

    private static String text(String v) {
        return v == null ? "" : v.trim();
    }
}
