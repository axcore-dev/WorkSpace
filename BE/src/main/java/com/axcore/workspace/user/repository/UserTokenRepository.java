package com.axcore.workspace.user.repository;

import com.axcore.workspace.user.entity.TokenPurpose;
import com.axcore.workspace.user.entity.UserToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserTokenRepository extends JpaRepository<UserToken, UUID> {

    /**
     * 토큰 검증 경로는 곧바로 사용자를 필요로 한다. LAZY 인 채로 두면 여기서 늘 한 번 더 나간다.
     */
    @Query("select t from UserToken t join fetch t.user where t.tokenHash = :tokenHash")
    Optional<UserToken> findByTokenHashWithUser(@Param("tokenHash") String tokenHash);

    /**
     * 같은 용도의 아직 살아 있는 토큰을 모두 소비 처리한다.
     *
     * <p>새 링크를 보낼 때 옛 링크를 끊는 용도다. 끊지 않으면 재발송할수록 유효한 재설정 링크가
     * 메일함에 쌓이고, 그 중 하나만 새어도 계정이 넘어간다. "마지막에 받은 링크만 동작한다"가
     * 사용자에게도 이해하기 쉬운 규칙이다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            update UserToken t
               set t.consumedAt = :at
             where t.user.id = :userId
               and t.purpose = :purpose
               and t.consumedAt is null
            """)
    int consumeOutstanding(
            @Param("userId") UUID userId,
            @Param("purpose") TokenPurpose purpose,
            @Param("at") Instant at);

    /**
     * 수명이 끝난 행 정리. 만료·사용 여부와 무관하게 오래된 것을 지운다.
     *
     * <p>아직 부르는 스케줄러가 없다. {@code UserSessionRepository#deleteExpiredBefore} 와 같은
     * 처지이고, 정리 배치가 붙을 때 함께 엮는다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from UserToken t where t.expiresAt < :before")
    int deleteExpiredBefore(@Param("before") Instant before);
}
