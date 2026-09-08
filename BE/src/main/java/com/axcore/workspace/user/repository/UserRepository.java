package com.axcore.workspace.user.repository;

import com.axcore.workspace.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * 호출 전에 {@link User#normalizeEmail(String)} 로 소문자 정규화를 거쳐야 한다.
     * 저장 시에도 같은 규칙을 쓰므로 대소문자만 다른 이메일은 같은 계정으로 취급된다.
     */
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /** 지금 어떤 계정이든 가리키고 있는 프로필 사진 키 전부. 주인 없는 파일을 가려낼 때 기준이 된다. */
    @Query("select u.avatarObjectKey from User u where u.avatarObjectKey is not null")
    List<String> findAllAvatarObjectKeys();
}
