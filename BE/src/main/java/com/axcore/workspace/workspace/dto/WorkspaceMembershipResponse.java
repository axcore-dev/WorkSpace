package com.axcore.workspace.workspace.dto;

import com.axcore.workspace.workspace.entity.UserWorkspaceMembership;
import com.axcore.workspace.workspace.entity.Workspace;

/**
 * 회사 선택 화면의 항목 하나.
 *
 * <p>{@code schemaName} 은 내보내지 않는다. 화면이 쓸 일이 없고, {@code search_path} 에 조립되는
 * 값이라 밖으로 돌아다니게 두지 않는다.
 *
 * @param enterable      지금 들어갈 수 있는가. 소속과 회사 상태를 모두 반영한 결과다.
 *                       화면이 두 상태를 각자 해석해 판단이 갈리지 않도록 서버가 계산해 준다.
 * @param membershipStatus 들어갈 수 없을 때 이유를 보여주기 위한 값
 */
public record WorkspaceMembershipResponse(
        Long id,
        String name,
        String plan,
        String workspaceStatus,
        String membershipStatus,
        boolean enterable) {

    public static WorkspaceMembershipResponse from(UserWorkspaceMembership membership) {
        Workspace workspace = membership.getWorkspace();
        return new WorkspaceMembershipResponse(
                workspace.getId(),
                workspace.getName(),
                workspace.getPlan(),
                workspace.getStatus().dbValue(),
                membership.getStatus().dbValue(),
                membership.isEnterable());
    }
}
