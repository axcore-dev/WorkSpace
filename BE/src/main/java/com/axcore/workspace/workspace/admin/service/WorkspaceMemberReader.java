package com.axcore.workspace.workspace.admin.service;

import com.axcore.workspace.workspace.admin.dto.WorkspaceMemberResponse;
import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/**
 * 테넌트 스키마의 구성원을 읽는다.
 *
 * <p>구성원 정보는 {@code shared} 가 아니라 각 회사의 스키마에 있다. {@code shared} 쪽
 * {@code user_workspace_memberships} 는 "이 사람이 어느 스키마를 열 수 있는가" 만 답하는
 * 라우팅 인덱스이고, 역할·상태·마지막 접속 같은 것은 테넌트의 {@code members} · {@code roles}
 * 에 있다.
 *
 * <p>그래서 JPA 로 못 읽는다. 엔티티 하나가 여러 스키마를 오갈 수 없기 때문이다. 대신
 * {@link TenantSearchPath} 로 {@code search_path} 를 열고 JDBC 로 직접 조회한다.
 *
 * <p>스키마 이름을 SQL 에 문자열로 이어 붙이지 않는다. {@code TenantSearchPath} 가
 * {@code SchemaName.requireValid} 로 형식을 확인한 뒤 {@code set_config} 파라미터로 넘긴다.
 */
@Service
public class WorkspaceMemberReader {

    private static final Logger log = LoggerFactory.getLogger(WorkspaceMemberReader.class);

    /**
     * 이름은 {@code shared.users} 에, 역할·상태는 테넌트에 있다. 스키마를 넘나드는 조인이라
     * {@code shared} 를 명시적으로 적는다 — {@code search_path} 에 둘 다 있어도 같은 이름의
     * 테이블이 생기면 어느 쪽인지 모호해진다.
     */
    private static final String SQL =
            """
            select u.name        as name,
                   u.email       as email,
                   r.name        as role_name,
                   m.status      as status,
                   m.created_at  as invited_at,
                   m.last_active_at as last_active_at
              from members m
              join shared.users u on u.id = m.user_id
              left join roles r   on r.id = m.role_id
             order by m.created_at asc
            """;

    private final JdbcTemplate jdbcTemplate;
    private final TenantSearchPath searchPath;

    public WorkspaceMemberReader(JdbcTemplate jdbcTemplate, TenantSearchPath searchPath) {
        this.jdbcTemplate = jdbcTemplate;
        this.searchPath = searchPath;
    }

    /**
     * @param schemaName null 이면(아직 개설 전) 빈 목록. 열 스키마가 없다
     * @return 초대 순서(오래된 것부터)
     */
    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> membersOf(String schemaName) {
        if (schemaName == null || schemaName.isBlank()) {
            return List.of();
        }
        try {
            searchPath.bind(schemaName);
            return jdbcTemplate.query(
                    SQL,
                    (rs, rowNum) ->
                            new WorkspaceMemberResponse(
                                    rs.getString("name"),
                                    rs.getString("email"),
                                    rs.getString("role_name"),
                                    rs.getString("status"),
                                    toInstant(rs.getTimestamp("invited_at")),
                                    toInstant(rs.getTimestamp("last_active_at"))));
        } catch (RuntimeException e) {
            // 한 회사의 스키마가 깨졌다고 운영자 콘솔 전체가 막히면 안 된다. 그 회사만 빈
            // 목록으로 보이고, 원인은 로그에 남는다.
            log.error("테넌트 {} 구성원 조회 실패", schemaName, e);
            return List.of();
        }
    }

    /**
     * 회사의 마지막 활동 시각. 구성원 중 가장 최근 접속이다.
     *
     * <p>워크스페이스 자체에는 이 값이 없다. 회사가 "살아 있다" 는 것은 결국 누군가 들어왔다는
     * 뜻이라, 구성원의 마지막 접속을 모아 판단하는 것이 맞다.
     */
    @Transactional(readOnly = true)
    public Instant lastActiveAt(String schemaName) {
        if (schemaName == null || schemaName.isBlank()) {
            return null;
        }
        try {
            searchPath.bind(schemaName);
            return toInstant(
                    jdbcTemplate.queryForObject(
                            "select max(last_active_at) from members", Timestamp.class));
        } catch (RuntimeException e) {
            log.error("테넌트 {} 마지막 활동 조회 실패", schemaName, e);
            return null;
        }
    }

    private static Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }
}
