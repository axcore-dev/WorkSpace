package com.axcore.workspace.user.service;

import com.axcore.workspace.user.entity.TokenPurpose;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 이메일 소유 확인.
 *
 * <p>가입 시점의 발송은 {@link AuthService#signUp} 이 한다. 여기는 재발송과 링크 처리다.
 *
 * <p>확인되지 않은 계정도 로그인은 된다. 막으면 재발송을 요청할 통로가 없어져서, 주소를 오타로
 * 적은 사용자가 스스로 빠져나올 수 없다. 대신 회사 진입이 막힌다.
 * ({@link SessionIssuer#nextStep})
 */
@Service
public class EmailVerificationService {

    private final VerificationTokenService verificationTokenService;
    private final AccountMailer mailer;

    public EmailVerificationService(
            VerificationTokenService verificationTokenService, AccountMailer mailer) {
        this.verificationTokenService = verificationTokenService;
        this.mailer = mailer;
    }

    /**
     * 확인 메일 재발송.
     *
     * <p>이미 확인된 계정이면 보내지 않는다. 조용히 넘어가는 대신 예외를 던지는 이유는, 이
     * 엔드포인트가 로그인된 자기 계정에만 동작해서 감출 정보가 없기 때문이다. 화면이 잘못된
     * 버튼을 띄우고 있다는 신호이기도 하다.
     */
    @Transactional
    public void resend(User user, Instant now) {
        if (user.isEmailVerified()) {
            throw new EmailAlreadyVerifiedException();
        }
        String token = verificationTokenService.issue(user, TokenPurpose.EMAIL_VERIFICATION, now);
        mailer.sendEmailVerification(user, token, TokenPurpose.EMAIL_VERIFICATION.ttl());
    }

    /**
     * 링크의 토큰으로 확인 처리한다.
     *
     * <p>인증 없이 부를 수 있는 경로다. 토큰을 가진 것 자체가 그 메일함을 열었다는 증거이고,
     * 링크는 로그인하지 않은 브라우저에서 열릴 수 있다.
     *
     * @return 확인된 사용자
     */
    @Transactional
    public User verify(String rawToken, Instant now) {
        UserToken token =
                verificationTokenService.consume(rawToken, TokenPurpose.EMAIL_VERIFICATION, now);
        User user = token.getUser();
        user.verifyEmail(now);
        return user;
    }
}
