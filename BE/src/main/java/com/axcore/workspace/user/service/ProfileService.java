package com.axcore.workspace.user.service;

import com.axcore.workspace.user.dto.ProfileUpdateRequest;
import com.axcore.workspace.user.dto.SocialIdentityResponse;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserIdentityRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 내 계정 화면이 읽고 쓰는 것들 — 프로필 · 연결된 소셜 제공자.
 *
 * <p>{@link AuthService} 와 나눈 이유는 다루는 시점이 다르기 때문이다. 저기는 로그인 · 토큰 · 세션 발급이고
 * 여기는 이미 로그인한 사람이 자기 정보를 보는 자리다. 두 곳 다 {@code shared.users} 를 만지지만 실패했을 때
 * 벌어지는 일이 다르다 — 여기서 이름 저장이 실패해도 세션은 멀쩡하다.
 *
 * <p>비밀번호 · 2단계 인증 · 세션 목록은 각각 {@code PasswordService} · {@code MfaService} ·
 * {@code SessionController} 에 이미 있다. 여기로 모으지 않는다.
 */
@Service
public class ProfileService {

    private static final Logger log = LoggerFactory.getLogger(ProfileService.class);

    private final AuthService auth;
    private final UserIdentityRepository identities;

    public ProfileService(AuthService auth, UserIdentityRepository identities) {
        this.auth = auth;
        this.identities = identities;
    }

    /**
     * 이름을 바꾼다. 앞뒤 공백은 버린다 — 화면에서 지운 흔적이 이름 끝에 남으면 목록에서 정렬이 어긋난다.
     *
     * <p>프로필 사진은 건드리지 않는다. 업로드 경로가 없어서 지금 값은 소셜 로그인이 준 주소뿐이고,
     * 여기서 함께 덮으면 이름만 바꿔도 사진이 사라진다.
     */
    @Transactional
    public UserResponse updateProfile(UUID userId, ProfileUpdateRequest request) {
        User user = auth.requireUser(userId);
        // 공백만 들어오는 경우는 @NotBlank 가 먼저 거른다 — 여기서는 다듬기만 한다
        user.updateProfile(request.name().trim(), user.getAvatarUrl());
        log.info("사용자 {} 가 이름을 바꿨다", userId);
        return UserResponse.from(user);
    }

    /** 이 계정에 연결된 소셜 제공자. 없으면 빈 목록이다. */
    @Transactional(readOnly = true)
    public List<SocialIdentityResponse> socialIdentities(UUID userId) {
        return identities.findByUserId(userId).stream().map(SocialIdentityResponse::from).toList();
    }
}
