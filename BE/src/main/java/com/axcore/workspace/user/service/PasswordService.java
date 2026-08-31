package com.axcore.workspace.user.service;

import com.axcore.workspace.user.entity.TokenPurpose;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserToken;
import com.axcore.workspace.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 비밀번호 변경(로그인 상태)과 재설정(메일 링크).
 *
 * <p>두 경로 모두 끝에서 <b>그 사용자의 모든 세션을 폐기한다.</b> 비밀번호를 바꾸는 이유의
 * 대부분은 "누가 알고 있을지도 모른다"이고, 세션을 남겨 두면 이미 로그인해 있던 쪽은 그대로
 * 남는다. 화면 문구인 "모든 기기에서 다시 로그인해야 합니다"가 이것이다.
 */
@Service
public class PasswordService {

    private static final Logger log = LoggerFactory.getLogger(PasswordService.class);

    private final UserRepository userRepository;
    private final VerificationTokenService verificationTokenService;
    private final PasswordEncoder passwordEncoder;
    private final SessionRevoker sessionRevoker;
    private final AccountMailer mailer;

    public PasswordService(
            UserRepository userRepository,
            VerificationTokenService verificationTokenService,
            PasswordEncoder passwordEncoder,
            SessionRevoker sessionRevoker,
            AccountMailer mailer) {
        this.userRepository = userRepository;
        this.verificationTokenService = verificationTokenService;
        this.passwordEncoder = passwordEncoder;
        this.sessionRevoker = sessionRevoker;
        this.mailer = mailer;
    }

    /**
     * 로그인한 사용자가 자기 비밀번호를 바꾼다.
     *
     * <p>현재 비밀번호를 다시 묻는 이유: access 토큰만 탈취한 쪽이 비밀번호를 갈아 끼워 계정을
     * 통째로 가져가는 것을 막는다. 토큰은 15분이지만 비밀번호를 바꾸면 영구적이다.
     */
    @Transactional
    public void change(User user, String currentPassword, String newPassword, Instant now) {
        // 소셜 전용 계정은 대조할 해시가 없다. 이 검사 없이 내려가면 PasswordEncoder 가
        // IllegalArgumentException 을 던져 500 이 된다.
        if (!user.hasPassword()) {
            throw new PasswordNotSetException();
        }
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BadCredentialsException("현재 비밀번호가 올바르지 않습니다");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new SamePasswordException();
        }
        applyNewPassword(user, newPassword, now);
    }

    /**
     * 재설정 링크 요청.
     *
     * <p>가입돼 있지 않은 주소여도 <b>아무 일도 하지 않고 정상 응답한다.</b> 응답이 갈리면 이
     * 엔드포인트가 가입 여부 조회기가 된다. 인증 없이 부를 수 있는 경로라 특히 그렇다.
     *
     * <p>미확인 계정에도 보낸다. 오히려 이 링크가 주소 소유를 증명하는 경로가 된다.
     */
    @Transactional
    public void requestReset(String rawEmail, Instant now) {
        String email = User.normalizeEmail(rawEmail);
        userRepository
                .findByEmail(email)
                .ifPresentOrElse(
                        user -> {
                            String token =
                                    verificationTokenService.issue(
                                            user, TokenPurpose.PASSWORD_RESET, now);
                            mailer.sendPasswordReset(
                                    user, token, TokenPurpose.PASSWORD_RESET.ttl());
                        },
                        () ->
                                // 로그에는 남긴다. 없는 주소로 재설정 요청이 몰리는 것은
                                // 계정 목록을 훑고 있다는 신호다. 응답으로는 드러내지 않는다.
                                log.info("가입되지 않은 주소로 비밀번호 재설정 요청이 들어왔다"));
    }

    /**
     * 메일 링크의 토큰으로 비밀번호를 바꾼다.
     *
     * <p>여기서는 현재 비밀번호를 묻지 않는다. 비밀번호를 잊은 사람이 쓰는 경로다. 대신 토큰이
     * 짧게 만료되고 한 번만 쓰인다.
     *
     * <p>이 경로를 통과하면 이메일 소유가 증명된 것이므로 미확인 계정도 함께 확인 처리한다.
     * 메일함을 열 수 있다는 사실이 곧 소유 확인이고, 별도로 한 번 더 요구할 이유가 없다.
     */
    @Transactional
    public void reset(String rawToken, String newPassword, Instant now) {
        UserToken token =
                verificationTokenService.consume(rawToken, TokenPurpose.PASSWORD_RESET, now);
        User user = token.getUser();
        user.verifyEmail(now);
        applyNewPassword(user, newPassword, now);
    }

    private void applyNewPassword(User user, String newPassword, Instant now) {
        user.changePassword(passwordEncoder.encode(newPassword));

        // 폐기는 별도 트랜잭션이다. SessionRevoker 주석 참고 — 여기서는 예외가 나지 않지만
        // 같은 메서드를 쓰는 편이 폐기 경로를 하나로 유지한다.
        int revoked = sessionRevoker.revokeAll(user.getId(), now);
        log.info("비밀번호 변경으로 사용자 {} 의 세션 {}개를 폐기했다", user.getId(), revoked);

        mailer.sendPasswordChanged(user);
    }
}
