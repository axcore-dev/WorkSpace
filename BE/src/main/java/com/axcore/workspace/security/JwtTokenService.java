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
 * <p>{@code sid} 는 이 access 토큰을 만들어 낸 refresh 세션의 id 다. 나중에 "이 기기만
 * 로그아웃" 이나 세션별 감사 로그를 붙일 때 필요하다.
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

    public AccessToken issue(UUID userId, UUID sessionId, Instant now) {
        Instant expiresAt = now.plus(properties.accessTokenTtl());
        JwtClaimsSet claims =
                JwtClaimsSet.builder()
                        .issuer(properties.issuer())
                        .issuedAt(now)
                        .expiresAt(expiresAt)
                        .subject(userId.toString())
                        .claim("sid", sessionId.toString())
                        .build();
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
