package com.axcore.workspace.user.service;

import com.axcore.workspace.security.SecureTokens;
import com.axcore.workspace.user.entity.MfaChallenge;
import com.axcore.workspace.user.entity.MfaMethod;
import com.axcore.workspace.user.entity.MfaPurpose;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserMfaMethod;
import com.axcore.workspace.user.repository.MfaChallengeRepository;
import com.axcore.workspace.user.repository.UserMfaMethodRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * 2단계 인증.
 *
 * <p>지원 수단은 이메일 OTP 하나다. TOTP 가 표준적인 선택이지만 검증된 라이브러리가 필요하고
 * 새 의존성은 승인 사항이라, 발송 경로를 비밀번호 재설정과 공유하는 쪽으로 먼저 붙였다.
 * {@link MfaMethod} 는 나머지 값도 들고 있으므로 수단이 늘어도 스키마는 그대로다.
 *
 * <p>흐름이 둘이다.
 *
 * <ul>
 *   <li><b>등록</b> — 로그인된 상태에서 수단을 켠다. 코드가 맞아야 {@code enabled} 가 올라간다.
 *       등록 즉시 켜지 않는 이유는 오타 난 주소로 계정에서 잠기는 것을 막기 위해서다.
 *   <li><b>로그인</b> — 비밀번호가 맞은 뒤 챌린지를 만들고 코드를 보낸다. 통과하기 전에는
 *       access·refresh 가 발급되지 않는다.
 * </ul>
 *
 * <p>통과 조건은 <b>챌린지 토큰과 코드 둘 다</b>다. 코드만으로는 어느 챌린지인지 지목할 수 없고,
 * 챌린지 토큰만 가로채도 코드를 모르면 통과하지 못한다.
 */
@Service
public class MfaService {

    private static final Logger log = LoggerFactory.getLogger(MfaService.class);

    private final MfaChallengeRepository challengeRepository;
    private final UserMfaMethodRepository methodRepository;
    private final MfaAttemptRecorder attemptRecorder;
    private final AccountMailer mailer;
    private final PasswordEncoder passwordEncoder;
    private final SessionIssuer sessionIssuer;
    private final SessionRevoker sessionRevoker;

    public MfaService(
            MfaChallengeRepository challengeRepository,
            UserMfaMethodRepository methodRepository,
            MfaAttemptRecorder attemptRecorder,
            AccountMailer mailer,
            PasswordEncoder passwordEncoder,
            SessionIssuer sessionIssuer,
            SessionRevoker sessionRevoker) {
        this.challengeRepository = challengeRepository;
        this.methodRepository = methodRepository;
        this.attemptRecorder = attemptRecorder;
        this.mailer = mailer;
        this.passwordEncoder = passwordEncoder;
        this.sessionIssuer = sessionIssuer;
        this.sessionRevoker = sessionRevoker;
    }

    // ---------------------------------------------------------------- 로그인 경로

    /**
     * 로그인 도중의 2단계 챌린지를 만들고 코드를 보낸다.
     *
     * @return 클라이언트가 들고 있을 챌린지 토큰 원문
     */
    @Transactional
    public String startLoginChallenge(User user, boolean rememberMe, Instant now) {
        return startChallenge(user, MfaPurpose.LOGIN, rememberMe, now);
    }

    /**
     * 로그인 2단계 통과. 여기서 비로소 세션이 발급된다.
     *
     * @throws BadCredentialsException 챌린지나 코드가 맞지 않는 경우
     */
    @Transactional
    public AuthResult verifyLogin(
            String challengeToken, String code, String userAgent, String ip, Instant now) {
        MfaChallenge challenge = verify(challengeToken, code, MfaPurpose.LOGIN, now);
        return sessionIssuer.issueNewSession(
                challenge.getUser(), challenge.isRememberMe(), userAgent, ip, now);
    }

    // ---------------------------------------------------------------- 등록 경로

    /**
     * 이메일 2단계를 등록하고 확인 코드를 보낸다. 아직 켜지지 않는다.
     *
     * <p>이미 켜져 있으면 다시 시작하지 않는다. 그러지 않으면 이 엔드포인트가 자기 자신에게
     * 메일을 보내는 무제한 발송기가 된다.
     */
    @Transactional
    public String startEmailEnrollment(User user, Instant now) {
        UserMfaMethod method =
                methodRepository
                        .findByUserIdAndMethod(user.getId(), MfaMethod.EMAIL)
                        .orElseGet(
                                () ->
                                        methodRepository.save(
                                                UserMfaMethod.register(user, MfaMethod.EMAIL)));
        if (method.isEnabled()) {
            throw new MfaStateException("이미 켜져 있는 인증 수단입니다");
        }
        return startChallenge(user, MfaPurpose.ENROLLMENT, false, now);
    }

