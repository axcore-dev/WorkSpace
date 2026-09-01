package com.axcore.workspace.user.service;

import com.axcore.workspace.oauth.client.OAuthClient;
import com.axcore.workspace.oauth.config.OAuthConfig.OAuthClientRegistry;
import com.axcore.workspace.oauth.exception.OAuthNotConfiguredException;
import com.axcore.workspace.oauth.OAuthUserInfo;
import com.axcore.workspace.user.dto.LoginResponse;
import com.axcore.workspace.user.entity.AuthProvider;
import com.axcore.workspace.user.entity.User;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * 소셜 로그인. 이메일 로그인의 {@link AuthService#login} 과 같은 자리에 있다.
 *
 * <p>흐름은 이렇다. FE 가 제공자로부터 받은 authorization code 를 넘기고, 여기서 그 code 를
 * 사용자 정보로 바꾸고({@link OAuthClient}), 우리 계정과 잇고({@link SocialAccountLinker}),
 * 세션을 발급한다({@link SessionIssuer}).
 *
 * <p><b>2단계 인증을 건너뛰지 않는다.</b> 소셜로 들어왔다고 면제하면, 2단계를 켜 둔 사용자의
 * 방어가 "Google 로 로그인" 버튼 하나로 사라진다. 공격자가 그 사람의 Google 계정을 쥐고 있는
 * 상황이 바로 2단계가 막으려는 상황이다.
 *
 * <p>이 클래스는 {@code @Transactional} 이 아니다. 제공자 왕복이 네트워크 호출 두 번이고, 그
 * 동안 DB 커넥션을 잡고 있으면 제공자가 느려질 때 커넥션 풀이 먼저 마른다. DB 작업은
 * {@link SocialAccountLinker} 와 {@link SessionIssuer} 안의 트랜잭션에서 일어난다.
 */
@Service
public class SocialLoginService {

    private final OAuthClientRegistry clients;
    private final SocialAccountLinker linker;
    private final SessionIssuer sessionIssuer;
    private final MfaService mfaService;

    public SocialLoginService(
            OAuthClientRegistry clients,
            SocialAccountLinker linker,
            SessionIssuer sessionIssuer,
            MfaService mfaService) {
        this.clients = clients;
        this.linker = linker;
        this.sessionIssuer = sessionIssuer;
        this.mfaService = mfaService;
    }

    public AuthResult login(
            AuthProvider provider,
            String code,
            String state,
            boolean rememberMe,
            String userAgent,
            String ip) {

        OAuthClient client =
                clients.find(provider)
                        .orElseThrow(() -> new OAuthNotConfiguredException(provider));

        // 네트워크 호출. 트랜잭션 밖이다.
        OAuthUserInfo info = client.fetchUserInfo(code, state);

        Instant now = Instant.now();
        User user = linker.resolve(info, now);

        if (sessionIssuer.requiresMfa(user)) {
            String challengeToken = mfaService.startLoginChallenge(user, rememberMe, now);
            return AuthResult.pending(LoginResponse.mfaRequired(challengeToken));
        }
        return sessionIssuer.issueNewSession(user, rememberMe, userAgent, ip, now);
    }
}
