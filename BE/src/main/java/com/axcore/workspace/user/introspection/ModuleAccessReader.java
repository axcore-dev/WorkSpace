package com.axcore.workspace.user.introspection;

import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 사용자가 이 회사에서 쓸 수 있는 기능(모듈) 목록. AI 서버가 답변 범위를 좁히는 데 쓴다.
 *
 * <p>슬러그는 화면의 핵심 기능 목록(FE/data/modules.ts)과 같다. 여기서 한 번 더 목록을 갖는 이유는
 * 테넌트 테이블의 값을 그대로 믿지 않기 위해서다 — 그 테이블에 엉뚱한 slug 가 들어 있어도 알려진 것만
 * 통과한다.
 *
 * <p>계산 규칙(스키마 초안: enabled ∩ role_module_grants ∩ member_module_grants)을 지금 데이터에
 * 맞게 적용한다. 아직 권한 부여 화면이 없어 두 테이블이 비어 있는 회사가 대부분이라, 그대로 교집합을 내면
 * 관리자 외에는 아무것도 못 쓴다.
 *
 * <ul>
 *   <li>서버 운영자 · 관리자 역할({@code roles.is_admin}) — 전부</li>
 *   <li>역할 범위와 개인 부여가 둘 다 있으면 — 교집합</li>
 *   <li>개인 부여가 없으면 — 역할 범위. 역할 범위도 없으면 — 없음</li>
 * </ul>
 *
 * <p>{@code enabled_modules}(회사가 켠 기능)는 아직 테이블이 없어 보지 않는다. 생기면 여기서 한 번 더 걸러낸다.
 *
 * <p><b>트랜잭션 안에서 불러야 한다.</b> 테넌트 스키마를 {@link TenantSearchPath#bind} 로 여는데 그 설정은
 * 트랜잭션과 함께 사라진다. 소속 확인이 끝난 뒤, 그 사람의 회사 스키마 이름으로만 부른다.
 */
@Component
public class ModuleAccessReader {

    /** 화면의 핵심 기능 slug. FE/data/modules.ts 와 같은 순서·값이어야 한다. */
    public static final List<String> ALL_MODULES =
            List.of(
                    "management",
                    "design",
                    "production",
                    "equipment",
                    "quality",
                    "inventory",
                    "sales",
                    "support");

    private final JdbcTemplate jdbc;
    private final TenantSearchPath searchPath;

    public ModuleAccessReader(JdbcTemplate jdbc, TenantSearchPath searchPath) {
        this.jdbc = jdbc;
        this.searchPath = searchPath;
    }

    public List<String> allowedModules(String schemaName, UUID userId, boolean internalAdmin) {
        if (internalAdmin) {
            return ALL_MODULES;
        }
        searchPath.bind(schemaName);

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
            return ALL_MODULES;
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
        // 알려진 slug 만, 화면 순서대로
        return ALL_MODULES.stream().filter(effective::contains).toList();
    }
}
