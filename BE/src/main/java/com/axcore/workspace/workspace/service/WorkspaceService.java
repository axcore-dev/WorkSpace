package com.axcore.workspace.workspace.service;

import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.service.SessionIssuer;
import com.axcore.workspace.user.service.UserSessionService;
import com.axcore.workspace.workspace.entity.UserWorkspaceMembership;
import com.axcore.workspace.workspace.repository.UserWorkspaceMembershipRepository;
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

    private final UserWorkspaceMembershipRepository membershipRepository;
    private final UserSessionService sessionService;
    private final SessionIssuer sessionIssuer;

    public WorkspaceService(
            UserWorkspaceMembershipRepository membershipRepository,
            UserSessionService sessionService,
            SessionIssuer sessionIssuer) {
        this.membershipRepository = membershipRepository;
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
}
