package com.axcore.workspace.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/**
 * 서버가 만들어 클라이언트에게 건네는 불투명 토큰의 생성·해시.
 *
 * <p>refresh 토큰 · 이메일 인증 링크 · 비밀번호 재설정 링크 · MFA 챌린지가 전부 같은 성질이다.
 * 사람이 고른 문자열이 아니라 256비트 난수이고, DB 에는 원문이 남지 않아야 하며, 유출된 덤프만으로
 * 로그인할 수 없어야 한다. 규칙이 같으니 구현도 한 곳에 둔다.
 *
 * <p>BCrypt 가 아니라 SHA-256 인 이유: 이 값들은 사전 공격 대상이 아니다. 256비트 난수를 되찾는
 * 방법은 전수 대입뿐이고 그건 해시 속도와 무관하다. 느린 해시는 토큰 검증 경로에 지연으로만 얹힌다.
 * 반대로 <b>사람이 읽고 옮겨 적는 짧은 코드</b>(MFA 6자리)는 여기서 다루지 않는다. 그쪽은 후보가
 * 100만 개뿐이라 느린 해시가 실제로 의미가 있어서 {@code PasswordEncoder} 를 쓴다.
 */
public final class SecureTokens {

    /** 256비트. 추측이 불가능한 수준이면 충분하고, 늘려도 얻는 게 없다. */
    private static final int TOKEN_BYTES = 32;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /** URL 에 그대로 실리므로 표준 알파벳의 {@code + / =} 를 쓰지 않는다. */
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    private SecureTokens() {
    }

    /**
     * 새 토큰 원문. 이 값이 클라이언트로 나가는 유일한 지점이므로 로그에 남기지 않는다.
     */
    public static String generate() {
        byte[] bytes = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return ENCODER.encodeToString(bytes);
    }

    /** 저장·조회 양쪽에서 같은 값이 나와야 하므로 여기 한 곳만 쓴다. hex 64자. */
    public static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of()
                    .formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 은 모든 JVM 이 제공한다", e);
        }
    }

    /**
     * 사람이 메일에서 읽어 옮겨 적는 6자리 코드.
     *
     * <p>{@code SecureRandom} 을 쓰는 이유는 이 값이 실제 인증 요소이기 때문이다. 자릿수가 짧은
     * 만큼 예측 가능성이 곧 우회이고, 저장할 때도 SHA-256 이 아니라 {@code PasswordEncoder} 를
     * 쓴다. 방어의 무게는 시도 횟수 제한과 짧은 만료가 진다.
     */
    public static String generateNumericCode(int digits) {
        StringBuilder code = new StringBuilder(digits);
        for (int i = 0; i < digits; i++) {
            code.append(SECURE_RANDOM.nextInt(10));
        }
        return code.toString();
    }

    /**
     * 만료 여부. {@code expiresAt} 이 과거면 만료다.
     *
     * <p>경계값(같은 시각)은 만료로 본다. 살아 있다고 보면 만료 시각 그 순간에 통과하는 경로가
     * 생기고, 이건 테스트에서만 보이고 운영에서는 재현되지 않는 종류의 차이다.
     */
    public static boolean isExpired(Instant expiresAt, Instant now) {
        return !expiresAt.isAfter(now);
    }
}
