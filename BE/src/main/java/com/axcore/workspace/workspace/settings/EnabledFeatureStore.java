package com.axcore.workspace.workspace.settings;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * {@code enabled_features} 읽기·쓰기. 카탈로그와 합쳐 "모듈마다 탭 → 켜짐" 을 완성해 돌려준다.
 *
 * <p><b>테넌트 스키마가 열린 트랜잭션 안에서만 부를 수 있다.</b> 여기서는 {@code search_path} 를 건드리지
 * 않는다 — 호출부({@link TenantAccess} 또는 {@code ModuleAccessReader})가 이미 열어 둔 것을 쓴다.
 * 두 번 여는 것을 피하려는 게 아니라, "어느 회사인가" 를 정하는 책임을 한 곳에 두려는 것이다.
 */
@Component
public class EnabledFeatureStore {

    private final JdbcTemplate jdbc;

    public EnabledFeatureStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 카탈로그의 모든 모듈·탭에 대한 켜짐 상태. 행이 없는 탭은 기본값으로 채운다.
     *
     * <p>DB 에만 있고 카탈로그에 없는 slug 는 버린다 — 카탈로그에서 빠진 탭이 유령처럼 남지 않게 한다.
     */
    public Map<String, Map<String, Boolean>> readAll() {
        Map<String, Map<String, Boolean>> result = new LinkedHashMap<>();
        for (FeatureCatalog.Module module : FeatureCatalog.modules()) {
            Map<String, Boolean> tabs = new LinkedHashMap<>();
            boolean def = FeatureCatalog.defaultEnabled(module.slug());
            for (String tab : module.tabs()) {
                tabs.put(tab, def);
            }
            result.put(module.slug(), tabs);
        }
        jdbc.query(
                "select module_slug, subfunction_id, enabled from enabled_features",
                rs -> {
                    Map<String, Boolean> tabs = result.get(rs.getString(1));
                    String tab = rs.getString(2);
                    if (tabs != null && tabs.containsKey(tab)) {
                        tabs.put(tab, rs.getBoolean(3));
                    }
                });
        return result;
    }

    /** 탭이 하나라도 켜진 모듈 slug. 화면 순서대로. */
    public Set<String> enabledModules() {
        Set<String> on = new LinkedHashSet<>();
        readAll().forEach(
                (slug, tabs) -> {
                    if (tabs.containsValue(Boolean.TRUE)) {
                        on.add(slug);
                    }
                });
        return on;
    }

    /**
     * 한 모듈의 탭 상태를 저장한다. 넘어온 탭만 바꾸고 나머지는 그대로다.
     *
     * <p>UPSERT 라 첫 저장과 재저장이 같은 문장이다. 값을 검증하는 것은 호출부의 몫이다 — 여기 오는
     * {@code tabs} 의 키는 카탈로그에 있는 탭이어야 한다.
     */
    public void upsert(String moduleSlug, Map<String, Boolean> tabs, UUID updatedBy) {
        for (Map.Entry<String, Boolean> e : tabs.entrySet()) {
            jdbc.update(
                    """
                    insert into enabled_features (module_slug, subfunction_id, enabled, updated_by, updated_at)
                    values (?, ?, ?, ?, now())
                    on conflict (module_slug, subfunction_id)
                    do update set enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = now()
                    """,
                    moduleSlug,
                    e.getKey(),
                    e.getValue(),
                    updatedBy);
        }
    }
}
