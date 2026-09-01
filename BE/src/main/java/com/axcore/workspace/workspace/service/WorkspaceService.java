package com.axcore.workspace.workspace.service;

import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.service.SessionIssuer;
import com.axcore.workspace.user.service.UserSessionService;
import com.axcore.workspace.workspace.entity.UserWorkspaceMembership;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.repository.UserWorkspaceMembershipRepository;
import com.axcore.workspace.workspace.repository.WorkspaceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 회사 선택.
 *
 * <p>로그인은 회사와 무관하게 끝나고({@code shared.users}), 그 다음에 어느 회사로 들어갈지를
 * 고른다. 고른 값은 세션에 남아 {@code search_path} 를 정하는 근거가 된다.
 * (docs/db/schema-draft-v2.md "로그인 흐름이 바뀐다")
 *
 * <p><b>아직 스키마를 열지는 않는다.</b> 테넌트 스키마 생성·마이그레이션 순회가 없어서 열 것이
 * 없다. 여기서 하는 일은 선택을 세션에 기록하고 {@code wsid} 클레임이 실린 access 토큰을 다시
 * 내주는 데까지다.
 */
@Service
public class WorkspaceService {

    private static final Logger log = LoggerFactory.getLogger(WorkspaceService.class);

    private final UserWorkspaceMembershipRepository membershipRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserSessionService sessionService;
    private final SessionIssuer sessionIssuer;

    public WorkspaceService(
            UserWorkspaceMembershipRepository membershipRepository,
            WorkspaceRepository workspaceRepository,
            UserSessionService sessionService,
            SessionIssuer sessionIssuer) {
        this.membershipRepository = membershipRepository;
        this.workspaceRepository = workspaceRepository;
        this.sessionService = sessionService;
        this.sessionIssuer = sessionIssuer;
    }

    /** 내 소속 목록. 들어갈 수 없는 것도 상태와 함께 돌려준다. 화면이 이유를 보여줘야 한다. */
    @Transactional(readOnly = true)
    public List<UserWorkspaceMembership> listMemberships(UUID userId) {
        return membershipRepository.findAllByUserIdWithWorkspace(userId);
    }

    /**
     * 회사를 고른다.
     *
     * <p>소속을 <b>이 시점에 다시 확인한다.</b> 로그인할 때 확인해 두고 넘어가면, 그 사이 소속이
     * 회수돼도 세션이 살아 있는 동안 계속 들어갈 수 있다. 세션에 담긴 값을 믿고 스키마를 열면
     * 안 되는 것과 같은 이유다.
     *
     * <p>이메일이 확인되지 않은 계정은 막는다. 오타로 남의 주소를 적은 계정이 회사 데이터를
     * 보게 되는 경로다.
     *
     * @param sessionId access 토큰의 {@code sid} 클레임. 지금 이 기기의 세션에만 적용된다.
     */
    @Transactional
    public LoginResponse select(User user, UUID sessionId, Long workspaceId, Instant now) {
        if (!user.isEmailVerified()) {
            throw new WorkspaceAccessDeniedException("이메일 확인이 필요합니다");
        }

        // 서버 운영자는 소속 없이 어느 회사에나 들어간다. 지원·장애 대응을 하려면 고객이
        // 보는 화면을 그대로 봐야 하는데, 그때마다 초대를 받아 정식 멤버가 되는 것은
        // 성격이 다르다(회사 구성원 목록에 남는다).
        if (user.isInternalAdmin()) {
            return selectAsInternalAdmin(user, sessionId, workspaceId, now);
        }

        UserWorkspaceMembership membership =
                membershipRepository
                        .findByUserIdAndWorkspaceIdWithWorkspace(user.getId(), workspaceId)
                        .orElseThrow(() -> new WorkspaceAccessDeniedException("접근할 수 없는 회사입니다"));

        if (!membership.isEnterable()) {
            // 소속이 죽었는지 회사가 죽었는지는 구분해서 알려 준다. 자기 소속 정보라 감출 것이
            // 없고, 사용자가 누구에게 문의해야 하는지가 달라진다.
            throw new WorkspaceAccessDeniedException(
                    membership.getStatus().isEnterable()
                            ? "지금 이용할 수 없는 회사입니다"
                            : "이 회사에 대한 접근 권한이 없습니다");
        }

        UserSession session = sessionService.requireActive(user.getId(), sessionId, now);
        session.selectWorkspace(workspaceId);
        return sessionIssuer.reissueAccessToken(session, now);
    }

    /**
     * 서버 운영자의 진입. 소속을 보지 않는다.
     *
     * <p>상태로는 막지 않는다. 중지·해지된 회사일수록 들여다볼 이유가 생기고, "지금 못 들어가는
     * 회사" 를 조사하지 못하면 지원 도구로서 쓸모가 없다. 다만 <b>스키마가 아직 없는 회사</b>는
     * 예외다 — 열 것이 없어서 들어가도 아무것도 못 한다.
     *
     * <p>고객 데이터에 들어가는 경로이므로 반드시 기록을 남긴다. 접근 자체보다 누가 언제
     * 어디에 들어갔는지 모르는 것이 위험하다. 지금은 애플리케이션 로그뿐이고, 조회 가능한
     * 감사 테이블은 별도 작업으로 남아 있다.
     */
    private LoginResponse selectAsInternalAdmin(
            User user, UUID sessionId, Long workspaceId, Instant now) {
        Workspace workspace =
                workspaceRepository
                        .findById(workspaceId)
                        .orElseThrow(() -> new WorkspaceAccessDeniedException("접근할 수 없는 회사입니다"));

        if (workspace.getSchemaName() == null) {
            throw new WorkspaceAccessDeniedException("아직 개설되지 않은 회사입니다");
        }

        UserSession session = sessionService.requireActive(user.getId(), sessionId, now);
        session.selectWorkspace(workspaceId);

        log.warn(
                "운영자 진입 — 사용자 {} 가 워크스페이스 {}({}, 상태 {}) 에 소속 없이 들어갔다. 세션 {}",
                user.getId(),
                workspaceId,
                workspace.getName(),
                workspace.getStatus().dbValue(),
                sessionId);

        return sessionIssuer.reissueAccessToken(session, now);
    }
}
