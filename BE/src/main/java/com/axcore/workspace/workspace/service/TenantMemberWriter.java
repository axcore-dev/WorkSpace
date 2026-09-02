package com.axcore.workspace.workspace.service;

import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 테넌트 스키마에 구성원을 넣는다.
 *
 * <p>초대를 수락하면 두 곳에 행이 생긴다. {@code shared.user_workspace_memberships} 는 "이
 * 사람이 어느 스키마를 열 수 있는가" 만 답하는 라우팅 인덱스이고, 실제 구성원 정보(역할 ·
 * 부서 · 마지막 접속)는 각 회사의 스키마에 있다. 둘 중 하나만 만들면 로그인은 되는데 회사
 * 안에서는 아무것도 아닌 사람이 된다.
 *
 * <p>JPA 로 못 쓴다. 엔티티 하나가 회사마다 다른 스키마를 오갈 수 없다.
 */
@Service
public class TenantMemberWriter {

    private static final Logger log = LoggerFactory.getLogger(TenantMemberWriter.class);

    /**
     * 처음 들어온 사람이 소유자다.
     *
     * <p>계약 회사의 첫 수락자는 담당자 본인이고, 그 사람이 이후 동료를 부르게 된다. 아무도
     * 소유자가 아닌 회사를 만들어 두면 나중에 누가 권한을 주는지가 막힌다.
     */
    private static final String OWNER = "owner";

    /**
     * 두 번째부터는 관리자.
     *
     * <p>초대는 고객사 담당자에게 간다. 회사를 운영할 사람이지 구경만 할 사람이 아니라,
     * 받자마자 사람을 더 부르고 설정을 만질 수 있어야 한다. 일반 구성원으로 부르는 흐름이
     * 생기면 그때 역할을 골라 보내면 된다.
     */
    private static final String INVITED = "admin";

    private final JdbcTemplate jdbcTemplate;
    private final TenantSearchPath searchPath;

    public TenantMemberWriter(JdbcTemplate jdbcTemplate, TenantSearchPath searchPath) {
        this.jdbcTemplate = jdbcTemplate;
        this.searchPath = searchPath;
    }

    /**
     * 구성원으로 넣는다. 이미 있으면 아무 일도 하지 않는다.
     *
     * <p>{@code ux_members_user} 가 한 사람이 같은 회사에 두 번 들어오는 것을 막고 있어서
     * {@code ON CONFLICT DO NOTHING} 으로 멱등하게 만든다 — 수락을 두 번 눌러도 실패하지 않는다.
     *
     * @param schemaName 개설되지 않았으면 아무 일도 하지 않는다
     */
    @Transactional
    public void join(String schemaName, UUID userId) {
        if (schemaName == null || schemaName.isBlank()) {
            log.warn("스키마가 없는 워크스페이스에 구성원을 넣으려 했다. 사용자 {}", userId);
            return;
        }
        searchPath.bind(schemaName);

        // 첫 구성원인지를 같은 문장 안에서 판단한다. 세어 보고 넣으면 두 사람이 동시에
        // 수락했을 때 둘 다 소유자가 된다.
        jdbcTemplate.update(
                """
                insert into members (user_id, role_id, status, created_at, updated_at)
                select ?,
                       (select id from roles
                         where code = case when exists (select 1 from members) then ? else ? end),
                       'active', now(), now()
                on conflict (user_id) do nothing
                """,
                userId,
                INVITED,
                OWNER);

        log.info("테넌트 {} 에 구성원 {} 를 넣었다", schemaName, userId);
    }
}
