package com.axcore.workspace.connector;

import com.axcore.workspace.oauth.OAuthProperties;
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
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 구글 OAuth — <b>연동용</b>. 소셜 로그인의 {@code GoogleOAuthClient} 와 같은 제공자지만 다른 일을 한다.
 *
 * <p>로그인은 "이 사람이 누구인가" 만 알면 되니 access 토큰을 받는 즉시 버린다. 연동은 반대다 — 토큰을
 * <b>보관하고 갱신</b>해야 하므로 {@code access_type=offline} 로 refresh 토큰을 받고, 앱을 하나씩 더할 때
 * {@code include_granted_scopes=true} 로 스코프를 쌓는다(구글의 incremental authorization).
 *
 * <p>{@code prompt=consent} 를 늘 붙인다. 구글은 두 번째 동의부터 refresh 토큰을 주지 않는데, 스코프를
 * 더하며 다시 동의받는 자리에서 refresh 토큰이 빠지면 첫 토큰이 만료된 뒤 갱신할 수단이 없다.
 *
 * <p>자격증명(client id · secret)은 소셜 로그인과 같은 것을 쓴다({@code app.oauth.providers.google}). 콜백 주소는 다르다 —
 * 연동 화면 자체로 돌려보내서 중간 페이지가 없다({@code app.connector.google-redirect-uri}). 구글 콘솔에 그 주소가
 * 등록돼 있어야 한다. state 는 서버가 서명한다({@link ConnectorStateCodec}).
 */
@Component
public class GoogleConnector {

    private static final Logger log = LoggerFactory.getLogger(GoogleConnector.class);

    private static final String AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URI = "https://oauth2.googleapis.com/token";
    private static final String REVOKE_URI = "https://oauth2.googleapis.com/revoke";
    private static final String USER_INFO_URI = "https://openidconnect.googleapis.com/v1/userinfo";
    /** 연결한 계정 이메일을 화면에 보이기 위한 최소 스코프. 앱 스코프에 늘 덧붙인다 */
    private static final String EMAIL_SCOPE = "email";

    private final RestClient rest;
    private final OAuthProperties oauth;
    private final ConnectorProperties connector;

    public GoogleConnector(RestClient oauthRestClient, OAuthProperties oauth, ConnectorProperties connector) {
        this.rest = oauthRestClient;
        this.oauth = oauth;
        this.connector = connector;
    }

    /** 교환 · 갱신 결과. {@code refreshToken} 은 없을 수 있다(구글은 첫 동의에만 준다) */
    public record Tokens(String accessToken, String refreshToken, Instant expiresAt, Set<String> scopes) {}

    public String authorizeUrl(Set<String> scopes, String state) {
        OAuthProperties.Registration reg = registration();
        Set<String> all = new LinkedHashSet<>(scopes);
        all.add(EMAIL_SCOPE);
        return UriComponentsBuilder.fromUriString(AUTH_URI)
                .queryParam("client_id", reg.clientId())
                .queryParam("redirect_uri", redirectUri(reg))
                .queryParam("response_type", "code")
                .queryParam("scope", String.join(" ", all))
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("include_granted_scopes", "true")
                .queryParam("state", state)
                .encode()
                .toUriString();
    }

    public Tokens exchange(String code) {
        OAuthProperties.Registration reg = registration();
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", reg.clientId());
        form.add("client_secret", reg.clientSecret());
        form.add("redirect_uri", redirectUri(reg));
        form.add("grant_type", "authorization_code");
        return tokens(form, "구글 인증 코드 교환");
    }

    public Tokens refresh(String refreshToken) {
        OAuthProperties.Registration reg = registration();
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("refresh_token", refreshToken);
        form.add("client_id", reg.clientId());
        form.add("client_secret", reg.clientSecret());
        form.add("grant_type", "refresh_token");
        return tokens(form, "구글 토큰 갱신");
    }

    /** 제공자 쪽에서도 끊는다. 실패해도 우리 행은 지운다 — 부르는 쪽이 그렇게 다룬다. */
    public void revoke(String token) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("token", token);
        try {
            rest.post().uri(REVOKE_URI).contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().toBodilessEntity();
        } catch (RestClientException e) {
            // 이미 회수된 토큰이면 구글이 400 을 낸다. 어느 쪽이든 결과는 같다
            log.info("구글 토큰 회수 응답이 정상이 아니다. 우리 쪽 기록은 지운다: {}", e.getMessage());
        }
    }

    /** 연결한 계정이 누구인지 — 화면의 「연결됨 · someone@gmail.com」 */
    public String email(String accessToken) {
        try {
            UserInfo info =
                    rest.get().uri(USER_INFO_URI).header("Authorization", "Bearer " + accessToken).retrieve().body(UserInfo.class);
            return info == null ? null : info.email();
        } catch (RestClientException e) {
            log.warn("구글 계정 정보를 읽지 못했다. 이메일 없이 저장한다", e);
            return null;
        }
    }

    private Tokens tokens(MultiValueMap<String, String> form, String what) {
        try {
            TokenResponse r =
                    rest.post().uri(TOKEN_URI).contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(TokenResponse.class);
            if (r == null || r.accessToken() == null) {
                throw new ConnectorProviderException(what + " 응답이 비어 있습니다");
            }
            Instant expiresAt = r.expiresIn() == null ? null : Instant.now().plus(Duration.ofSeconds(r.expiresIn()));
            Set<String> scopes =
                    r.scope() == null ? Set.of() : new LinkedHashSet<>(Arrays.asList(r.scope().trim().split("\\s+")));
            return new Tokens(r.accessToken(), r.refreshToken(), expiresAt, scopes);
        } catch (RestClientException e) {
            log.warn("{} 실패", what, e);
            throw new ConnectorProviderException(what + "에 실패했습니다", e);
        }
    }

    private OAuthProperties.Registration registration() {
        return oauth.registration(AuthProvider.GOOGLE)
                .orElseThrow(() -> new ConnectorUnavailableException("구글 자격증명(GOOGLE_CLIENT_ID · SECRET)이 설정되지 않았습니다"));
    }

    private String redirectUri(OAuthProperties.Registration reg) {
        return connector.googleRedirectUri().isBlank() ? reg.redirectUri() : connector.googleRedirectUri();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("refresh_token") String refreshToken,
            @JsonProperty("expires_in") Long expiresIn,
            @JsonProperty("scope") String scope) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record UserInfo(String email) {}
}
