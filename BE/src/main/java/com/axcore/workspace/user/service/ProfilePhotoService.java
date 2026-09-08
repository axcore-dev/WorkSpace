package com.axcore.workspace.user.service;

import com.axcore.workspace.storage.ImageBytes;
import com.axcore.workspace.storage.ObjectStorage;
import com.axcore.workspace.storage.StorageKeys;
import com.axcore.workspace.storage.StorageUnavailableException;
import com.axcore.workspace.user.dto.UserResponse;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 프로필 사진 올리기 · 지우기 · 내려주기.
 *
 * <p><b>계정은 여기서 직접 읽는다.</b> 컨트롤러가 먼저 읽어 넘기면 준영속 객체라 변경이 저장되지 않는다
 * ({@code spring.jpa.open-in-view=false}). {@link PasswordService#change} 에서 실제로 겪은 문제다.
 *
 * <p><b>저장 순서가 규칙이다.</b> 먼저 새 객체를 올리고, DB 를 바꾸고, 그다음에 옛 객체를 지운다.
 * 반대로 하면 DB 저장이 실패했을 때 사진만 사라진 계정이 남는다. 옛 객체 삭제가 실패해도 사용자에게는
 * 성공이다 — 아무도 가리키지 않는 파일 하나가 버킷에 남을 뿐이고, 그걸로 요청을 실패시킬 이유가 없다.
 */
@Service
public class ProfilePhotoService {

    private static final Logger log = LoggerFactory.getLogger(ProfilePhotoService.class);

    /** 올릴 수 있는 최대 크기. 화면이 먼저 줄여서 보내므로 넉넉한 상한이다 */
    public static final long MAX_BYTES = 2 * 1024 * 1024;

    private final UserRepository users;
    private final ObjectStorage storage;

    public ProfilePhotoService(UserRepository users, ObjectStorage storage) {
        this.users = users;
        this.storage = storage;
    }

    /**
     * 사진을 갈아 끼운다.
     *
     * @param bytes 파일 본문. 형식은 <b>바이트 앞머리로 판정</b>하고 요청에 실려 온 {@code Content-Type} 은 버린다
     */
    @Transactional
    public UserResponse upload(UUID userId, byte[] bytes) {
        if (!storage.available()) {
            throw new StorageUnavailableException("파일 저장소가 설정되지 않아 사진을 올릴 수 없습니다");
        }
        if (bytes.length == 0) {
            throw new InvalidImageException("빈 파일입니다");
        }
        if (bytes.length > MAX_BYTES) {
            throw new InvalidImageException("사진은 2MB 까지 올릴 수 있습니다");
        }
        String contentType =
                ImageBytes.detect(bytes)
                        .orElseThrow(
                                () -> new InvalidImageException("PNG · JPG · WebP 이미지만 올릴 수 있습니다"));

        User user = require(userId);
        String previous = user.getAvatarObjectKey();
        String key = StorageKeys.newAvatarKey(userId, contentType);

        storage.put(key, bytes, contentType);
        user.changeAvatarObjectKey(key);
        log.info("사용자 {} 가 프로필 사진을 올렸다 ({} bytes, {})", userId, bytes.length, contentType);

        deleteQuietly(previous);
        return UserResponse.from(user);
    }

    /** 올린 사진을 지운다. 소셜 사진이 있으면 그쪽으로 되돌아간다. */
    @Transactional
    public UserResponse delete(UUID userId) {
        User user = require(userId);
        String previous = user.getAvatarObjectKey();
        if (previous == null) {
            return UserResponse.from(user);
        }
        user.changeAvatarObjectKey(null);
        deleteQuietly(previous);
        log.info("사용자 {} 가 프로필 사진을 지웠다", userId);
        return UserResponse.from(user);
    }

    /**
     * 공개 경로가 내려줄 이미지. 주소의 두 마디(사용자 id · 파일 이름)를 우리 키로 되돌린다.
     *
     * <p>DB 를 보지 않는다. 키 자체가 자물쇠라(추측할 수 없는 uuid) 어느 계정의 것인지 확인할 필요가 없고,
     * 확인하려면 사진 한 장마다 조회가 한 번 더 붙는다. 대신 <b>모양이 맞는 키만</b> 스토리지에 묻는다 —
     * 아니면 경로 조작으로 버킷의 다른 객체를 꺼낼 수 있다.
     */
    public Optional<Photo> read(String userFolder, String fileName) {
        String key = "profile/" + userFolder + "/" + fileName;
        if (!StorageKeys.isAvatarKey(key) || !storage.available()) {
            return Optional.empty();
        }
        // 형식은 키가 정한다. isAvatarKey 를 통과했으니 contentTypeOf 는 항상 값이 있다
        String contentType = StorageKeys.contentTypeOf(key).orElseThrow();
        return storage.get(key).map(body -> new Photo(body, contentType));
    }

    /** 내려줄 사진. 형식은 저장할 때 키에 새긴 확장자에서 되짚은 값이다 — 스토리지가 기억하는 값이 아니다 */
    public record Photo(byte[] body, String contentType) {}

    /**
     * 한 사용자의 사진 폴더를 통째로 비운다. 계정을 지울 때 부른다.
     *
     * <p><b>계정 행을 지운 트랜잭션이 커밋된 뒤에 불러야 한다.</b> 안에서 부르면 커밋이 실패했을 때
     * 행은 살아 있는데 사진만 사라진 계정이 남는다. 실패해도 예외를 내지 않는다 — 계정은 이미 지워졌고,
     * 남은 파일은 {@link AvatarSweeper} 가 주인 없는 파일로 잡아 지운다.
     */
    public void deleteFolder(UUID userId) {
        if (!storage.available()) {
            return;
        }
        try {
            List<ObjectStorage.Listed> objects = storage.list(StorageKeys.avatarFolder(userId));
            objects.forEach(o -> storage.delete(o.key()));
            if (!objects.isEmpty()) {
                log.info("사용자 {} 의 프로필 사진 폴더를 비웠다 ({}개)", userId, objects.size());
            }
        } catch (RuntimeException e) {
            log.warn("사용자 {} 의 프로필 사진 폴더를 비우지 못했다. 청소가 다시 시도한다", userId, e);
        }
    }

    /**
     * 옛 객체를 지운다. 실패해도 요청은 성공으로 끝낸다 — 사용자는 이미 새 사진을 보고 있고, DB 는 새 키를
     * 가리킨다. 남은 파일은 어느 행도 가리키지 않으므로 {@link AvatarSweeper} 가 다음 순회에서 지운다.
     */
    private void deleteQuietly(String key) {
        if (key == null) {
            return;
        }
        try {
            storage.delete(key);
        } catch (RuntimeException e) {
            log.warn("옛 프로필 사진 {} 을 지우지 못했다. 청소가 다시 시도한다", key, e);
        }
    }

    private User require(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> new BadCredentialsException("세션이 만료되었습니다. 다시 로그인해 주세요"));
    }

    /** 올린 파일이 이미지가 아니거나 너무 크다. 400 으로 나간다. */
    public static class InvalidImageException extends RuntimeException {
        public InvalidImageException(String message) {
            super(message);
        }
    }
}
