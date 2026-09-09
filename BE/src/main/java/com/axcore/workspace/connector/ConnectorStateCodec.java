package com.axcore.workspace.connector;

import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/**
 * OAuth {@code state} — 제공자에게 갔다가 그대로 돌아오는 값. 우리가 서명해 두고 돌아왔을 때 확인한다.
 *
 * <p>소셜 로그인은 로그인 전이라 브라우저 sessionStorage 로 state 를 지켰다({@code FE/lib/auth.ts}). 여기는
 * 로그인한 사람이 회사 설정에서 시작하므로 <b>서버가 서명</b>한다: 어느 회사 · 누가 · 어느 앱 · 언제까지.
 * 돌아온 값이 서명과 맞고, 지금 요청한 사람·회사와 같아야 토큰을 저장한다. 공격자가 자기 구글 계정의
 * code 를 피해자 회사에 심는 것을 막는다.
 *
 * <p>모양은 {@code cn.<slug>.<payload>.<sig>} 다. 앞의 {@code cn.} 은 화면이 소셜 로그인 콜백과 같은 주소로
 * 돌아온 이 흐름을 알아보는 표지이고, slug 는 화면이 어느 앱의 콜백을 부를지 알기 위해 보이게 둔다.
 * 둘 다 서명 안에 들어 있어서 바꾸면 검증에 실패한다.
 */
@Component
public class ConnectorStateCodec {

    public static final String PREFIX = "cn.";
    private static final Duration TTL = Duration.ofMinutes(10);
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    private final byte[] key;
    private final SecureRandom random = new SecureRandom();

    public ConnectorStateCodec(ConnectorProperties properties) {
        // 토큰 키와 같은 비밀을 쓴다. 용도가 갈리지만(암호화 vs 서명) 키를 하나 더 받게 만들 만큼의 위험은 아니다
        this.key = properties.configured()
                ? properties.tokenKey().trim().getBytes(StandardCharsets.UTF_8)
                : null;
    }

    /** 검증을 마친 state 의 내용 */
    public record Claims(Long workspaceId, UUID userId, String slug) {}

    public String issue(Long workspaceId, UUID userId, String slug, Instant now) {
        requireKey();
        byte[] nonce = new byte[8];
        random.nextBytes(nonce);
        String payload =
                B64.encodeToString(
                        (workspaceId + "|" + userId + "|" + slug + "|" + now.plus(TTL).getEpochSecond()
                                        + "|" + B64.encodeToString(nonce))
                                .getBytes(StandardCharsets.UTF_8));
        return PREFIX + slug + "." + payload + "." + sign(slug + "." + payload);
    }

    /** 화면이 콜백 주소에서 slug 만 먼저 꺼낼 때 쓴다. 검증은 아니다. */
    public static Optional<String> slugOf(String state) {
        if (state == null || !state.startsWith(PREFIX)) {
            return Optional.empty();
        }
        String[] parts = state.substring(PREFIX.length()).split("\\.", 3);
        return parts.length == 3 ? Optional.of(parts[0]) : Optional.empty();
    }

    /** 서명 · 만료 · 형식이 맞으면 내용을 돌려준다. 하나라도 어긋나면 빈 값이다 — 이유를 가르지 않는다. */
    public Optional<Claims> verify(String state, Instant now) {
        if (key == null || state == null || !state.startsWith(PREFIX)) {
            return Optional.empty();
        }
        String[] parts = state.substring(PREFIX.length()).split("\\.", 3);
        if (parts.length != 3) {
            return Optional.empty();
        }
        String slug = parts[0];
        String payload = parts[1];
        byte[] expected = sign(slug + "." + payload).getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, parts[2].getBytes(StandardCharsets.UTF_8))) {
            return Optional.empty();
        }
        try {
            String[] f = new String(B64D.decode(payload), StandardCharsets.UTF_8).split("\\|");
            if (f.length != 5 || !f[2].equals(slug)) {
                return Optional.empty();
            }
            if (Instant.ofEpochSecond(Long.parseLong(f[3])).isBefore(now)) {
                return Optional.empty();
            }
            return Optional.of(new Claims(Long.parseLong(f[0]), UUID.fromString(f[1]), slug));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return B64.encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private void requireKey() {
        if (key == null) {
            throw new ConnectorUnavailableException("연동 토큰 키(CONNECTOR_TOKEN_KEY)가 설정되지 않았습니다");
        }
    }
}
