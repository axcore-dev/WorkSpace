package com.axcore.workspace.user.repository;

import com.axcore.workspace.user.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {

    /**
     * 인증 필터가 요청마다 부르는 경로다. User 를 바로 쓰기 때문에 fetch join 으로 함께 가져와
     * LAZY 프록시 초기화 쿼리가 한 번 더 나가지 않게 한다.
     */
    @Query("select s from UserSession s join fetch s.user where s.tokenHash = :tokenHash")
    Optional<UserSession> findByTokenHashWithUser(@Param("tokenHash") String tokenHash);

    /**
     * 해당 사용자의 살아있는 세션을 전부 취소한다. 비밀번호 변경 시 "모든 기기에서 다시 로그인"
     * 이 이 쿼리 하나로 처리된다.
     *
     * @return 실제로 취소된 행 수
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            update UserSession s
               set s.revokedAt = :at
             where s.user.id = :userId
               and s.revokedAt is null
            """)
    int revokeAllByUserId(@Param("userId") UUID userId, @Param("at") Instant at);

    /**
     * 만료됐거나 취소된 지 오래된 행을 지운다. 스케줄러를 붙이기 전까지는 호출부가 없다.
     *
     * @return 삭제된 행 수
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from UserSession s where s.expiresAt < :before or s.revokedAt < :before")
    int deleteExpiredBefore(@Param("before") Instant before);

    /**
     * 세션 목록 화면이 쓰는 조회. 살아 있는 것만 돌려준다.
     *
     * <p>폐기·만료된 행까지 보여줄 이유가 없다. 사용자가 이 화면에서 하는 판단은 "지금 어디에서
     * 로그인돼 있는가" 하나이고, 죽은 세션은 그 판단에 끼어들기만 한다.
     */
    @Query(
            """
            select s from UserSession s
             where s.user.id = :userId
               and s.revokedAt is null
               and s.expiresAt > :now
             order by s.createdAt desc
            """)
    List<UserSession> findActiveByUserId(@Param("userId") UUID userId, @Param("now") Instant now);

    /**
     * 자기 세션인지 확인하면서 가져온다.
     *
     * <p>id 로만 조회한 뒤 소유자를 나중에 비교하면, 그 비교를 빠뜨린 경로가 남의 세션을 끊는
     * 통로가 된다. 조건을 쿼리에 넣어 빠뜨릴 수 없게 만든다.
     */
    @Query(
            """
            select s from UserSession s
              join fetch s.user
             where s.id = :sessionId
               and s.user.id = :userId
            """)
    Optional<UserSession> findByIdAndUserIdWithUser(
            @Param("sessionId") UUID sessionId, @Param("userId") UUID userId);
}
