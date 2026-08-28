package com.axcore.workspace.oauth;

import com.axcore.workspace.user.entity.AuthProvider;

/**
 * 제공자에서 받아 온 사용자 정보를 한 모양으로 맞춘 것.
 *
 * <p>제공자마다 응답 필드 이름이 다르다(Google 은 {@code sub}·{@code picture}, 네이버는
 * {@code id}·{@code profile_image}). 그 차이는 각 {@link OAuthClient} 구현체에서 흡수하고,
 * 이 뒤로는 하나의 모양만 흐른다. 계정 연결 로직이 제공자를 몰라도 되게 하는 것이 목적이다.
 *
 * @param provider       어느 제공자에서 왔는가
 * @param providerUserId 제공자의 불변 식별자. 계정 연결 키다. 이메일이 아니다
 * @param email          제공자가 알려 준 이메일. 없을 수 있다(네이버는 사용자가 동의를 거절하면
 *                       주지 않는다)
 * @param emailVerified  제공자가 이 이메일의 소유를 확인했는가. <b>기존 계정에 자동 연결할지를
 *                       가르는 값이다.</b> 확인되지 않은 주소로 자동 연결하면, 남의 주소를 적어 둔
 *                       제공자 계정으로 그 사람의 계정에 들어갈 수 있다
 * @param name           표시 이름. 없으면 이메일의 앞부분을 쓴다
 * @param avatarUrl      프로필 사진. 없을 수 있다
 */
public record OAuthUserInfo(
        AuthProvider provider,
        String providerUserId,
        String email,
        boolean emailVerified,
        String name,
        String avatarUrl) {

    public boolean hasEmail() {
        return email != null && !email.isBlank();
    }

    /**
     * 저장할 수 있는 길이의 프로필 사진 주소.
     *
     * <p>{@code users.avatar_url} 이 500자다. 넘으면 버린다 — 장식이라 저장 실패로 로그인을 막을
     * 이유가 없다. 잘라서 저장하면 깨진 주소가 남는다.
     */
    public String safeAvatarUrl() {
        return avatarUrl != null && avatarUrl.length() <= 500 ? avatarUrl : null;
    }

    /**
     * 계정을 새로 만들 때 쓸 이름.
     *
     * <p>{@code users.name} 은 NOT NULL 이고 최대 100 자다. 제공자가 이름을 주지 않는 경우가 있어
     * 빈 값이면 이메일의 앞부분으로 대신한다.
     */
    public String displayName() {
        if (name != null && !name.isBlank()) {
            return name.length() > 100 ? name.substring(0, 100) : name.strip();
        }
        if (hasEmail()) {
            String local = email.substring(0, email.indexOf('@') < 0 ? email.length() : email.indexOf('@'));
            return local.length() > 100 ? local.substring(0, 100) : local;
        }
        return provider.dbValue() + " 사용자";
    }
}
