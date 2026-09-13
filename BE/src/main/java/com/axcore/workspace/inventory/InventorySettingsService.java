package com.axcore.workspace.inventory;

import com.axcore.workspace.inventory.dto.AdjustRequest;
import com.axcore.workspace.inventory.dto.DocRulesDto;
import com.axcore.workspace.inventory.dto.ItemStandardDto;
import com.axcore.workspace.inventory.dto.SafetyStandardDto;
import com.axcore.workspace.security.JwtPrincipal;
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
// Spring Boot 4 는 Jackson 3 이다 — 패키지가 com.fasterxml 이 아니라 tools.jackson 이다.
import tools.jackson.databind.ObjectMapper;

/**
 * 재고 조정 · 기초 재고 · 안전 기준 · 문서 규칙. 화면 리듀서({@code FE/lib/inventory-state.ts})와 같은 규칙을
 * 서버에서도 지킨다 — 폴백으로 본 화면과 서버에 붙은 화면이 달라지면 안 된다.
 */
@Service
public class InventorySettingsService {

    private static final Logger log = LoggerFactory.getLogger(InventorySettingsService.class);
    static final String TAB_STOCK = "stock";
    static final String TAB_SAFETY = "safety";
    static final String TAB_DOCRULES = "docrules";

    private final InventoryAccess access;
    private final InventoryWriteSupport support;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public InventorySettingsService(
            InventoryAccess access, InventoryWriteSupport support, JdbcTemplate jdbc, ObjectMapper mapper) {
        this.access = access;
        this.support = support;
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** 실사 차이 등. 이력 한 줄만 남는다 — 재고 수량 칸이 없으므로 고칠 것이 없다. */
    @Transactional
    public void adjust(JwtPrincipal principal, AdjustRequest request) {
        TenantContext ctx = access.open(principal, TAB_STOCK);
        if (request.qty() == 0) {
            throw new SettingsValidationException("조정 수량이 0 입니다");
        }
        support.requireItem(request.itemCode());
        // 사유를 ref 에 넣는다 — 이력 표의 「참조」 열이 조정에서는 사유 자리다(화면 리듀서와 같다).
        support.insertMovement(
                LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES),
                request.itemCode(),
                "adjust",
                request.qty(),
                support.actorName(ctx),
                request.note() == null ? "" : request.note().trim(),
                "",
                null,
                null);
    }

    /** 기초 재고 · 안전 재고를 정한다. 기초를 바꾼 사실도 이력에 남긴다({@code baseline} — 합산하지 않는 표시용 줄). */
    @Transactional
    public void setStandard(JwtPrincipal principal, String itemCode, ItemStandardDto request) {
        TenantContext ctx = access.open(principal, TAB_STOCK);
        support.requireItem(itemCode);
        LocalDate asOf = request.asOf() == null || request.asOf().isBlank() ? null : LocalDate.parse(request.asOf());
        upsertStandard(itemCode, request.baseline(), asOf, request.safety());
        support.insertMovement(
                LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES),
                itemCode,
                "baseline",
                request.baseline(),
                support.actorName(ctx),
                "기준일 " + (asOf == null ? "" : asOf),
                "",
                null,
                null);
    }

    /**
     * 안전 재고를 무엇으로 정할지 바꾼다.
     *
     * <p><b>자동 → 수동</b>으로 바꾸면 지금 보이던 자동값을 담당자 값으로 굳혀 둔다. 그러지 않으면 저장하는 순간
     * 모든 품목의 안전 기준이 한꺼번에 「미설정」이 되어 부족 수량이 전부 사라진다(화면 리듀서와 같은 처리).
     */
    @Transactional
    public void setSafetyStandard(JwtPrincipal principal, SafetyStandardDto next) {
        TenantContext ctx = access.open(principal, TAB_SAFETY);
        List<SafetyStandardDto> current =
                jdbc.query(
                        "select safety_method, avg_window_days from inv_settings where id",
                        (rs, i) -> new SafetyStandardDto(rs.getString(1), rs.getInt(2)));
        SafetyStandardDto before = current.isEmpty() ? new SafetyStandardDto("manual", 30) : current.get(0);

        if ("leadTimeAvg".equals(before.method()) && "manual".equals(next.method())) {
            freezeAutoSafety(before.avgWindowDays());
        }
        jdbc.update(
                """
                insert into inv_settings (id, safety_method, avg_window_days, doc_rules, updated_by, updated_at)
                values (true, ?, ?, ?::jsonb, ?, now())
                on conflict (id) do update set
                    safety_method = excluded.safety_method, avg_window_days = excluded.avg_window_days,
                    updated_by = excluded.updated_by, updated_at = now()
                """,
                next.method(), next.avgWindowDays(), json(DocRulesDto.defaults()), ctx.userId());
        log.info("워크스페이스 {} 의 안전 기준을 사용자 {} 가 {} 로 바꿨다", ctx.workspaceId(), ctx.userId(), next.method());
    }

    @Transactional
    public void setDocRules(JwtPrincipal principal, DocRulesDto rules) {
        TenantContext ctx = access.open(principal, TAB_DOCRULES);
        jdbc.update(
                """
                insert into inv_settings (id, safety_method, avg_window_days, doc_rules, updated_by, updated_at)
                values (true, 'manual', 30, ?::jsonb, ?, now())
                on conflict (id) do update set
                    doc_rules = excluded.doc_rules, updated_by = excluded.updated_by, updated_at = now()
                """,
                json(rules), ctx.userId());
        log.info("워크스페이스 {} 의 문서 규칙을 사용자 {} 가 바꿨다", ctx.workspaceId(), ctx.userId());
    }

    /**
     * 자동 안전 기준을 지금 값으로 굳힌다. {@code 기본 거래처 리드타임 × 최근 N일 일평균 출고}, 올림 —
     * {@code FE/lib/inventory-state.ts} {@code safetyOf} 와 같은 식이다. 리드타임이 없는 품목은 건드리지 않는다
     * (자동에서도 「미설정」이었다).
     */
    private void freezeAutoSafety(int windowDays) {
        jdbc.update(
                """
                with defaults as (
                    select iv.item_code, v.lead_time_days
                      from inv_item_vendors iv
                      join inv_vendors v on v.id = iv.vendor_id
                     where iv.sort = (select min(sort) from inv_item_vendors x where x.item_code = iv.item_code)
                       and v.lead_time_days is not null
                ), used as (
                    select item_code, sum(-qty) as out_qty
                      from inv_movements
                     where kind = 'out' and moved_at::date > current_date - ?::integer
                     group by item_code
                )
                insert into inv_item_standards (item_code, baseline, as_of, safety)
                select d.item_code, 0, null,
                       ceil(coalesce(u.out_qty, 0)::numeric / ?::numeric * d.lead_time_days)::integer
                  from defaults d
                  left join used u on u.item_code = d.item_code
                on conflict (item_code) do update set safety = excluded.safety
                """,
                windowDays, windowDays);
    }

    private void upsertStandard(String itemCode, int baseline, LocalDate asOf, Integer safety) {
        jdbc.update(
                """
                insert into inv_item_standards (item_code, baseline, as_of, safety) values (?, ?, ?, ?)
                on conflict (item_code) do update set
                    baseline = excluded.baseline, as_of = excluded.as_of, safety = excluded.safety
                """,
                itemCode, baseline, asOf, safety);
    }

    /** Jackson 3 의 {@code writeValueAsString} 은 검사 예외를 던지지 않는다(2.x 와 달라진 점). */
    private String json(DocRulesDto rules) {
        return mapper.writeValueAsString(rules);
    }
}
