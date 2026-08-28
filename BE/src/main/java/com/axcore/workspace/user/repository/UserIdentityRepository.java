package com.axcore.workspace.user.repository;

import com.axcore.workspace.user.entity.AuthProvider;
import com.axcore.workspace.user.entity.UserIdentity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, UUID> {

    /**
     * 소셜 로그인의 첫 조회. 이메일이 아니라 제공자 식별자로 찾는다.
     *
     * <p>{@code user} 를 함께 가져온다. 바로 뒤에 세션을 발급하면서 반드시 쓰이는데, LAZY 로 두면
     * 트랜잭션 경계 밖에서 초기화되어 실패하거나 쿼리가 한 번 더 나간다.
     */
    @Query(
            "select i from UserIdentity i join fetch i.user"
                    + " where i.provider = :provider and i.providerUserId = :providerUserId")
    Optional<UserIdentity> findByProviderAndSubject(
            AuthProvider provider, String providerUserId);

    List<UserIdentity> findByUserId(UUID userId);

    Optional<UserIdentity> findByUserIdAndProvider(UUID userId, AuthProvider provider);
}
