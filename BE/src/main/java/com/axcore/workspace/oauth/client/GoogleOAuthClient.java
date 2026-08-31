package com.axcore.workspace.oauth.client;

import com.axcore.workspace.oauth.*;
import com.axcore.workspace.oauth.exception.OAuthExchangeException;
import com.axcore.workspace.oauth.exception.OAuthNotConfiguredException;
import com.axcore.workspace.user.entity.AuthProvider;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Google 로그인.
 *
 * <p>두 번 호출한다. 토큰 엔드포인트에 code 를 주고 access 토큰을 받은 뒤, userinfo 엔드포인트에서
 * 사용자 정보를 읽는다.
 *
 * <p>토큰 응답에는 {@code id_token}(JWT)도 함께 들어 있고 그 안에 사용자 정보가 이미 있다.
 * 그런데도 userinfo 를 한 번 더 부르는 이유는 네이버 때문이다. 네이버는 OIDC 제공자가 아니라
 * {@code id_token} 을 주지 않는다. 두 제공자가 같은 모양으로 처리되면 계정 연결 로직이 제공자를
 * 몰라도 되고, 세 번째 제공자가 붙을 때도 이 파일 하나만 늘어난다. 왕복 한 번이 그 값을 한다.
 *
 * <p>서명 검증을 하지 않는 것이 아니다. code 를 토큰으로 바꾸는 요청 자체가 클라이언트 시크릿을
 * 실어 Google 과 직접 TLS 로 통신한 결과이므로, 그 응답으로 받은 access 토큰으로 조회한 정보는
 * 중간에 끼어들 여지가 없다. (OIDC Core 3.1.3.7 — code flow 에서 토큰 엔드포인트 응답은
 * 서명 검증 없이 신뢰할 수 있다)
 */
@Component
public class GoogleOAuthClient implements OAuthClient {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthClient.class);

    private static final String TOKEN_URI = "https://oauth2.googleapis.com/token";
    private static final String USER_INFO_URI = "https://openidconnect.googleapis.com/v1/userinfo";

    private final RestClient restClient;
    private final OAuthProperties properties;

    public GoogleOAuthClient(RestClient oauthRestClient, OAuthProperties properties) {
        this.restClient = oauthRestClient;
        this.properties = properties;
    }

    @Override
    public AuthProvider provider() {
        return AuthProvider.GOOGLE;
    }

    /**
     * {@code state} 는 쓰지 않는다. Google 의 토큰 엔드포인트는 이 값을 받지 않는다 — code 와
     * redirect_uri 의 대조로 충분하다. 네이버가 요구해서 인터페이스에만 있는 값이다.
     */
    @Override
    public OAuthUserInfo fetchUserInfo(String code, String state) {
        OAuthProperties.Registration registration =
                properties
                        .registration(AuthProvider.GOOGLE)
                        .orElseThrow(
                                () ->
                                        new OAuthNotConfiguredException(
                                                AuthProvider.GOOGLE));

        String accessToken = exchangeCode(code, registration);
        GoogleUserInfo info = requestUserInfo(accessToken);

        if (info.sub() == null || info.sub().isBlank()) {
            // sub 이 없으면 이을 키가 없다. 이메일로 대신 잇는 경로를 만들면 안 된다.
            throw new OAuthExchangeException("Google 응답에 사용자 식별자(sub)가 없습니다");
        }
        return new OAuthUserInfo(
                AuthProvider.GOOGLE,
                info.sub(),
                info.email(),
                info.emailVerified(),
                info.name(),
                info.picture());
    }

    private String exchangeCode(String code, OAuthProperties.Registration registration) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", registration.clientId());
        form.add("client_secret", registration.clientSecret());
        // 코드를 발급받을 때 쓴 값과 같아야 한다. Google 이 대조한다 — 다른 앱이 가로챈 코드를
        // 자기 redirect_uri 로 교환하는 것을 막는 장치다.
        form.add("redirect_uri", registration.redirectUri());
        form.add("grant_type", "authorization_code");

        try {
            TokenResponse response =
                    restClient
                            .post()
                            .uri(TOKEN_URI)
                            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                            .body(form)
                            .retrieve()
                            .body(TokenResponse.class);

            if (response == null || response.accessToken() == null) {
                throw new OAuthExchangeException("Google 토큰 응답이 비어 있습니다");
            }
            return response.accessToken();
        } catch (RestClientException e) {
            // 본문에 error_description 이 있지만 응답으로 내보내지 않는다. 사용자가 할 수 있는
            // 일은 재시도뿐이고, 그대로 흘리면 제공자 응답을 탐색하는 통로가 된다.
            log.warn("Google authorization code 교환 실패", e);
            throw new OAuthExchangeException("Google 인증에 실패했습니다", e);
        }
    }

    private GoogleUserInfo requestUserInfo(String accessToken) {
        try {
            GoogleUserInfo info =
                    restClient
                            .get()
                            .uri(USER_INFO_URI)
                            .header("Authorization", "Bearer " + accessToken)
                            .retrieve()
                            .body(GoogleUserInfo.class);

            if (info == null) {
                throw new OAuthExchangeException("Google 사용자 정보 응답이 비어 있습니다");
            }
            return info;
        } catch (RestClientException e) {
            log.warn("Google 사용자 정보 조회 실패", e);
            throw new OAuthExchangeException("Google 인증에 실패했습니다", e);
        }
    }

    /**
     * 토큰 응답. {@code id_token}·{@code refresh_token} 도 오지만 받지 않는다 — 쓰지 않는 값을
     * 필드로 두면 저장하고 싶어진다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TokenResponse(@JsonProperty("access_token") String accessToken) {}

    /**
     * userinfo 응답.
     *
     * <p>{@code email_verified} 를 {@code Boolean} 으로 받고 null 을 false 로 접는다. 필드가 아예
     * 오지 않는 경우가 있고, 그때 확인된 것으로 취급하면 미확인 주소가 기존 계정에 자동 연결된다.
     * 없으면 확인되지 않은 것이다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record GoogleUserInfo(
            String sub,
            String email,
            @JsonProperty("email_verified") Boolean emailVerifiedRaw,
            String name,
            String picture) {

        boolean emailVerified() {
            return Boolean.TRUE.equals(emailVerifiedRaw);
        }
    }
}
