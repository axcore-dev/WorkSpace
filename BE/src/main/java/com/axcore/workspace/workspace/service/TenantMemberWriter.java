package com.axcore.workspace.workspace.service;

import com.axcore.workspace.workspace.provisioning.TenantSearchPath;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 테넌트 스키마의 구성원을 쓴다 — 넣기와 역할 바꾸기.
 *
 * <p>초대를 수락하면 두 곳에 행이 생긴다. {@code shared.user_workspace_memberships} 는 "이
 * 사람이 어느 스키마를 열 수 있는가" 만 답하는 라우팅 인덱스이고, 실제 구성원 정보(역할 ·
 * 부서 · 마지막 접속)는 각 회사의 스키마에 있다. 둘 중 하나만 만들면 로그인은 되는데 회사
 * 안에서는 아무것도 아닌 사람이 된다.
 *
 * <p>JPA 로 못 쓴다. 엔티티 하나가 회사마다 다른 스키마를 오갈 수 없다.
 *
 * <h2>소유자(owner)는 곧 담당자다</h2>
 *
 * <p>전에는 "처음 들어온 사람이 소유자" 였다. 담당자 변경 기능이 붙으면서 규칙을
 * <b>"{@code shared.workspaces} 의 담당자 이메일로 들어온 사람이 소유자"</b> 로 바꿨다.
 * 운영자가 담당자를 바꾸면 소유자도 따라 옮겨 가야 하는데, 첫 수락자 규칙으로는 그것을 표현할
 * 수 없기 때문이다. 소유자는 회사에 한 명이다 — {@link #transferOwner} 가 나머지를 관리자로 내린다.
 * 담당자가 아직 들어오지 않은 동안 소유자가 없을 수 있는데, 지금 {@code owner} 와 {@code admin} 은
 * 권한이 같아서({@code is_admin} · {@code can_invite} 둘 다 true) 운영에 차이가 없다.
 */
@Service
public class TenantMemberWriter {

    private static final Logger log = LoggerFactory.getLogger(TenantMemberWriter.class);

    /** 담당자의 역할. 회사에 한 명. */
    private static final String OWNER = "owner";

    /**
     * 담당자가 아닌 초대 수락자, 그리고 담당자 자리에서 내려온 사람의 역할.
     *
     * <p>초대는 회사를 운영할 사람에게 간다. 받자마자 사람을 더 부르고 설정을 만질 수 있어야
     * 하므로 구성원(member)이 아니라 관리자다. 일반 구성원으로 부르는 흐름이 생기면 그때
     * 역할을 골라 보내면 된다.
     */
    private static final String ADMIN = "admin";

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
     * 이미 있는 사람의 역할은 여기서 바꾸지 않는다. 담당자로 올려야 하면 {@link #transferOwner} 가
     * 따로 한다.
     *
     * @param schemaName 개설되지 않았으면 아무 일도 하지 않는다
     * @param asOwner 담당자 이메일로 들어온 사람이면 true → {@code owner}, 아니면 {@code admin}
     */
    @Transactional
    public void join(String schemaName, UUID userId, boolean asOwner) {
        if (isBlank(schemaName)) {
            log.warn("스키마가 없는 워크스페이스에 구성원을 넣으려 했다. 사용자 {}", userId);
            return;
        }
        searchPath.bind(schemaName);

        jdbcTemplate.update(
                """
                insert into members (user_id, role_id, status, created_at, updated_at)
                select ?, (select id from roles where code = ?), 'active', now(), now()
                on conflict (user_id) do nothing
                """,
                userId,
                asOwner ? OWNER : ADMIN);

        log.info("테넌트 {} 에 구성원 {} 를 {} 로 넣었다", schemaName, userId, asOwner ? OWNER : ADMIN);
    }

    /**
     * 소유자를 이 사람으로 옮긴다. 다른 소유자는 전부 관리자로 내린다.
     *
     * <p>두 문장이지만 같은 트랜잭션이라 중간 상태(소유자 0명 또는 2명)가 밖에 보이지 않는다.
     * 대상이 아직 구성원이 아니면 두 번째 문장이 0건이다 — 호출부가 {@link #join} 을 먼저 불러야 한다.
     * 이미 그 사람이 유일한 소유자면 둘 다 0건으로 끝나 멱등하다.
     *
     * @return 관리자로 내려간 이전 소유자 수
     */
    @Transactional
    public int transferOwner(String schemaName, UUID newOwnerUserId) {
        if (isBlank(schemaName)) {
            log.warn("스키마가 없는 워크스페이스의 소유자를 옮기려 했다. 사용자 {}", newOwnerUserId);
            return 0;
        }
        searchPath.bind(schemaName);

        int demoted =
                jdbcTemplate.update(
                        """
                        update members
                           set role_id = (select id from roles where code = ?), updated_at = now()
                         where role_id = (select id from roles where code = ?)
                           and user_id <> ?
                        """,
                        ADMIN,
                        OWNER,
                        newOwnerUserId);

        int promoted =
                jdbcTemplate.update(
                        """
                        update members
                           set role_id = (select id from roles where code = ?), updated_at = now()
                         where user_id = ?
                           and role_id is distinct from (select id from roles where code = ?)
                        """,
                        OWNER,
                        newOwnerUserId,
                        OWNER);

        log.info(
                "테넌트 {} 소유자를 {} 로 옮겼다 (내려간 소유자 {}명, 올라간 사람 {}명)",
                schemaName,
                newOwnerUserId,
                demoted,
                promoted);
        return demoted;
    }

    /** 이 사람이 테넌트 구성원인가. {@code shared} 의 라우팅 인덱스와 어긋난 경우를 잡아내는 데 쓴다. */
    @Transactional(readOnly = true)
    public boolean isMember(String schemaName, UUID userId) {
        if (isBlank(schemaName)) {
            return false;
        }
        searchPath.bind(schemaName);
        Boolean exists =
                jdbcTemplate.queryForObject(
                        "select exists (select 1 from members where user_id = ?)",
                        Boolean.class,
                        userId);
        return Boolean.TRUE.equals(exists);
    }

    /** 이 사람이 테넌트 소유자인가. 운영자 콘솔의 담당자 상태 표시에 쓴다. */
    @Transactional(readOnly = true)
    public boolean isOwner(String schemaName, UUID userId) {
        if (isBlank(schemaName)) {
            return false;
        }
        searchPath.bind(schemaName);
        Boolean owner =
                jdbcTemplate.queryForObject(
                        """
                        select exists (
                            select 1 from members m
                              join roles r on r.id = m.role_id
                             where m.user_id = ? and r.code = ?)
                        """,
                        Boolean.class,
                        userId,
                        OWNER);
        return Boolean.TRUE.equals(owner);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
