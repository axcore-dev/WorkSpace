package com.axcore.workspace.storage;

import java.util.Optional;

/**
 * 올라온 바이트가 정말 그 형식의 이미지인지 앞머리로 확인한다.
 *
 * <p><b>브라우저가 보낸 {@code Content-Type} 을 믿지 않는다.</b> 그 값은 요청을 만드는 쪽이 정하는 문자열일
 * 뿐이라, {@code image/png} 라고 적고 아무 파일이나 올릴 수 있다. 우리는 이 객체를 <b>로그인 없이</b>
 * 내려주므로, 버킷을 임의 파일 배포처로 쓰이게 두면 안 된다.
 *
 * <p>확인한 형식만 돌려주고, 저장할 때도 내려줄 때도 <b>여기서 판정한 값</b>을 쓴다. 요청에 실려 온 값은
 * 버린다. SVG 를 받지 않는 이유가 이것이다 — 스크립트를 담을 수 있는 문서 형식이라 이미지처럼 다루면 안 된다.
 *
 * <p>앞머리 검사는 위조가 가능하다(진짜 PNG 헤더 뒤에 무엇이든 붙일 수 있다). 그래도 의미가 있는 이유는
 * 브라우저가 그 바이트를 이미지로만 해석하기 때문이다. 내려줄 때 {@code Content-Type} 을 우리가 정하고
 * {@code X-Content-Type-Options: nosniff} 를 붙여 브라우저가 다시 추측하지 못하게 막는다.
 */
public final class ImageBytes {

    private ImageBytes() {}

    /** 알아본 형식. 모르는 형식이면 빈 값이다. */
    public static Optional<String> detect(byte[] bytes) {
        if (bytes == null || bytes.length < 12) {
            return Optional.empty();
        }
        if (startsWith(bytes, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) {
            return Optional.of("image/png");
        }
        // JPEG 은 SOI 마커(FFD8FF)로 시작한다
        if (startsWith(bytes, 0xFF, 0xD8, 0xFF)) {
            return Optional.of("image/jpeg");
        }
        // WebP 는 RIFF 컨테이너다: "RIFF" + 4바이트 길이 + "WEBP"
        if (startsWith(bytes, 'R', 'I', 'F', 'F')
                && bytes[8] == 'W'
                && bytes[9] == 'E'
                && bytes[10] == 'B'
                && bytes[11] == 'P') {
            return Optional.of("image/webp");
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] bytes, int... prefix) {
        if (bytes.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if ((bytes[i] & 0xFF) != (prefix[i] & 0xFF)) {
                return false;
            }
        }
        return true;
    }
}
