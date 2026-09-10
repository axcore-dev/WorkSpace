package com.axcore.workspace.user.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.dto.OAuthLoginRequest;
import com.axcore.workspace.user.dto.ProfileUpdateRequest;
import com.axcore.workspace.user.dto.SocialIdentityResponse;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.entity.AuthProvider;
import com.axcore.workspace.user.service.ProfilePhotoService;
import com.axcore.workspace.user.service.ProfileService;
import com.axcore.workspace.user.service.SocialIdentityNotFoundException;
import com.axcore.workspace.user.service.SocialLoginService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * 설정 › 계정 화면이 쓰는 경로. 로그인한 사람이 자기 정보를 보고 고치는 자리다.
 *
 * <p>{@link AuthController} 와 나눈 이유는 그 파일의 규칙 그대로다 — 거기는 세션을 만들고 없애는 경로만 둔다.
 * 읽기({@code GET /api/auth/me})는 로그인 직후에도 쓰여서 저쪽에 남아 있고, 여기는 계정 화면 전용이다.
 *
 * <p>비밀번호({@code /password}) · 2단계 인증({@code /mfa}) · 세션({@code /sessions}) · 이메일 확인
 * ({@code /email})은 각자의 컨트롤러에 이미 있다.
 */
@RestController
@RequestMapping("/api/auth")
public class ProfileController {

    private final ProfileService profiles;
    private final ProfilePhotoService photos;
    private final SocialLoginService socialLogin;

    public ProfileController(ProfileService profiles, ProfilePhotoService photos, SocialLoginService socialLogin) {
        this.profiles = profiles;
        this.photos = photos;
        this.socialLogin = socialLogin;
    }

    /** 이름 변경. 바뀐 계정 전체를 돌려준다 — 화면이 헤더까지 한 번에 맞춘다. */
    @PatchMapping("/profile")
    public UserResponse updateProfile(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileUpdateRequest request) {
        return profiles.updateProfile(JwtPrincipal.of(jwt).userId(), request);
    }

    /** 이 계정에 연결된 소셜 제공자. */
    @GetMapping("/identities")
    public List<SocialIdentityResponse> identities(@AuthenticationPrincipal Jwt jwt) {
        return profiles.socialIdentities(JwtPrincipal.of(jwt).userId());
    }

    /**
     * 소셜 연동 추가 — 로그인한 상태에서. 화면이 제공자 동의 화면을 거쳐 받은 code 를 넘긴다.
     * 로그인용 {@code POST /api/auth/oauth/{provider}} 와 본문은 같지만 여기서는 세션을 만들지 않고 <b>현재 계정</b>에 붙인다.
     *
     * <p>그 제공자 계정이 다른 사용자에게 이미 연결돼 있으면 409({@code ACCOUNT_STATE_CONFLICT}) 로 막고 그렇다고 알려 준다.
     * 판정은 {@link com.axcore.workspace.user.service.SocialAccountLinker#linkToCurrent} 가 한다.
     */
    @PostMapping("/identities/{provider}")
    @ResponseStatus(HttpStatus.CREATED)
    public SocialIdentityResponse linkIdentity(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String provider,
            @Valid @RequestBody OAuthLoginRequest request) {
        AuthProvider parsed = AuthProvider.from(provider).orElseThrow(SocialIdentityNotFoundException::new);
        return SocialIdentityResponse.from(
                socialLogin.link(JwtPrincipal.of(jwt).userId(), parsed, request.code(), request.state()));
    }

    /**
     * 소셜 연동 해제. 경로의 제공자는 {@code google} · {@code naver} 같은 소문자 값이다.
     *
     * <p>마지막 로그인 수단이면 409({@code ACCOUNT_STATE_CONFLICT}), 그 제공자 연동이 없거나 모르는 이름이면 404.
     * 판정은 {@link ProfileService#unlinkSocial} 이 한다.
     */
    @DeleteMapping("/identities/{provider}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlinkIdentity(@AuthenticationPrincipal Jwt jwt, @PathVariable String provider) {
        AuthProvider parsed = AuthProvider.from(provider).orElseThrow(SocialIdentityNotFoundException::new);
        profiles.unlinkSocial(JwtPrincipal.of(jwt).userId(), parsed);
    }

    /**
     * 프로필 사진 올리기. {@code multipart/form-data} 의 {@code file} 한 칸이다.
     *
     * <p>형식은 파일 앞머리로 판정한다 — 요청이 적어 보낸 {@code Content-Type} 과 파일 이름은 쓰지 않는다.
     * 올린 사진은 {@link AvatarController} 가 로그인 없이 내려준다.
     */
    @PostMapping(path = "/profile/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserResponse uploadPhoto(
            @AuthenticationPrincipal Jwt jwt, @RequestPart("file") MultipartFile file)
            throws IOException {
        return photos.upload(JwtPrincipal.of(jwt).userId(), file.getBytes());
    }

    /** 올린 사진 지우기. 소셜 사진이 있으면 그쪽으로 되돌아간다. */
    @DeleteMapping("/profile/photo")
    public UserResponse deletePhoto(@AuthenticationPrincipal Jwt jwt) {
        return photos.delete(JwtPrincipal.of(jwt).userId());
    }
}
