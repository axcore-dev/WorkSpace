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
 *   <li>서버 운영자 · 관리자 역할({@code roles.is_admin}) — 켜진 것 전부</li>
 *   <li>역할 범위와 개인 부여가 둘 다 있으면 — 교집합</li>
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

        // 활성 구성원인지와 관리자 역할인지. 행이 없으면 구성원이 아니다(소속은 확인됐지만 members 가 아직 없는 경우 포함).
        List<Boolean> adminFlags =
                jdbc.query(
                        """
                        select coalesce(r.is_admin, false)
                          from members m
                          left join roles r on r.id = m.role_id
                         where m.user_id = ? and m.status = 'active'
                        """,
                        (rs, i) -> rs.getBoolean(1),
                        userId);
        if (adminFlags.isEmpty()) {
            return List.of();
        }
        if (adminFlags.get(0)) {
            return ordered(enabled);
        }

        Set<String> role =
                new HashSet<>(
                        jdbc.queryForList(
                                """
                                select g.module_slug
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

    /** 알려진 slug 만, 화면 순서대로. */
    private static List<String> ordered(Set<String> slugs) {
        return ALL_MODULES.stream().filter(slugs::contains).toList();
    }
}