    /** 등록 확인. 코드가 맞으면 그때 켜진다. */
    @Transactional
    public void confirmEmailEnrollment(String challengeToken, String code, Instant now) {
        MfaChallenge challenge = verify(challengeToken, code, MfaPurpose.ENROLLMENT, now);
        UserMfaMethod method =
                methodRepository
                        .findByUserIdAndMethod(challenge.getUser().getId(), MfaMethod.EMAIL)
                        .orElseThrow(() -> new MfaStateException("등록 중인 인증 수단이 없습니다"));
        method.markVerified(now);
    }

    /**
     * 2단계를 끈다.
     *
     * <p>세션을 전부 끊는 이유: 2단계를 끄는 것은 계정의 방어를 한 겹 걷어내는 변경이다.
     * 이 조작이 탈취된 세션에서 일어났다면, 끊지 않는 한 공격자의 세션만 그대로 살아남는다.
     * 비밀번호 변경과 같은 취급을 한다.
     */
    @Transactional
    public void disableEmailMfa(User user, Instant now) {
        UserMfaMethod method =
                methodRepository
                        .findByUserIdAndMethod(user.getId(), MfaMethod.EMAIL)
                        .orElseThrow(() -> new MfaStateException("켜져 있는 인증 수단이 없습니다"));
        if (!method.isEnabled()) {
            throw new MfaStateException("켜져 있는 인증 수단이 없습니다");
        }
        method.disable();
        challengeRepository.consumeOutstanding(user.getId(), MfaPurpose.LOGIN, now);
        sessionRevoker.revokeAll(user.getId(), now);
    }

    @Transactional(readOnly = true)
    public List<UserMfaMethod> methodsOf(User user) {
        return methodRepository.findByUserId(user.getId());
    }

    // ---------------------------------------------------------------- 공통

    private String startChallenge(User user, MfaPurpose purpose, boolean rememberMe, Instant now) {
        // 앞선 챌린지를 끊는다. 여러 개가 동시에 살아 있으면 시도 횟수 제한이 무의미해진다 —
        // 챌린지를 계속 새로 만들면서 각각 상한까지 시도하면 되기 때문이다.
        challengeRepository.consumeOutstanding(user.getId(), purpose, now);

        String rawToken = SecureTokens.generate();
        String code = SecureTokens.generateNumericCode(MfaChallenge.CODE_DIGITS);
        challengeRepository.save(
                MfaChallenge.issue(
                        user,
                        purpose,
                        MfaMethod.EMAIL,
                        SecureTokens.hash(rawToken),
                        passwordEncoder.encode(code),
                        rememberMe,
                        now));

        if (purpose == MfaPurpose.LOGIN) {
            mailer.sendLoginCode(user, code, MfaChallenge.TTL);
        } else {
            mailer.sendEnrollmentCode(user, code, MfaChallenge.TTL);
        }
        return rawToken;
    }

    /**
     * 챌린지 토큰과 코드를 함께 검증하고 소비한다.
     *
     * <p>실패 응답을 한 가지로 합친다. "챌린지는 맞는데 코드가 틀렸다"와 "챌린지가 없다"가
     * 구분되면, 챌린지 토큰을 주운 쪽이 그것만으로 유효 여부를 확인할 수 있다.
     */
    private MfaChallenge verify(
            String challengeToken, String code, MfaPurpose purpose, Instant now) {
        if (challengeToken == null || challengeToken.isBlank() || code == null || code.isBlank()) {
            throw invalidChallenge();
        }
        MfaChallenge challenge =
                challengeRepository
                        .findByTokenHashAndPurposeWithUser(
                                SecureTokens.hash(challengeToken), purpose)
                        .orElseThrow(MfaService::invalidChallenge);

        if (!challenge.isUsable(now)) {
            throw invalidChallenge();
        }
        if (!passwordEncoder.matches(code, challenge.getCodeHash())) {
            // 시도 횟수는 반드시 별도 트랜잭션에 남긴다. 바로 아래에서 던지는 예외가 이
            // 트랜잭션을 롤백시키므로, 같은 트랜잭션에서 올리면 증가가 되돌아가고 상한이
            // 영원히 차지 않는다. MfaAttemptRecorder 주석 참고.
            boolean exhausted = attemptRecorder.recordFailure(challenge.getId(), now);
            if (exhausted) {
                log.warn(
                        "MFA 코드 시도 횟수 초과 — 사용자 {} 의 {} 챌린지를 폐기했다",
                        challenge.getUser().getId(),
                        purpose);
            }
            throw invalidChallenge();
        }
        challenge.consume(now);
        return challenge;
    }

    private static BadCredentialsException invalidChallenge() {
        return new BadCredentialsException("인증 코드가 올바르지 않거나 만료되었습니다");
    }
}
