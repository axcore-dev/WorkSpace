package com.axcore.workspace.user.service;

import com.axcore.workspace.security.RevokedSessionRegistry;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.repository.UserSessionRepository;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 로그인된 기기 목록과 개별 로그아웃.
 *
 * <p>{@link RefreshTokenService} 는 토큰을 들고 오는 쪽(발급·회전·토큰으로 폐기)을 다루고,
 * 여기는 <b>id 로 지목하는</b> 쪽을 다룬다. "다른 기기에서 로그아웃"은 그 기기의 토큰을 모르는
 * 채로 끊어야 하는 조작이라 경로가 다르다.
 */
@Service
public class UserSessionService {

    private final UserSessionRepository sessionRepository;
    private final RevokedSessionRegistry revoked;

    public UserSessionService(UserSessionRepository sessionRepository, RevokedSessionRegistry revoked) {
        this.sessionRepository = sessionRepository;
        this.revoked = revoked;
    }

    @Transactional(readOnly = true)
    public List<UserSession> listActive(UUID userId, Instant now) {
        return sessionRepository.findActiveByUserId(userId, now);
    }

    /**
     * 자기 세션을 가져온다. 남의 세션이면 없는 것과 같게 처리한다.
     *
     * <p>404 와 403 을 구분해 주면 세션 id 를 넣어 보는 것만으로 그 id 의 존재 여부를 알 수 있다.
     * UUID 라 실제로 맞히기는 어렵지만, 구분해서 얻는 것이 없다.
     */
    @Transactional(readOnly = true)
    public UserSession requireOwned(UUID userId, UUID sessionId) {
        return sessionRepository
                .findByIdAndUserIdWithUser(sessionId, userId)
                .orElseThrow(() -> new SessionNotFoundException());
    }

    /**
     * 지목한 세션을 끊는다.
     *
     * <p>이미 폐기된 세션을 다시 끊어도 성공으로 본다. 목록 화면에서 두 번 눌렀거나 다른 탭에서
     * 먼저 끊은 경우이고, 사용자가 원한 상태는 어느 쪽이든 "끊긴 상태"다.
     */
    @Transactional
    public void revoke(UUID userId, UUID sessionId, Instant now) {
        requireOwned(userId, sessionId).revoke(now);
        revoked.revoke(sessionId, now);
    }

    /**
     * 지금 세션만 남기고 이 사용자의 세션을 전부 끊는다 — 「다른 기기 모두 로그아웃」.
     *
     * <p>한 트랜잭션의 UPDATE 하나다. 화면이 기기마다 DELETE 를 따로 보내던 것을 대신한다 — 그 방식은 하나가 실패하면
     * 반쯤 끊긴 상태가 되고, 사용자는 「전부 끊었다」 고 믿는다. 끊긴 세션의 access 토큰은 만료(15분)까지 일반 API 를
     * 통과한다 — 로그아웃 · 비밀번호 변경과 같은 규칙이다.
     *
     * <p>지금 세션이 살아 있는지 먼저 본다. 이미 끊긴 세션의 토큰으로 남의 기기를 끊을 수는 없다.
     *
     * @return 실제로 폐기된 세션 수
     */
    @Transactional
    public int revokeOthers(UUID userId, UUID currentSessionId, Instant now) {
        requireActive(userId, currentSessionId, now);
        // 벌크 UPDATE 는 어느 행이 바뀌었는지 돌려주지 않는다 — 먼저 살아 있는 id 를 받아 두고, 끊은 뒤 그 토큰들을 즉시 막는다
        List<UUID> others = sessionRepository.findActiveByUserId(userId, now).stream()
                .map(UserSession::getId)
                .filter(id -> !currentSessionId.equals(id))
                .toList();
        int count = sessionRepository.revokeAllByUserIdExcept(userId, currentSessionId, now);
        revoked.revokeAll(others, now);
        return count;
    }

    /**
     * 현재 세션이 살아 있는지 확인한다.
     *
     * <p>access 토큰은 서명만으로 통과하므로, 세션이 끊긴 뒤에도 최대 access TTL 동안 요청이
     * 들어온다. 세션 상태를 바꾸는 조작(회사 선택 등)에서는 그 사이를 그냥 통과시키면 안 된다.
     */
    @Transactional(readOnly = true)
    public UserSession requireActive(UUID userId, UUID sessionId, Instant now) {
        UserSession session = requireOwned(userId, sessionId);
        if (!session.isActive(now)) {
            throw new BadCredentialsException("세션이 만료되었습니다. 다시 로그인해 주세요");
        }
        return session;
    }
}
