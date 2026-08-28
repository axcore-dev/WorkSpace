package com.axcore.workspace.user.repository;

import com.axcore.workspace.user.entity.MfaMethod;
import com.axcore.workspace.user.entity.UserMfaMethod;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserMfaMethodRepository extends JpaRepository<UserMfaMethod, Long> {

    Optional<UserMfaMethod> findByUserIdAndMethod(UUID userId, MfaMethod method);

    List<UserMfaMethod> findByUserId(UUID userId);

    /**
     * 켜져 있는 수단만. 로그인 경로에서 "2단계가 필요한가"를 판단하는 질문이라
     * 등록만 하고 확인하지 않은 행은 제외된다.
     */
    List<UserMfaMethod> findByUserIdAndEnabledTrue(UUID userId);
}
