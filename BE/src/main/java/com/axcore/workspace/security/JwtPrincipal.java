package com.axcore.workspace.security;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/**
 * access 토큰에서 꺼낸 값들.
 *
 * <p>컨트롤러마다 {@code jwt.getSubject()} 를 파싱하면 같은 코드가 흩어지고, 무엇보다
 * {@code sid} 를 꺼내는 것을 빠뜨리기 쉽다. 그러면 "현재 세션"이 필요한 조작이 조용히 엉뚱한
 * 세션에 적용된다.
 *
 * @param sessionId 이 토큰을 만들어 낸 refresh 세션. "현재 기기" 판정과 회사 선택이 쓴다.
 * @param workspaceId 선택된 회사. 아직 고르지 않았으면 null 이다.
 *                    <b>이 값을 그대로 믿고 스키마를 열면 안 된다.</b> 소속은 회수될 수 있고
 *                    토큰은 최대 access TTL 만큼 살아 있다.
 */
public record JwtPrincipal(UUID userId, UUID sessionId, Long workspaceId) {

    public static JwtPrincipal of(Jwt jwt) {
        return new JwtPrincipal(
                UUID.fromString(jwt.getSubject()),
                UUID.fromString(jwt.getClaimAsString("sid")),
                parseWorkspaceId(jwt.getClaimAsString("wsid")));
    }

    private static Long parseWorkspaceId(String claim) {
        return claim == null ? null : Long.valueOf(claim);
    }
}
