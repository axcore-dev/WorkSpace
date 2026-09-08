package com.axcore.workspace.workspace.settings;

/**
 * 회사에는 들어왔지만 이 작업을 할 직급이 아니다. 403.
 *
 * <p>{@code WorkspaceAccessDeniedException}(회사 자체에 못 들어감)과 다르다. 그쪽은 "누구에게 문의할지" 가
 * 갈리는 정보고, 이쪽은 "당신 직급으로는 안 된다" 다. 화면은 이 응답을 받으면 버튼을 잠근 채로 두면 된다.
 */
public class SettingsForbiddenException extends RuntimeException {

    public SettingsForbiddenException(String message) {
        super(message);
    }
}
