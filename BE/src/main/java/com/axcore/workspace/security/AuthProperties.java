package com.axcore.workspace.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.util.List;

/**
 * 토큰 전달 방식. {@code app.auth.*} 로 주입된다.
 *
 * <p>access 토큰은 응답 body 로 내보내 FE 가 메모리에 들고 Authorization 헤더로 보낸다.
 * refresh 토큰은 JS 가 읽을 수 없는 HttpOnly 쿠키로만 오간다. refresh 를 스크립트에서
 * 읽을 수 있게 두면 XSS 한 방에 14일짜리 재발급 권한이 통째로 넘어간다.
 *
 * @param refreshCookiePath 쿠키가 붙는 경로를 인증 엔드포인트로 좁힌다. 모든 API 요청에
 *                          refresh 가 딸려가지 않게 하려는 것이다.
 * @param refreshCookieSameSite SameSite=Lax 는 FE 와 API 가 같은 사이트(등록 도메인)일 때만
 *                          동작한다. 완전히 다른 도메인이면 None 으로 바꾸고 Secure 가 필수다.
 * @param allowedOrigins    쿠키를 주고받으려면 CORS 에 credentials 가 필요하고, 그러면
 *                          와일드카드 Origin 을 쓸 수 없다. 정확한 출처만 나열한다.
 *                          기본값 포트는 8000 이다 — FE 가 {@code next dev -p 8000} 으로 돈다.
 *                          Next.js 기본값 3000 을 적어 두면 FE 를 붙이는 순간 전부 CORS 에서 막힌다.
 */
@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        @DefaultValue("axp_refresh") String refreshCookieName,
        @DefaultValue("/api/auth") String refreshCookiePath,
        @DefaultValue("true") boolean refreshCookieSecure,
        @DefaultValue("Lax") String refreshCookieSameSite,
        @DefaultValue("http://localhost:8000") List<String> allowedOrigins) {
}
