package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.dto.MemberResponse;
import com.axcore.workspace.workspace.settings.dto.MemberUpdateRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 구성원 — 초대 관리 › 구성원 탭. 목록과 소속(부서 · 직급) 변경.
 *
 * <p>목록은 회사 구성원 누구나 본다(조직도 성격). 바꾸는 것은 <b>소유자만</b>이다(2026-09-08 변경 — 초대 관리의 모든 쓰기는
 * 소유자만). 소유자의 소속은 여기서 건드리지 않는다 — 소유자는 담당자 규칙으로만 바뀐다. 자기 소속도 바꾸지 않는다.
 *
 * <p>제거는 없다. 되돌릴 수 없는 동작이고 소속(shared) 과 구성원(테넌트) 두 곳을 함께 닫아야 해서 별도 작업으로 남긴다.
 */
@Service
public class MemberService {

    private static final Logger log = LoggerFactory.getLogger(MemberService.class);

    private final TenantAccess access;
    private final JdbcTemplate jdbc;
    private final PeopleGuard guard;

    public MemberService(TenantAccess access, JdbcTemplate jdbc, PeopleGuard guard) {
        this.access = access;
        this.jdbc = jdbc;
        this.guard = guard;
    }

    @Transactional(readOnly = true)
    public List<MemberResponse> list(JwtPrincipal principal) {
        access.open(principal);
        return rows(null);
    }

    @Transactional
    public MemberResponse update(JwtPrincipal principal, long memberId, MemberUpdateRequest request) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        MemberResponse target =
                rows(memberId).stream().findFirst().orElseThrow(() -> new SettingsNotFoundException("구성원을 찾을 수 없습니다"));

        if ("owner".equals(target.roleCode())) {
            throw new SettingsForbiddenException("소유자의 소속은 바꿀 수 없습니다");
        }
        long roleId = guard.requireAssignableRole(request.roleId());
        Long departmentId = guard.requireAssignableDepartment(request.departmentId());

        jdbc.update(
                "update members set role_id = ?, department_id = ?, updated_at = now() where id = ?",
                roleId,
                departmentId,
                memberId);
        log.info(
                "워크스페이스 {} 구성원 {} 의 소속을 사용자 {} 가 바꿨다 (직급 {} · 부서 {})",
                ctx.workspaceId(),
                memberId,
                ctx.userId(),
                roleId,
                departmentId);
        return rows(memberId).get(0);
    }

    /** @param id null 이면 전부. 떠난(left) 사람은 빼고 이름순. */
    private List<MemberResponse> rows(Long id) {
        return jdbc.query(
                """
                select m.id, u.name, u.email, r.id, r.code, r.name, d.id, d.name
                  from members m
                  join shared.users u on u.id = m.user_id
                  left join roles r on r.id = m.role_id
                  left join departments d on d.id = m.department_id
                 where m.status <> 'left'
                   and (?::bigint is null or m.id = ?::bigint)
                 order by u.name, u.email
                """,
                (rs, i) ->
                        new MemberResponse(
                                rs.getLong(1),
                                rs.getString(2),
                                rs.getString(3),
                                rs.getObject(4, Long.class),
                                rs.getString(5),
                                rs.getString(6),
                                rs.getObject(7, Long.class),
                                rs.getString(8)),
                id,
                id);
    }
}
