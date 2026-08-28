package com.axcore.workspace.user.service;

import com.axcore.workspace.security.SecureTokens;
import com.axcore.workspace.user.entity.TokenPurpose;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserToken;
import com.axcore.workspace.user.repository.UserTokenRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 메일로 나가는 일회용 토큰의 발급·소비.
 *
 * <p>{@link RefreshTokenService} 와 같은 원칙이다. 원문은 응답(여기서는 메일)으로 한 번만
 * 나가고 DB 에는 해시만 남는다. 다른 점은 회전이 없다는 것 — 한 번 쓰면 끝이다.
 */
@Service
public class VerificationTokenService {

    private final UserTokenRepository tokenRepository;

    public VerificationTokenService(UserTokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    /**
     * 새 토큰을 발급하고 같은 용도의 이전 토큰을 모두 끊는다.
     *
     * <p>끊지 않으면 재발송할수록 유효한 링크가 메일함에 쌓인다. 비밀번호 재설정에서는 그 하나
     * 하나가 계정 탈취 경로다.
     *
     * @return 토큰 원문. 메일로만 나가고 로그에 남기지 않는다.
     */
    @Transactional
    public String issue(User user, TokenPurpose purpose, Instant now) {
        tokenRepository.consumeOutstanding(user.getId(), purpose, now);
        String raw = SecureTokens.generate();
        tokenRepository.save(UserToken.issue(user, purpose, SecureTokens.hash(raw), now));
        return raw;
    }

    /**
     * 토큰을 검증하고 소비한다.
     *
     * <p>없는 토큰 · 만료된 토큰 · 이미 쓴 토큰 · 용도가 다른 토큰을 한 가지 예외로 합친다.
     * 구분해 주면 "이 토큰은 존재하지만 만료됐다"는 사실이 새고, 그건 토큰을 주운 쪽에게만
     * 쓸모 있는 정보다.
     *
     * @throws BadCredentialsException 쓸 수 없는 토큰
     */
    @Transactional
    public UserToken consume(String rawToken, TokenPurpose purpose, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            throw invalidToken();
        }
        UserToken token =
                tokenRepository
                        .findByTokenHashWithUser(SecureTokens.hash(rawToken))
                        .orElseThrow(VerificationTokenService::invalidToken);

        if (token.getPurpose() != purpose || !token.isUsable(now)) {
            throw invalidToken();
        }
        token.consume(now);
        return token;
    }

    private static BadCredentialsException invalidToken() {
        return new BadCredentialsException("링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요");
    }
}
