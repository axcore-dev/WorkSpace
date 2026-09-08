package com.axcore.workspace.user.controller;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.dto.ProfileUpdateRequest;
import com.axcore.workspace.user.dto.SocialIdentityResponse;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.service.ProfilePhotoService;
import com.axcore.workspace.user.service.ProfileService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
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

    public ProfileController(ProfileService profiles, ProfilePhotoService photos) {
        this.profiles = profiles;
        this.photos = photos;
    }

    /** 이름 변경. 바뀐 계정 전체를 돌려준다 — 화면이 헤더까지 한 번에 맞춘다. */
    @PatchMapping("/profile")
    public UserResponse updateProfile(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileUpdateRequest request) {
        return profiles.updateProfile(JwtPrincipal.of(jwt).userId(), request);
    }

    /** 이 계정에 연결된 소셜 제공자. 해제 경로는 아직 없다 — 마지막 로그인 수단을 지우는 것을 먼저 막아야 한다. */
    @GetMapping("/identities")
    public List<SocialIdentityResponse> identities(@AuthenticationPrincipal Jwt jwt) {
        return profiles.socialIdentities(JwtPrincipal.of(jwt).userId());
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
