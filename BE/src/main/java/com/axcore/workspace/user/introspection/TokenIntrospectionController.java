package com.axcore.workspace.user.introspection;

import com.axcore.workspace.security.JwtPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * 토큰 판정 엔드포인트. <b>FE 안의 AI 서버 전용이다.</b>
 *
 * <p>브라우저가 부르는 경로가 아니다. AI 서버(Next Route Handler)가 사용자의 access 토큰을 그대로
 * 넘기고, 자기가 서비스임을 {@code X-Internal-Token} 으로 증명한다. 두 겹이다 — 사용자 토큰은 일반
 * Bearer 필터를 지나야 하고({@code authenticated()}), 서비스 비밀은 서비스 안에서 대조한다.
 *
 * <p>왜 JWT 시크릿을 AI 서버에 주지 않고 이 엔드포인트를 두는가: HS256 은 대칭키라 검증할 수 있는
 * 쪽은 발급도 할 수 있다. 그리고 서명만으로는 세션 폐기와 소속 회수를 알 수 없다. 회사 기밀 문서를
 * 여는 판정은 요청 시점 DB 를 봐야 한다.
 */
@RestController
@RequestMapping("/api/auth/introspect")
public class TokenIntrospectionController {

    private final TokenIntrospectionService service;

    public TokenIntrospectionController(TokenIntrospectionService service) {
        this.service = service;
    }

    @PostMapping
    public IntrospectionResponse introspect(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-Internal-Token", required = false) String internalToken) {
        return service.introspect(
                internalToken, JwtPrincipal.of(jwt), jwt.getExpiresAt(), Instant.now());
    }
}
