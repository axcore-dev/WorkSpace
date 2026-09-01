package com.axcore.workspace.oauth.client;

import com.axcore.workspace.oauth.*;
import com.axcore.workspace.oauth.exception.OAuthExchangeException;
import com.axcore.workspace.oauth.exception.OAuthNotConfiguredException;
import com.axcore.workspace.oauth.exception.SocialEmailUnavailableException;
import com.axcore.workspace.oauth.exception.SocialLinkBlockedException;
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
 * 네이버 아이디로 로그인.
 *
 * <p>{@link GoogleOAuthClient} 와 같은 두 단계다 — code 를 access 토큰으로 바꾸고, 그 토큰으로
 * 프로필을 읽는다. 다만 네이버는 네 군데에서 다르게 동작하고, 그 차이가 이 클래스의 내용
 * 전부다.
 *
 * <ol>
 *   <li><b>실패해도 HTTP 200 이다.</b> 본문에 {@code error} 를 담아 보낸다. 상태 코드만 보면
 *       성공으로 읽히므로 {@code RestClientException} 을 기다리면 안 된다. 본문을 봐야 한다.
 *   <li><b>토큰 요청에 {@code state} 가 필요하다.</b> 대신 {@code redirect_uri} 는 보내지 않는다.
 *       Google 과 정반대다.
 *   <li><b>프로필 응답이 한 겹 감싸여 있다.</b> {@code resultcode} 가 {@code "00"} 이 아니면
 *       실패이고, 실제 값은 {@code response} 안에 있다.
 *   <li><b>{@code email_verified} 에 해당하는 값이 없다.</b> 아래 참고.
 * </ol>
 *
 * <p><b>이메일을 확인되지 않은 것으로 취급한다.</b> 네이버는 이 이메일의 소유가 확인됐는지
 * 알려 주지 않는다. 네이버가 회원 이메일을 바꿀 때 인증 메일을 보내므로 실제로는 검증된
 * 주소일 가능성이 높지만, 그것은 우리 쪽 추측이지 네이버가 API 로 한 보증이 아니다. 추측을
 * 근거로 기존 계정에 자동 연결하면, 그 추측이 틀린 날 계정 탈취가 된다.
 *
 * <p>그 대가로 <b>이미 이메일로 가입한 사용자는 네이버 버튼으로 그 계정에 붙지 못한다</b>
 * ({@link SocialLinkBlockedException}). 네이버로 처음 가입하는 것은 되며, 이때는 우리가 확인
 * 메일을 보낸다({@link com.axcore.workspace.user.service.SocialAccountLinker}). 기존 계정
 * 연결은 로그인한 사용자가 설정에서 직접 누르는 경로로 여는 것이 맞고, 그 기능이 붙으면 이
 * 제약은 실질적으로 사라진다.
 *
 * <p>scope 를 보내지 않는다. 네이버는 제공받을 항목을 인증 URL 이 아니라 개발자센터의 애플리케이션
 * 설정에서 정한다. <b>거기서 "이메일 주소" 를 필수로 체크해야</b> 하고, 그러지 않으면 사용자가
 * 동의 화면에서 이메일 제공을 거절할 수 있어 {@link SocialEmailUnavailableException} 이 난다.
 */
@Component
public class NaverOAuthClient implements OAuthClient {

    private static final Logger log = LoggerFactory.getLogger(NaverOAuthClient.class);

    private static final String TOKEN_URI = "https://nid.naver.com/oauth2.0/token";
    private static final String USER_INFO_URI = "https://openapi.naver.com/v1/nid/me";

    /** 프로필 조회가 성공했을 때의 값. 그 외는 전부 실패다. */
    private static final String RESULT_OK = "00";

    private final RestClient restClient;
    private final OAuthProperties properties;

    public NaverOAuthClient(RestClient oauthRestClient, OAuthProperties properties) {
        this.restClient = oauthRestClient;
        this.properties = properties;
    }

    @Override
    public AuthProvider provider() {
        return AuthProvider.NAVER;
    }

    @Override
    public OAuthUserInfo fetchUserInfo(String code, String state) {
        OAuthProperties.Registration registration =
                properties
                        .registration(AuthProvider.NAVER)
                        .orElseThrow(() -> new OAuthNotConfiguredException(AuthProvider.NAVER));

        String accessToken = exchangeCode(code, state, registration);
        NaverProfile profile = requestProfile(accessToken);

        if (profile.id() == null || profile.id().isBlank()) {
            // 이을 키가 없다. 이메일로 대신 잇는 경로를 만들면 안 된다.
            throw new OAuthExchangeException("네이버 응답에 사용자 식별자(id)가 없습니다");
        }
        return new OAuthUserInfo(
                AuthProvider.NAVER,
                profile.id(),
                profile.email(),
                // 위 클래스 주석 참고. 네이버는 이 값을 주지 않으므로 확인되지 않은 것으로 둔다.
                false,
                profile.displayName(),
                profile.profileImage());
    }

