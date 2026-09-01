package com.axcore.workspace.user.service;

import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 비밀번호 실패를 계정에 기록한다.
 *
 * <p>{@link Propagation#REQUIRES_NEW} 인 이유가 전부다. 실패한 로그인은 예외로 끝나고, 그
 * 예외가 호출한 쪽 트랜잭션을 되돌린다. 같은 트랜잭션에서 횟수를 올리면 올린 것이 함께
 * 사라져 영원히 1회를 넘지 못한다. {@link MfaAttemptRecorder} 와 같은 이유, 같은 구조다.
 *
 * <p>이메일로 받는다. 실패 시점에는 인증이 끝나지 않아 사용자 식별자가 없다. 없는 주소면
 * 아무 일도 하지 않는다 — 여기서 "그런 계정 없음" 을 밖으로 알리지 않는다.
 */
@Service
public class LoginAttemptRecorder {

    private static final Logger log = LoggerFactory.getLogger(LoginAttemptRecorder.class);

    private final UserRepository userRepository;
    private final AccountMailer mailer;

    public LoginAttemptRecorder(UserRepository userRepository, AccountMailer mailer) {
        this.userRepository = userRepository;
        this.mailer = mailer;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(String normalizedEmail, Instant at) {
        if (normalizedEmail == null || normalizedEmail.isBlank()) {
            return;
        }
        userRepository
                .findByEmail(normalizedEmail)
                .ifPresent(user -> record(user, at));
    }

    private void record(User user, Instant at) {
        // 비밀번호가 없는 계정(소셜 전용)은 비밀번호로 뚫을 대상이 아니다. 횟수를 올리면
        // 소셜 사용자가 비밀번호 로그인을 몇 번 시도했다는 이유로 잠긴다.
        if (!user.hasPassword()) {
            return;
        }
        if (!user.recordFailedLogin(at)) {
            return;
        }
        log.warn("비밀번호 연속 실패로 계정 {} 를 잠갔다. 재설정으로만 해제된다", user.getId());

        // 잠금은 시간이 지나도 풀리지 않는다. 응답은 다른 실패와 똑같은 401 이라 사용자가
        // 화면만 보고는 잠긴 것을 알 수 없다. 알려 주지 않으면 계속 같은 시도를 반복하게 된다.
        //
        // 이 발송이 트랜잭션 안에 있는 것은 알고 있다. 6회째 실패에서만 도는 경로라 로그인마다
        // 도는 2단계 코드 발송과 달리 감수한다. 메일 발송을 커밋 뒤로 미루는 작업은 별도 항목.
        mailer.sendAccountLocked(user);
    }
}
