package com.axcore.workspace.user.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.security.RefreshCookieFactory;
import com.axcore.workspace.user.dto.SessionResponse;
import com.axcore.workspace.user.service.UserSessionService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 로그인된 기기 목록과 개별 로그아웃.
 *
 * <p>"다른 기기에서 로그아웃"은 그 기기의 refresh 토큰을 모르는 채로 끊어야 하는 조작이라
 * {@code /api/auth/logout} 과 경로가 다르다. 저쪽은 쿠키로 지목하고 이쪽은 id 로 지목한다.
 */
@RestController
@RequestMapping("/api/auth/sessions")
public class SessionController {

    private final UserSessionService sessionService;
    private final RefreshCookieFactory refreshCookies;

    public SessionController(
            UserSessionService sessionService, RefreshCookieFactory refreshCookies) {
        this.sessionService = sessionService;
        this.refreshCookies = refreshCookies;
    }

    @GetMapping
    public List<SessionResponse> list(@AuthenticationPrincipal Jwt jwt) {
        JwtPrincipal principal = JwtPrincipal.of(jwt);
        return sessionService.listActive(principal.userId(), Instant.now()).stream()
                .map(session -> SessionResponse.from(session, principal.sessionId()))
                .toList();
    }

    /**
     * 지목한 세션을 끊는다.
     *
     * <p>자기 자신을 끊는 것도 허용한다. 목록에서 "현재 기기"를 눌러 로그아웃하는 흐름이
     * 자연스럽고, 막으면 화면이 두 경로를 따로 다뤄야 한다. 다만 그 경우에는 지금 브라우저의
     * refresh 쿠키도 함께 지워야 한다 — 남겨 두면 다음 재발급이 401 로 떨어지고 화면은 그것을
     * 예상치 못한 오류로 본다.
     */
    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> revoke(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID sessionId) {
        JwtPrincipal principal = JwtPrincipal.of(jwt);
        sessionService.revoke(principal.userId(), sessionId, Instant.now());

        if (sessionId.equals(principal.sessionId())) {
            return ResponseEntity.noContent()
                    .header(HttpHeaders.SET_COOKIE, refreshCookies.cleared().toString())
                    .build();
        }
        return ResponseEntity.noContent().build();
    }
}
