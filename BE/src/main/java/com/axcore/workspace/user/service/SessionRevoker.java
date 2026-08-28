package com.axcore.workspace.user.service;

import com.axcore.workspace.user.repository.UserSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 사용자의 살아있는 세션을 전부 폐기한다. 반드시 별도 트랜잭션에서 커밋한다.
 *
 * <p>왜 클래스를 따로 두는가: refresh 재사용을 탐지하면 (1) 그 사용자의 세션을 전부 끊고
 * (2) 401 을 던져야 한다. 그런데 던지는 예외가 런타임 예외라 같은 트랜잭션이 롤백되고, 방금 한
 * 폐기까지 함께 되돌아간다. 탈취를 감지하고도 아무것도 끊지 않은 상태가 되는 것이다.
 *
 * <p>{@code REQUIRES_NEW} 는 프록시를 거쳐야 적용되므로 같은 빈 안에서 자기 메서드를 부르면
 * 아무 효과가 없다. 그래서 호출되는 쪽이 별도 빈이어야 한다.
 *
 * <p>비밀번호 변경 시의 "모든 기기에서 다시 로그인" 도 같은 경로를 쓴다.
 */
@Service
public class SessionRevoker {

    private final UserSessionRepository sessionRepository;

    public SessionRevoker(UserSessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    /**
     * @return 실제로 폐기된 세션 수
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int revokeAll(UUID userId, Instant at) {
        return sessionRepository.revokeAllByUserId(userId, at);
    }
}
