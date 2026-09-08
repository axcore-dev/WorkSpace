package com.axcore.workspace.storage;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 오브젝트 키를 만드는 유일한 자리.
 *
 * <p><b>사용자가 준 문자열이 키에 들어가지 않는다.</b> 파일명을 그대로 붙이면 {@code ../} 나 앞의 슬래시
 * 하나로 남의 객체를 덮어쓸 수 있다. 확장자만 미리 정한 목록에서 고르고 나머지는 우리가 만든 uuid 다.
 */
public final class StorageKeys {

    /**
     * 프로필 사진 접두어. 그 아래를 <b>사용자별 폴더</b>로 나눈다 —
     * {@code profile/<사용자 id>/<uuid>.<확장자>}
     *
     * <p>한 폴더에 전부 쌓으면 객체가 늘수록 콘솔에서 찾기 어렵고, 계정을 지울 때 무엇을 함께 지워야 하는지
     * 목록을 따로 들고 있어야 한다. 사용자 id 로 갈라 두면 그 마디만 비우면 된다.
     *
     * <p>회사 스키마 마디는 두지 않는다. 계정은 회사에 딸린 것이 아니라 회사를 옮겨 다닌다 —
     * AI 문서({@code <회사 스키마>/ai-sources/...})와 갈리는 지점이 여기다.
     *
     * <p>사용자 id 가 공개 주소에 드러난다. 그 값은 계정 화면이 이미 사용자에게 보여 주는 값이고
     * (문의할 때 복사하는 「사용자 ID」), 이걸 안다고 사진 주소를 맞힐 수는 없다 — 파일 이름 쪽 uuid 가 남는다.
     */
    private static final String AVATAR_PREFIX = "profile/";

    /** 지원하는 형식. 브라우저가 다 그리고, 서버가 형식을 다시 확인할 수 있는 것들이다. */
    private static final Pattern AVATAR_KEY =
            Pattern.compile("^profile/[0-9a-f-]{36}/[0-9a-f-]{36}\\.(png|jpg|webp)$");

    private StorageKeys() {}

    /**
     * 새 프로필 사진 키. 바꿀 때마다 새 uuid 라 옛 주소가 새 사진을 가리키는 일이 없다.
     *
     * @param contentType 검증을 마친 값이어야 한다
     */
    public static String newAvatarKey(UUID userId, String contentType) {
        return avatarFolder(userId) + UUID.randomUUID() + "." + extensionOf(contentType);
    }

    /** 한 사용자의 사진이 모이는 마디. 공개 경로가 파일 이름을 여기 붙여 키로 되돌린다. */
    public static String avatarFolder(UUID userId) {
        return AVATAR_PREFIX + userId + "/";
    }

    /**
     * 밖에서 들어온 키가 우리가 만든 모양인지. 공개 경로가 이 검사를 통과한 값만 스토리지에 묻는다 —
     * 통과하지 못하면 조회 자체를 하지 않는다.
     */
    public static boolean isAvatarKey(String key) {
        return key != null && AVATAR_KEY.matcher(key).matches();
    }

    /** 키의 확장자로 되짚은 형식. 내려줄 때 {@code Content-Type} 을 채운다. */
    public static Optional<String> contentTypeOf(String key) {
        if (!isAvatarKey(key)) {
            return Optional.empty();
        }
        String ext = key.substring(key.lastIndexOf('.') + 1);
        return Optional.of(
                switch (ext) {
                    case "png" -> "image/png";
                    case "webp" -> "image/webp";
                    default -> "image/jpeg";
                });
    }

    private static String extensionOf(String contentType) {
        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/jpeg" -> "jpg";
            default -> throw new IllegalArgumentException("지원하지 않는 형식입니다: " + contentType);
        };
    }
}
