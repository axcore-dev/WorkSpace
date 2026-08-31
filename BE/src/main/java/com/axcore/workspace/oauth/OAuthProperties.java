package com.axcore.workspace.oauth;

import com.axcore.workspace.user.entity.AuthProvider;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.Map;
import java.util.Optional;

/**
 * 소셜 로그인 제공자 설정. {@code app.oauth.*} 로 주입된다.
 *
 * <p>제공자를 맵으로 받는 이유는 네이버가 곧 같은 모양으로 들어오기 때문이다. 제공자마다
 * 클래스를 따로 두면 설정 클래스가 제공자 수만큼 늘어난다.
 *
 * <p>설정이 없는 제공자는 <b>비활성</b>이다. 부팅을 막지 않는다 — Google 을 아직 발급받지 않은
 * 개발자도 서버를 띄울 수 있어야 하고, 그 상태에서 Google 로그인을 시도하면 그때 503 이 난다.
 * 반대로 부팅에서 막으면 소셜 로그인을 쓰지 않는 사람까지 자격증명을 만들어야 한다.
 *
 * @param providers 제공자별 설정. 키는 {@code google} · {@code naver} 다.
 */
@ConfigurationProperties(prefix = "app.oauth")
public record OAuthProperties(@DefaultValue Map<String, Registration> providers) {

    /**
     * @param clientId     제공자 콘솔에서 발급받은 클라이언트 ID. 공개돼도 되는 값이라 FE 도 같은
     *                     값을 갖는다(인증 URL 을 만들 때 필요하다).
     * @param clientSecret 클라이언트 시크릿. <b>BE 에만 있어야 한다.</b> 이 값이 있으면 임의의
     *                     authorization code 를 토큰으로 바꿀 수 있다. 그래서 FE 가 code 만 받아
     *                     넘기고 교환은 서버가 한다.
     * @param redirectUri  제공자 콘솔에 등록한 값과 <b>문자 단위로 같아야 한다.</b> 다르면 제공자가
     *                     {@code redirect_uri_mismatch} 로 거절한다. code 를 받는 주체가 FE 이므로
     *                     FE 주소다 — API 주소가 아니다.
     */
    public record Registration(String clientId, String clientSecret, String redirectUri) {

        /** 세 값이 모두 채워져 있을 때만 쓸 수 있다. 하나라도 비면 설정하지 않은 것으로 본다. */
        public boolean isConfigured() {
            return hasText(clientId) && hasText(clientSecret) && hasText(redirectUri);
        }

        private static boolean hasText(String value) {
            return value != null && !value.isBlank();
        }
    }

    public Optional<Registration> registration(AuthProvider provider) {
        return Optional.ofNullable(providers.get(provider.dbValue()))
                .filter(Registration::isConfigured);
    }
}
