package com.axcore.workspace.notification;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 메일 관련 설정. {@code app.mail.*} 로 주입된다.
 *
 * @param mode    발송 방식. {@code log} 면 실제로 보내지 않고 콘솔에만 찍는다. 이 값이 {@code log}
 *                가 아닌데 발송 구현체가 등록돼 있지 않으면 부팅이 실패한다 —
 *                {@link LoggingMailSender} 참고. 조용히 안 보내는 것보다 못 뜨는 편이 낫다.
 * @param baseUrl 메일에 실리는 링크의 앞부분. <b>API 주소가 아니라 사용자가 여는 화면(FE) 주소다.</b>
 *                토큰을 받아 API 로 넘기는 것은 화면의 몫이다. API 주소를 그대로 보내면 사용자가
 *                JSON 응답을 보게 된다.
 * @param from    보내는 주소. 표시용이며 실제 발송 권한은 전송 수단이 가진다.
 */
@ConfigurationProperties(prefix = "app.mail")
public record MailProperties(
        @DefaultValue("log") String mode,
        @DefaultValue("http://localhost:3000") String baseUrl,
        @DefaultValue("no-reply@axcore.ai.kr") String from) {

    /** 이메일 확인 화면 링크. */
    public String emailVerificationLink(String token) {
        return "%s/auth/verify-email?token=%s".formatted(trimmedBaseUrl(), token);
    }

    /** 비밀번호 재설정 화면 링크. */
    public String passwordResetLink(String token) {
        return "%s/auth/reset-password?token=%s".formatted(trimmedBaseUrl(), token);
    }

    /** 설정값 끝에 슬래시가 붙어 있으면 링크에 {@code //} 가 생긴다. */
    private String trimmedBaseUrl() {
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }
}
