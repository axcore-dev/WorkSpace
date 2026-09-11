package com.axcore.workspace.user.introspection;

import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import com.axcore.workspace.workspace.settings.EnabledFeatureStore;
import com.axcore.workspace.workspace.settings.FeatureCatalog;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 사용자가 이 회사에서 쓸 수 있는 기능(모듈) 목록. AI 서버가 답변 범위를 좁히고, 설정 화면의 {@code /me} 가
 * 사이드바를 그리는 데 쓴다.
 *
 * <p>슬러그는 {@link FeatureCatalog}(= FE/data/modules.ts)가 단일 소스다. 테넌트 테이블의 값을 그대로 믿지
 * 않고 알려진 것만 통과시킨다.
 *
 * <p>계산 규칙(스키마 초안: enabled ∩ role_module_grants ∩ member_module_grants)을 지금 데이터에 맞게 적용한다.
 *
 * <ul>
 *   <li><b>회사가 끈 기능은 누구에게도 없다</b> — 서버 운영자·관리자도 마찬가지다. 꺼진 기능은 사이드바에도 없고
 *       AI 가 그 분야를 답해도 확인할 화면이 없다 ({@code enabled_features}, tenant V8)</li>
 *   <li>서버 운영자 · 소유자({@code roles.code = 'owner'}) — 켜진 것 전부. 관리자는 예외가 아니다 — 소유자가 관리자의 탭도 정한다</li>
 *   <li>역할 범위({@code role_module_grants}, 탭 단위 행에서 모듈만 뽑음)와 개인 부여가 둘 다 있으면 — 교집합</li>
 *   <li>개인 부여가 없으면 — 역할 범위. 역할 범위도 없으면 — 없음</li>
 * </ul>
 *
 * <p><b>트랜잭션 안에서 불러야 한다.</b> 테넌트 스키마를 {@link TenantSearchPath#bind} 로 여는데 그 설정은
 * 트랜잭션과 함께 사라진다. 소속 확인이 끝난 뒤, 그 사람의 회사 스키마 이름으로만 부른다.
 */
@Component
public class ModuleAccessReader {

    /** 화면의 핵심 기능 slug. 카탈로그 순서 그대로다. 이름을 남겨 두는 이유는 기존 호출부가 참조하기 때문이다. */
    public static final List<String> ALL_MODULES = FeatureCatalog.moduleSlugs();

    private final JdbcTemplate jdbc;
    private final TenantSearchPath searchPath;
    private final EnabledFeatureStore features;

    public ModuleAccessReader(
            JdbcTemplate jdbc, TenantSearchPath searchPath, EnabledFeatureStore features) {
        this.jdbc = jdbc;
        this.searchPath = searchPath;
        this.features = features;
    }

    public List<String> allowedModules(String schemaName, UUID userId, boolean internalAdmin) {
        searchPath.bind(schemaName);

        // 회사가 켠 기능. 이 밖의 것은 아래 어떤 규칙으로도 열리지 않는다.
        Set<String> enabled = features.enabledModules();

        if (internalAdmin) {
            return ordered(enabled);
        }

        // 활성 구성원인지와 소유자인지. 행이 없으면 구성원이 아니다(소속은 확인됐지만 members 가 아직 없는 경우 포함).
        // 소유자만 표를 보지 않고 전부다. 관리자(is_admin)는 회사 설정을 다루는 자격이지 기능 접근이 아니다 —
        // 기능 탭은 role_module_grants 에서만 나온다(tenant V9 · V10, 결정 B: 소유자가 관리자의 권한도 정한다).
        List<Boolean> ownerFlags =
                jdbc.query(
                        """
                        select coalesce(r.code = 'owner', false)
                          from members m
                          left join roles r on r.id = m.role_id
                         where m.user_id = ? and m.status = 'active'
                        """,
                        (rs, i) -> rs.getBoolean(1),
                        userId);
        if (ownerFlags.isEmpty()) {
            return List.of();
        }
        if (ownerFlags.get(0)) {
            return ordered(enabled);
        }

        // 탭 단위 행에서 모듈만 뽑는다 — 탭이 하나라도 있으면 그 모듈은 열린다
        Set<String> role =
                new HashSet<>(
                        jdbc.queryForList(
                                """
                                select distinct g.module_slug
                                  from role_module_grants g
                                  join members m on m.role_id = g.role_id
                                 where m.user_id = ?
                                """,
                                String.class,
                                userId));
        Set<String> member =
                new HashSet<>(
                        jdbc.queryForList(
                                """
                                select g.module_slug
                                  from member_module_grants g
                                  join members m on m.id = g.member_id
                                 where m.user_id = ?
                                """,
                                String.class,
                                userId));

        Set<String> effective;
        if (member.isEmpty()) {
            effective = role;
        } else {
            effective = new HashSet<>(role);
            effective.retainAll(member);
        }
        effective.retainAll(enabled);
        return ordered(effective);
    }

    /**
     * 쓸 수 있는 <b>기능 탭</b>. 모듈보다 한 칸 좁다 — 경영지원을 가진 사람이 급여 탭까지 가진 것은 아니다.
     *
     * <p>계산은 {@link #allowedModules} 와 같은 세 겹이되 탭 단위다. 회사가 켠 탭({@code enabled_features}) ∩ 직급이
     * 가진 탭({@code role_module_grants.subfunction_id}) ∩ 개인 부여. 개인 부여는 모듈 단위라 그 모듈의 탭 전체를
     * 통과시킨다 — 모듈을 막으면 그 안의 탭도 따라 막힌다.
     *
     * <p>소유자와 서버 운영자는 회사가 켠 탭 전부다. 관리자(is_admin)는 특별 대우가 없다 — 회사 설정을 다루는
     * 자격이지 기능 접근이 아니다({@link #allowedModules} 와 같은 규칙).
     *
     * <p><b>트랜잭션 안에서 불러야 한다.</b> {@link #allowedModules} 와 같은 전제다.
     */
    public List<String> allowedTabs(String schemaName, UUID userId, boolean internalAdmin) {
        searchPath.bind(schemaName);

        // 회사가 켠 탭. 이 밖의 것은 아래 어떤 규칙으로도 열리지 않는다
        Set<String> enabled = new HashSet<>();
        features.readAll()
                .forEach((module, tabs) -> tabs.forEach((tab, on) -> {
                    if (Boolean.TRUE.equals(on)) {
                        enabled.add(tab);
                    }
                }));

        if (internalAdmin) {
            return orderedTabs(enabled);
        }

        List<Boolean> ownerFlags =
                jdbc.query(
                        """
                        select coalesce(r.code = 'owner', false)
                          from members m
                          left join roles r on r.id = m.role_id
                         where m.user_id = ? and m.status = 'active'
                        """,
                        (rs, i) -> rs.getBoolean(1),
                        userId);
        if (ownerFlags.isEmpty()) {
            return List.of();
        }
        if (ownerFlags.get(0)) {
            return orderedTabs(enabled);
        }

        Set<String> role =
                new HashSet<>(
                        jdbc.queryForList(
                                """
                                select distinct g.subfunction_id
                                  from role_module_grants g
                                  join members m on m.role_id = g.role_id
                                 where m.user_id = ? and g.subfunction_id is not null
                                """,
                                String.class,
                                userId));

        // 개인 부여는 모듈 단위다. 있으면 그 모듈들의 탭만 남긴다
        Set<String> memberModules =
                new HashSet<>(
                        jdbc.queryForList(
                                """
                                select g.module_slug
                                  from member_module_grants g
                                  join members m on m.id = g.member_id
                                 where m.user_id = ?
                                """,
                                String.class,
                                userId));
        if (!memberModules.isEmpty()) {
            Set<String> allowedByMember = new HashSet<>();
            for (FeatureCatalog.Module module : FeatureCatalog.modules()) {
                if (memberModules.contains(module.slug())) {
                    allowedByMember.addAll(module.tabs());
                }
            }
            role.retainAll(allowedByMember);
        }

        role.retainAll(enabled);
        return orderedTabs(role);
    }

    /** 알려진 slug 만, 화면 순서대로. */
    private static List<String> ordered(Set<String> slugs) {
        return ALL_MODULES.stream().filter(slugs::contains).toList();
    }

    /** 카탈로그에 있는 탭만, 모듈 순서 · 탭 순서 그대로. */
    private static List<String> orderedTabs(Set<String> tabs) {
        return FeatureCatalog.modules().stream()
                .flatMap(m -> m.tabs().stream())
                .filter(tabs::contains)
                .toList();
    }
}
