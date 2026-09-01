package com.axcore.workspace.workspace.dto;

import com.axcore.workspace.workspace.entity.WorkspaceInvitation;

import java.time.Instant;

/**
 * 링크를 열었을 때 보여 줄 정보.
 *
 * <p>로그인 전에도 부를 수 있어야 한다. 링크를 받은 사람은 아직 가입하지 않았을 수 있고, 그
 * 사람에게 "어느 회사의 초대인지" 를 먼저 보여 줘야 가입할지 판단할 수 있다.
 *
 * <p>회사 이름과 대상 주소까지만 담는다. 사업자번호 · 연락처 같은 것은 링크만 가진 사람에게
 * 보여 줄 이유가 없다.
 *
 * @param email 이 주소로 가입한 계정만 수락할 수 있다. 화면이 안내에 쓴다
 */
public record InvitationPreviewResponse(
        Long workspaceId, String workspaceName, String email, Instant expiresAt) {

    public static InvitationPreviewResponse from(WorkspaceInvitation invitation) {
        return new InvitationPreviewResponse(
                invitation.getWorkspace().getId(),
                invitation.getWorkspace().getName(),
                invitation.getEmail(),
                invitation.getExpiresAt());
    }
}
