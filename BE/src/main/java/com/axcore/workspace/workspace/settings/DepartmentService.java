package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.dto.DepartmentRequest;
import com.axcore.workspace.workspace.settings.dto.DepartmentResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 부서 — 권한 관리 화면의 왼쪽 열.
 *
 * <p>부서는 직급을 담는 그릇이다. 이름 외에 속성이 없고, 규칙은 하나다 — <b>직급이 남아 있으면 지울 수 없다.</b>
 * 지우려면 직급을 다른 부서로 옮기거나 먼저 지운다({@code moveRolesTo}). DB 의 {@code ON DELETE RESTRICT} 가 같은 규칙을
 * 마지막에 한 번 더 지킨다. 구성원의 소속 부서는 {@code SET NULL} 로 풀린다 — 부서가 사라지는 것과 사람이 사라지는 것은 다르다.
 *
 * <p>소유자만 다룬다 — 권한 관리 화면 전체가 소유자 전용이다(2026-09-08 변경).
 * 이름 중복은 DB 의 {@code ux_departments_name} 이 막고 {@code GlobalExceptionHandler} 가 409 로 옮긴다.
 */
@Service
public class DepartmentService {

    private static final Logger log = LoggerFactory.getLogger(DepartmentService.class);

    private final TenantAccess access;
    private final JdbcTemplate jdbc;

    public DepartmentService(TenantAccess access, JdbcTemplate jdbc) {
        this.access = access;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> list(JwtPrincipal principal) {
        access.open(principal);
        return rows(null);
    }

    @Transactional
    public DepartmentResponse create(JwtPrincipal principal, DepartmentRequest request) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        String name = request.name().trim();
        Long id =
                jdbc.queryForObject(
                        "insert into departments (name, created_at, updated_at) values (?, now(), now()) returning id",
                        Long.class,
                        name);
        log.info("워크스페이스 {} 에 부서 {} 를 사용자 {} 가 만들었다", ctx.workspaceId(), id, ctx.userId());
        return new DepartmentResponse(id, name, 0);
    }

    @Transactional
    public DepartmentResponse rename(JwtPrincipal principal, long id, DepartmentRequest request) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        requireExists(id);
        jdbc.update("update departments set name = ?, updated_at = now() where id = ?", request.name().trim(), id);
        log.info("워크스페이스 {} 부서 {} 의 이름을 사용자 {} 가 바꿨다", ctx.workspaceId(), id, ctx.userId());
        return rows(id).get(0);
    }

    /**
     * 부서를 지운다.
     *
     * @param moveRolesTo 직급이 남아 있을 때 옮길 부서. 없으면 직급이 하나라도 있으면 409
     */
    @Transactional
    public void delete(JwtPrincipal principal, long id, Long moveRolesTo) {
        TenantContext ctx = access.open(principal);
        ctx.requireOwner();
        requireExists(id);

        int roles = jdbc.queryForObject("select count(*) from roles where department_id = ?", Integer.class, id);
        if (roles > 0) {
            if (moveRolesTo == null) {
                throw new SettingsConflictException(
                        "DEPARTMENT_NOT_EMPTY", "직급 " + roles + "개가 남아 있어요. 다른 부서로 옮기거나 먼저 지워 주세요");
            }
            if (moveRolesTo == id) {
                throw new SettingsValidationException("지우는 부서로는 옮길 수 없습니다");
            }
            requireExists(moveRolesTo);
            jdbc.update(
                    "update roles set department_id = ?, updated_at = now() where department_id = ?", moveRolesTo, id);
        }
        // 구성원의 department_id 는 FK ON DELETE SET NULL 로 풀린다
        jdbc.update("delete from departments where id = ?", id);
        log.info(
                "워크스페이스 {} 부서 {} 를 사용자 {} 가 지웠다 (직급 {}개 → {})",
                ctx.workspaceId(),
                id,
                ctx.userId(),
                roles,
                moveRolesTo);
    }

    // ---------------------------------------------------------------- 조회

    /** @param id null 이면 전부 */
    private List<DepartmentResponse> rows(Long id) {
        return jdbc.query(
                """
                select d.id, d.name, (select count(*) from roles r where r.department_id = d.id)
                  from departments d
                 where (?::bigint is null or d.id = ?::bigint)
                 order by d.id
                """,
                (rs, i) -> new DepartmentResponse(rs.getLong(1), rs.getString(2), rs.getInt(3)),
                id,
                id);
    }

    void requireExists(long id) {
        if (rows(id).isEmpty()) {
            throw new SettingsNotFoundException("부서를 찾을 수 없습니다");
        }
    }
}
