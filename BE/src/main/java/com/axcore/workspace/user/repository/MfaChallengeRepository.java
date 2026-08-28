package com.axcore.workspace.user.repository;

import com.axcore.workspace.user.entity.MfaChallenge;
import com.axcore.workspace.user.entity.MfaPurpose;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface MfaChallengeRepository extends JpaRepository<MfaChallenge, UUID> {

    /**
     * 챌린지 토큰으로 조회한다. {@code purpose} 를 함께 거는 이유는 등록용 코드로 로그인이
     * 통과되는 경로를 막기 위해서다. 토큰이 맞아도 용도가 다르면 없는 것으로 본다.
     */
    @Query(
            """
            select c from MfaChallenge c
              join fetch c.user
             where c.tokenHash = :tokenHash
               and c.purpose = :purpose
            """)
    Optional<MfaChallenge> findByTokenHashAndPurposeWithUser(
            @Param("tokenHash") String tokenHash, @Param("purpose") MfaPurpose purpose);

    /**
     * 같은 용도의 살아 있는 챌린지를 모두 폐기한다.
     *
     * <p>코드를 다시 보낼 때 앞선 코드를 끊는다. 여러 개가 동시에 유효하면 시도 횟수 제한이
     * 무의미해진다 — 챌린지를 계속 새로 만들면서 각각 5회씩 시도하면 된다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            update MfaChallenge c
               set c.consumedAt = :at
             where c.user.id = :userId
               and c.purpose = :purpose
               and c.consumedAt is null
            """)
    int consumeOutstanding(
            @Param("userId") UUID userId,
            @Param("purpose") MfaPurpose purpose,
            @Param("at") Instant at);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from MfaChallenge c where c.expiresAt < :before")
    int deleteExpiredBefore(@Param("before") Instant before);
}
