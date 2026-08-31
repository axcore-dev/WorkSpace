package com.axcore.workspace.oauth;

import com.axcore.workspace.user.entity.AuthProvider;

/**
 * 제공자가 이메일을 주지 않았다.
 *
 * <p>동의 화면에서 이메일 제공을 거절하면 이렇게 된다. 이메일 없이 계정을 만들 수는 없다 —
 * {@code users.email} 이 NOT NULL 이고 유니크이며, 무엇보다 이메일이 없으면 비밀번호 재설정도
 * 알림도 보낼 수 없어 계정을 잃으면 되찾을 방법이 없다.
 *
 * <p>제공자 식별자만으로 계정을 만드는 길을 열지 않는 이유가 그것이다. 만들 수는 있지만
 * 되찾을 수 없는 계정을 만들어 주는 셈이 된다.
 */
public class SocialEmailUnavailableException extends RuntimeException {

    public SocialEmailUnavailableException(AuthProvider provider) {
        super(
                "%s 계정에서 이메일을 받지 못했습니다. 이메일 제공에 동의해 주세요"
                        .formatted(displayName(provider)));
    }

    private static String displayName(AuthProvider provider) {
        return provider == AuthProvider.GOOGLE ? "Google" : "네이버";
    }
}
