package com.axcore.workspace.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * 토큰 정책. {@code app.jwt.*} 로 주입된다.
 *
 * <p>secret 은 환경변수로만 넣는다. HS256 은 대칭키라 이 값을 가진 쪽은 누구든 임의의 access
 * 토큰을 발급할 수 있다. 서명 검증만 필요한 별도 서비스가 생기면 그때 EC(ES256)로 바꾼다.
 *
 * @param accessTokenTtl      짧게 잡는 이유가 있다. JWT 는 요청마다 DB 를 안 보므로, 강제
 *                            로그아웃이 이 시간만큼 늦게 적용된다.
 * @param refreshTokenTtl     "로그인 유지" 를 켠 경우.
 * @param shortRefreshTokenTtl "로그인 유지" 를 끈 경우. 명세 2.1.2 가 공용 PC 를 고려해
 *                            기본 해제를 요구한다.
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        String secret,
        @DefaultValue("axpoint") String issuer,
        @DefaultValue("15m") Duration accessTokenTtl,
        @DefaultValue("14d") Duration refreshTokenTtl,
        @DefaultValue("12h") Duration shortRefreshTokenTtl) {

    /** HS256 은 키가 최소 256비트여야 한다. 짧은 시크릿은 부팅 시점에 잡는다. */
    public JwtProperties {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "app.jwt.secret 은 32바이트(256비트) 이상이어야 합니다. JWT_SECRET 환경변수를 확인하세요.");
        }
    }

    public Duration refreshTtl(boolean rememberMe) {
        return rememberMe ? refreshTokenTtl : shortRefreshTokenTtl;
    }
}
