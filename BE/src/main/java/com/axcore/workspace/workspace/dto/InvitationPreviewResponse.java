package com.axcore.workspace.workspace.dto;

import com.axcore.workspace.user.entity.AuthProvider;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserIdentity;
import com.axcore.workspace.workspace.entity.WorkspaceInvitation;

import java.time.Instant;
import java.util.List;

/**
 * 링크를 열었을 때 보여 줄 정보.
 *
 * <p>로그인 전에도 부를 수 있어야 한다. 링크를 받은 사람은 아직 가입하지 않았을 수 있고, 그
 * 사람에게 "어느 회사의 초대인지" 를 먼저 보여 줘야 가입할지 판단할 수 있다.
 *
 * <p>회사 이름과 대상 주소까지만 담는다. 사업자번호 · 연락처 같은 것은 링크만 가진 사람에게
 * 보여 줄 이유가 없다.
 *
 * <p><b>그 주소의 계정 상태는 담는다.</b> 화면이 "비밀번호를 입력하라"고 할지 "네이버로
 * 로그인하라"고 할지 정해야 하기 때문이다. 소셜로만 가입한 계정에 비밀번호 칸을 보여 주면
 * 그 사람은 어떤 값을 넣어도 401 만 받고 갈 곳이 없다. 로그인 화면은 이 정보를 숨기지만
 * ({@code AppUserDetailsService}), 여기서 받는 사람은 그 주소로 온 메일의 링크를 가진 사람 —
 * 사실상 주소의 주인이라 감수한다.
 *
 * @param email     이 주소로 가입한 계정만 수락할 수 있다. 화면이 안내에 쓴다
 * @param account   그 주소의 계정 상태
 * @param providers 연결된 소셜 제공자({@code google}·{@code naver}). 계정이 없으면 빈 목록
 */
public record InvitationPreviewResponse(
        Long workspaceId,
        String workspaceName,
        String email,
        Instant expiresAt,
        AccountState account,
        List<String> providers) {

    /** 초대 주소의 계정이 어떻게 로그인하는가. */
    public enum AccountState {
        /** 계정이 없다. 가입부터 해야 한다 */
        NONE,
        /** 비밀번호가 있다. 소셜이 함께 연결돼 있어도 비밀번호로 들어갈 수 있다 */
        PASSWORD,
        /** 소셜로만 가입했다. 비밀번호 로그인은 되지 않는다 */
        SOCIAL_ONLY
    }

    /**
     * @param account    초대 주소로 찾은 계정. 없으면 {@code null}
     * @param identities 그 계정에 연결된 소셜. 계정이 없으면 빈 목록
     */
    public static InvitationPreviewResponse from(
            WorkspaceInvitation invitation, User account, List<UserIdentity> identities) {
        List<String> providers =
                identities.stream()
                        .map(UserIdentity::getProvider)
                        .distinct()
                        .map(AuthProvider::dbValue)
                        .toList();
        return new InvitationPreviewResponse(
                invitation.getWorkspace().getId(),
                invitation.getWorkspace().getName(),
                invitation.getEmail(),
                invitation.getExpiresAt(),
                stateOf(account, providers),
                providers);
    }

    private static AccountState stateOf(User account, List<String> providers) {
        if (account == null) {
            return AccountState.NONE;
        }
        if (account.hasPassword() || providers.isEmpty()) {
            // 비밀번호도 소셜도 없는 계정은 정상 경로로는 생기지 않는다. 생겼다면 비밀번호 찾기로
            // 만들어 쓰는 수밖에 없으므로 비밀번호 쪽으로 보낸다.
            return AccountState.PASSWORD;
        }
        return AccountState.SOCIAL_ONLY;
    }
}