    private String exchangeCode(
            String code, String state, OAuthProperties.Registration registration) {

        if (state == null || state.isBlank()) {
            // 네이버는 이 값을 요구한다. FE 가 인증을 시작할 때 만들어 콜백까지 들고 오므로,
            // 비어 있다면 정상 흐름을 거치지 않은 요청이다.
            log.warn("네이버 토큰 요청에 state 가 없다. FE 로그인 흐름을 거치지 않은 요청이다");
            throw new OAuthExchangeException("네이버 인증에 실패했습니다");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", registration.clientId());
        form.add("client_secret", registration.clientSecret());
        form.add("code", code);
        // 인증을 시작할 때 쓴 값과 같아야 한다. redirect_uri 는 보내지 않는다 — 네이버의 토큰
        // 요청 규격에 없는 값이고, 대조는 네이버가 code 를 발급할 때 이미 끝났다.
        form.add("state", state);

        TokenResponse response;
        try {
            response =
                    restClient
                            .post()
                            .uri(TOKEN_URI)
                            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                            .body(form)
                            .retrieve()
                            .body(TokenResponse.class);
        } catch (RestClientException e) {
            log.warn("네이버 authorization code 교환 실패", e);
            throw new OAuthExchangeException("네이버 인증에 실패했습니다", e);
        }

        if (response == null) {
            throw new OAuthExchangeException("네이버 토큰 응답이 비어 있습니다");
        }
        if (response.hasError()) {
            // 여기가 네이버와 Google 이 갈리는 지점이다. 네이버는 거절도 200 으로 돌려주므로
            // 위 catch 에 걸리지 않는다. 이 검사가 없으면 accessToken 이 null 인 채로 흘러간다.
            //
            // error_description 을 응답에 싣지 않는다. 사용자가 할 수 있는 일은 재시도뿐이고,
            // 그대로 흘리면 제공자 응답을 탐색하는 통로가 된다.
            log.warn(
                    "네이버 authorization code 교환 거절. error={} description={}",
                    response.error(),
                    response.errorDescription());
            throw new OAuthExchangeException("네이버 인증에 실패했습니다");
        }
        if (response.accessToken() == null || response.accessToken().isBlank()) {
            throw new OAuthExchangeException("네이버 토큰 응답에 access 토큰이 없습니다");
        }
        return response.accessToken();
    }

    private NaverProfile requestProfile(String accessToken) {
        ProfileResponse response;
        try {
            response =
                    restClient
                            .get()
                            .uri(USER_INFO_URI)
                            .header("Authorization", "Bearer " + accessToken)
                            .retrieve()
                            .body(ProfileResponse.class);
        } catch (RestClientException e) {
            log.warn("네이버 프로필 조회 실패", e);
            throw new OAuthExchangeException("네이버 인증에 실패했습니다", e);
        }

        if (response == null) {
            throw new OAuthExchangeException("네이버 프로필 응답이 비어 있습니다");
        }
        // resultcode 를 response 의 null 검사보다 먼저 본다. 네이버는 조회에 실패하면 response
        // 를 통째로 빼고 resultcode·message 만 보내기 때문에, 순서가 반대면 "비어 있습니다" 로
        // 뭉개져 실패 이유가 로그에 남지 않는다.
        if (!RESULT_OK.equals(response.resultcode())) {
            // 프로필 조회도 200 으로 실패를 돌려준다. resultcode 를 보지 않으면 빈 값이 흘러간다.
            log.warn(
                    "네이버 프로필 조회 거절. resultcode={} message={}",
                    response.resultcode(),
                    response.message());
            throw new OAuthExchangeException("네이버 인증에 실패했습니다");
        }
        if (response.response() == null) {
            throw new OAuthExchangeException("네이버 프로필 응답이 비어 있습니다");
        }

        NaverProfile profile = response.response();
        // 어느 항목이 실제로 왔는지 남긴다. 제공 항목 설정과 사용자 동의 범위에 따라 달라지는데,
        // 이것이 없으면 "이메일이 없다" 는 사실만 알고 그 이유를 알 수 없다.
        //
        // 값이 아니라 있음/없음만 찍는다. 이메일·이름은 개인정보이므로 로그에 남기지 않는다.
        //   email=false            → 네이버 쪽 문제다. 제공 항목 동의 범위이거나, 네이버 회원정보의
        //                            연락처 이메일 주소가 비어 있다
        //   전부 false             → 우리 파싱 문제다. 응답 구조가 바뀌었는지 본다
        log.info(
                "네이버 프로필 수신. id={} email={} name={} nickname={} profileImage={}",
                has(profile.id()),
                has(profile.email()),
                has(profile.name()),
                has(profile.nickname()),
                has(profile.profileImage()));
        return profile;
    }

    /** 로그에 값을 남기지 않기 위한 것. 어느 필드가 왔는지만 본다. */
    private static boolean has(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * 토큰 응답.
     *
     * <p>성공과 실패가 같은 모양(200)으로 오기 때문에 두 경우의 필드를 한 레코드에 담는다.
     * {@code refresh_token} 도 오지만 받지 않는다 — 제공자 자원에 접근하지 않으므로 저장할
     * 이유가 없고, 쓰지 않는 값을 필드로 두면 저장하고 싶어진다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record TokenResponse(
            @JsonProperty("access_token") String accessToken,
            String error,
            @JsonProperty("error_description") String errorDescription) {

        boolean hasError() {
            return error != null && !error.isBlank();
        }
    }

    /** 프로필 응답의 바깥 껍데기. 실제 값은 {@code response} 안에 있다. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ProfileResponse(String resultcode, String message, NaverProfile response) {}

    /**
     * 프로필 응답의 알맹이.
     *
     * <p>{@code name} 은 실명이라 제공 항목에서 빠져 있을 수 있다. 그때는 {@code nickname} 을
     * 쓴다. 둘 다 없으면 {@link OAuthUserInfo#displayName()} 이 이메일 앞부분으로 대신한다.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record NaverProfile(
            String id,
            String email,
            String name,
            String nickname,
            @JsonProperty("profile_image") String profileImage) {

        String displayName() {
            return name != null && !name.isBlank() ? name : nickname;
        }
    }
}
