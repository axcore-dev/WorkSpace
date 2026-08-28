package com.axcore.workspace.user.service;

import com.axcore.workspace.user.repository.MfaChallengeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 코드 오입력 횟수를 별도 트랜잭션에 적는다.
 *
 * <p>{@link SessionRevoker} 와 같은 이유로 분리돼 있다. 코드가 틀리면 호출부가 예외를 던지고,
 * 그 예외가 트랜잭션을 롤백시킨다. 같은 트랜잭션에서 횟수를 올리면 <b>그 증가가 함께
 * 되돌아간다.</b> 그러면 시도 상한이 영원히 차지 않아 6자리 코드를 무제한으로 대입할 수 있다.
 *
 * <p>짧은 코드를 쓰는 이상 시도 횟수 제한이 실질적인 방어선이므로, 이 분리는 편의가 아니라
 * 요건이다.
 *
 * <p>반대로 <b>성공했을 때의 소비는 분리하지 않는다.</b> 뒤이어 세션 발급이 실패하면 로그인이
 * 성립하지 않은 것이므로, 코드도 쓰이지 않은 상태로 되돌아가는 편이 맞다.
 */
@Service
public class MfaAttemptRecorder {

    private final MfaChallengeRepository challengeRepository;

    public MfaAttemptRecorder(MfaChallengeRepository challengeRepository) {
        this.challengeRepository = challengeRepository;
    }

    /**
     * @return 상한에 닿아 챌린지가 폐기됐으면 true
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean recordFailure(UUID challengeId, Instant at) {
        return challengeRepository
                .findById(challengeId)
                .map(challenge -> challenge.recordFailedAttempt(at))
                .orElse(false);
    }
}
