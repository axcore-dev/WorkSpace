package com.axcore.workspace.security;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * access 토큰 발급. 검증은 Spring Security 의 리소스 서버 필터가 한다.
 *
 * <p>클레임을 최소로 둔다. 권한을 넣지 않는 이유는 권한 모델(3층 교집합)이 미확정이기도 하지만,
 * 넣는 순간 권한 회수가 access TTL 만큼 늦게 반영되기 때문이다.
 *
 * <p>{@code sid} 는 이 access 토큰을 만들어 낸 refresh 세션의 id 다. "이 기기만 로그아웃"과
 * 세션 목록의 "현재 기기" 표시가 이 값으로 자기 세션을 찾는다.
 *
 * <p>{@code wsid} 는 선택된 회사다. 나중에 {@code search_path} 를 정하는 근거가 되지만,
 * <b>이 값을 그대로 믿고 스키마를 열면 안 된다.</b> 소속은 회수될 수 있고 토큰은 최대 access TTL
 * 만큼 살아 있다. 진입 시점에 {@code user_workspace_memberships} 를 다시 확인해야 한다.
 * (docs/db/schema-draft-v2.md)
 *
 * <p>역할(role)은 넣지 않는다. 넣는 순간 권한 회수가 access TTL 만큼 늦게 반영되고, 권한
 * 모델(3층 교집합) 자체도 테넌트 스키마가 생긴 뒤에야 확정된다.
 */
@Service
public class JwtTokenService {

    /** 서명 알고리즘을 코드에서 고정한다. 토큰 헤더의 alg 를 믿고 고르면 alg=none 공격이 열린다. */
    private static final MacAlgorithm ALGORITHM = MacAlgorithm.HS256;

    private final JwtEncoder encoder;
    private final JwtProperties properties;

    public JwtTokenService(JwtEncoder encoder, JwtProperties properties) {
        this.encoder = encoder;
        this.properties = properties;
    }

    /**
     * @param workspaceId 선택된 회사. 아직 고르지 않았으면 null 이고 그때는 클레임 자체를 넣지
     *                    않는다. null 을 값으로 실으면 "선택 안 함"과 "클레임 없음"이 뒤섞인다.
     */
    public AccessToken issue(UUID userId, UUID sessionId, Long workspaceId, Instant now) {
        Instant expiresAt = now.plus(properties.accessTokenTtl());
        JwtClaimsSet.Builder builder =
                JwtClaimsSet.builder()
                        .issuer(properties.issuer())
                        .issuedAt(now)
                        .expiresAt(expiresAt)
                        .subject(userId.toString())
                        .claim("sid", sessionId.toString());
        if (workspaceId != null) {
            builder.claim("wsid", workspaceId.toString());
        }
        JwtClaimsSet claims = builder.build();
        String value =
                encoder.encode(
                                JwtEncoderParameters.from(
                                        JwsHeader.with(ALGORITHM).build(), claims))
                        .getTokenValue();
        return new AccessToken(value, expiresAt);
    }

    public record AccessToken(String value, Instant expiresAt) {
    }
}
