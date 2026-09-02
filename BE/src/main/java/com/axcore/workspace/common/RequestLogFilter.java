package com.axcore.workspace.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 요청 한 줄 로그.
 *
 * <p>개발 중에 화면이 무엇을 부르는지, 무엇이 몇 번으로 떨어지는지 보이지 않으면 FE 쪽 문제인지
 * BE 쪽 문제인지 가릴 수가 없다. Spring 의 웹 DEBUG 로그를 켜면 알 수 있지만 한 요청에 수십
 * 줄이 쏟아져서 오히려 안 보인다. 필요한 것만 한 줄로 찍는다.
 *
 * <pre>
 *   POST /api/auth/login            200   142ms  user=-
 *   GET  /api/admin/workspaces      200    38ms  user=8f21..  q=size=200
 *   POST /api/auth/invitations/...  401     6ms  user=-
 * </pre>
 *
 * <p><b>본문과 헤더는 찍지 않는다.</b> 비밀번호·토큰·초대 링크가 그대로 로그에 남는다. 쿼리
 * 문자열도 {@code token} 이 들어오면 통째로 가린다 — 지금은 토큰을 본문으로 받게 해 두었지만,
 * 나중에 누군가 쿼리로 옮겨도 로그로 새지는 않게 한다.
 *
 * <p>운영에서는 끄는 것을 전제로 property 로 가른다. 접근 로그는 앞단(로드밸런서·게이트웨이)이
 * 남기는 것이 맞고, 애플리케이션이 중복으로 남길 이유가 없다.
 */
@Component
@Order(Integer.MAX_VALUE)
@ConditionalOnProperty(prefix = "app.log", name = "requests", havingValue = "true")
public class RequestLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("http");

    /** 사용자 식별자는 앞 8자만. 로그를 읽는 데는 충분하고 전체를 흘릴 이유가 없다. */
    private static final int USER_ID_PREFIX = 8;

    private static final int SLOW_MS = 500;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // 헬스체크는 주기적으로 들어와서 로그를 덮어 버린다. 정적 리소스도 볼 것이 없다.
        String path = request.getRequestURI();
        return path.startsWith("/actuator") || path.equals("/favicon.ico");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        long started = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            long ms = (System.nanoTime() - started) / 1_000_000;
            String line =
                    "%-6s %-42s %d %5dms  user=%s%s"
                            .formatted(
                                    request.getMethod(),
                                    request.getRequestURI(),
                                    response.getStatus(),
                                    ms,
                                    currentUserId(),
                                    query(request));

            // 느린 요청과 서버 오류는 눈에 띄어야 한다. 나머지는 흐르는 정보다.
            if (response.getStatus() >= 500 || ms >= SLOW_MS) {
                log.warn(line);
            } else {
                log.info(line);
            }
        }
    }

    /**
     * 인증된 사용자. 아직 인증 전이거나 익명이면 {@code -} 다.
     *
     * <p>필터 순서를 마지막으로 둔 이유가 이것이다. 시큐리티 필터보다 앞에서 읽으면 항상
     * 비어 있다.
     */
    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return "-";
        }
        if (auth.getPrincipal() instanceof Jwt jwt && jwt.getSubject() != null) {
            String sub = jwt.getSubject();
            return sub.length() > USER_ID_PREFIX ? sub.substring(0, USER_ID_PREFIX) : sub;
        }
        return "-";
    }

    /** 쿼리가 있으면 붙인다. 토큰이 섞여 있으면 통째로 가린다. */
    private static String query(HttpServletRequest request) {
        String q = request.getQueryString();
        if (q == null || q.isBlank()) {
            return "";
        }
        return q.toLowerCase().contains("token") ? "  q=(가림)" : "  q=" + q;
    }
}
