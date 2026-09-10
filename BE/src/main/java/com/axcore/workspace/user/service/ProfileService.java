package com.axcore.workspace.user.service;

import com.axcore.workspace.user.dto.ProfileUpdateRequest;
import com.axcore.workspace.user.dto.SocialIdentityResponse;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.entity.AuthProvider;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserIdentity;
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

    /**
     * 소셜 연동 해제.
     *
     * <p><b>마지막 로그인 수단은 지우지 않는다.</b> 남는 수단이 하나도 없으면 — 비밀번호가 없고 이 연동이 유일한 소셜
     * 연동이면 — 다시 로그인할 길이 없어진다. 그 경우 409 로 막고 문구로 나갈 길을 알려 준다. 비밀번호가 있으면
     * 소셜을 전부 끊어도 이메일·비밀번호로 들어올 수 있으니 막지 않는다.
     *
     * <p>판정은 이 트랜잭션 안의 계정 상태로 한다. 같은 계정에서 두 제공자 해제를 동시에 보내면 둘 다 "하나 남았다"
     * 를 보고 통과할 수 있는데, 자기 계정에서 자기 손으로만 낼 수 있는 요청이라 잠그지 않는다. 그렇게 되어도
     * 비밀번호 재설정 링크가 이메일로 가므로 계정을 되찾을 수 있다.
     *
     * <p>세션은 끊지 않는다. 비밀번호 변경·2단계 해제와 달리 방어를 걷어내는 조작이 아니라 로그인 수단을 하나 빼는
     * 것이라, 지금 이 세션이 유출된 세션이라고 볼 근거가 없다.
     */
    @Transactional
    public void unlinkSocial(UUID userId, AuthProvider provider) {
        User user = auth.requireUser(userId);
        UserIdentity identity =
                identities.findByUserIdAndProvider(userId, provider).orElseThrow(SocialIdentityNotFoundException::new);

        boolean lastMethod = !user.hasPassword() && identities.findByUserId(userId).size() <= 1;
        if (lastMethod) {
            throw new LastLoginMethodException();
        }

        identities.delete(identity);
        log.info("사용자 {} 가 {} 연동을 해제했다", userId, provider.dbValue());
    }
}
