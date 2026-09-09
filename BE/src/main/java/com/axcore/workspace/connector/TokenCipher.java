package com.axcore.workspace.connector;

import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 제공자 토큰을 DB 에 넣기 전에 잠근다. AES-256-GCM, 키는 환경변수 하나.
 *
 * <p>직접 만든 암호가 아니다 — JDK 의 {@code javax.crypto} 그대로다(루트 CLAUDE.md: 검증된 알고리즘만).
 * GCM 은 인증 태그가 붙어서 DB 의 값이 바뀌면 복호화가 실패한다. 조용히 엉뚱한 토큰이 나오지 않는다.
 *
 * <p>저장 형식은 {@code base64(iv 12바이트 ‖ 암호문 ‖ 태그 16바이트)}. IV 는 매번 새로 뽑는다 —
 * 같은 키로 IV 를 재사용하면 GCM 은 깨진다.
 *
 * <p>키가 비어 있으면 {@link #available()} 이 false 다. 그때 연결을 시도하면 503 이다. 평문으로 저장하는
 * 대체 경로는 두지 않는다.
 */
@Component
public class TokenCipher {

    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();

    public TokenCipher(ConnectorProperties properties) {
        this.key = properties.configured() ? load(properties.tokenKey()) : null;
    }

    public boolean available() {
        return key != null;
    }

    public String encrypt(String plain) {
        requireKey();
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + sealed.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(sealed, 0, out, iv.length, sealed.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("토큰을 잠그지 못했다", e);
        }
    }

    public String decrypt(String stored) {
        requireKey();
        try {
            byte[] in = Base64.getDecoder().decode(stored);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, in, 0, IV_BYTES));
            return new String(cipher.doFinal(in, IV_BYTES, in.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // 키가 바뀌었거나 값이 손상됐다. 토큰을 잃은 것이니 다시 연결해야 한다
            throw new ConnectorNotConnectedException("저장된 연결 정보를 읽을 수 없습니다. 다시 연결해 주세요");
        }
    }

    private void requireKey() {
        if (key == null) {
            throw new ConnectorUnavailableException("연동 토큰 키(CONNECTOR_TOKEN_KEY)가 설정되지 않았습니다");
        }
    }

    private static SecretKey load(String base64) {
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("CONNECTOR_TOKEN_KEY 는 base64 여야 한다", e);
        }
        if (raw.length != 32) {
            // 부팅에서 막는다. 짧은 키로 조용히 돌다가 운영에서 바꾸면 기존 토큰을 전부 잃는다
            throw new IllegalStateException(
                    "CONNECTOR_TOKEN_KEY 는 32바이트여야 한다 (지금 " + raw.length + "바이트). openssl rand -base64 32");
        }
        return new SecretKeySpec(raw, "AES");
    }
}
