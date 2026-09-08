package com.axcore.workspace.user.controller;

import com.axcore.workspace.user.service.ProfilePhotoService;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * 프로필 사진을 내려주는 곳. <b>로그인 없이 열린다.</b>
 *
 * <p>{@code <img src>} 에는 Authorization 헤더를 실을 수 없어서 다른 방법이 없다. 대신 세 가지로 막는다.
 *
 * <ol>
 *   <li>주소가 추측할 수 없는 uuid 다. 목록으로 훑을 경로를 두지 않았고, 모양이 맞지 않는 값은 스토리지에
 *       묻지도 않는다 — 경로 조작으로 버킷의 다른 객체를 꺼낼 수 없다.
 *   <li>사진을 바꾸거나 지우면 새 키를 발급하고 옛 객체를 지운다. 흘러 나간 주소가 계속 살아 있지 않다.
 *   <li>내려주는 것은 이미지 바이트뿐이고, 형식은 올릴 때 앞머리로 판정한 값이다. 브라우저가 다시
 *       추측하지 못하게 {@code nosniff} 를 붙인다.
 * </ol>
 *
 * <p>주소에 계정 정보가 없다는 점도 의도한 것이다. 키만 봐서는 누구의 사진인지 알 수 없다.
 */
@RestController
@RequestMapping("/api/avatars")
public class AvatarController {

    /** 키가 바뀌면 주소도 바뀐다. 그래서 오래 캐시해도 옛 사진이 남지 않는다. */
    private static final Duration CACHE = Duration.ofDays(30);

    private final ProfilePhotoService photos;

    public AvatarController(ProfilePhotoService photos) {
        this.photos = photos;
    }

    /** 주소는 저장 위치를 그대로 따른다 — {@code /api/avatars/<사용자 id>/<uuid>.<확장자>} */
    @GetMapping("/{userFolder}/{fileName}")
    public ResponseEntity<byte[]> avatar(
            @PathVariable String userFolder, @PathVariable String fileName) {
        return photos.read(userFolder, fileName)
                .map(AvatarController::image)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static ResponseEntity<byte[]> image(ProfilePhotoService.Photo object) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(object.contentType()))
                .cacheControl(CacheControl.maxAge(CACHE).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                // 브라우저가 문서로 열지 않게 못 박는다. 이미지로만 쓰인다
                .header("Content-Disposition", "inline")
                .body(object.body());
    }
}
