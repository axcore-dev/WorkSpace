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
 *                JSON 응답을 보게 되고, 토큰이 브라우저 히스토리·프록시 로그·Referer 헤더에 남는다.
 *                기본값 포트는 8000 이다 — FE 가 {@code next dev -p 8000} 으로 돈다.
 *                Next.js 기본값 3000 이 아니다.
 * @param from    보내는 주소. 표시용이며 실제 발송 권한은 전송 수단이 가진다.
 */
@ConfigurationProperties(prefix = "app.mail")
public record MailProperties(
        @DefaultValue("log") String mode,
        @DefaultValue("http://localhost:8000") String baseUrl,
        @DefaultValue("no-reply@axcore.ai.kr") String from) {

    /**
     * 이메일 확인 화면 링크.
     *
     * <p>경로에 {@code /auth} 가 없다. FE 의 인증 화면은 {@code FE/app/(auth)/} 아래에 있지만
     * 괄호가 붙은 폴더는 Next.js 라우트 그룹이라 URL 에 나타나지 않는다. 실제 주소는
     * {@code /login} · {@code /signup} 이고 FE 코드도 그렇게 링크한다.
     */
    public String emailVerificationLink(String token) {
        return "%s/verify-email?token=%s".formatted(trimmedBaseUrl(), token);
    }

    /** 비밀번호 재설정 화면 링크. 경로 규칙은 {@link #emailVerificationLink} 와 같다. */
    public String passwordResetLink(String token) {
        return "%s/reset-password?token=%s".formatted(trimmedBaseUrl(), token);
    }

    /** 설정값 끝에 슬래시가 붙어 있으면 링크에 {@code //} 가 생긴다. */
    /**
     * 워크스페이스 접속 링크.
     *
     * <p>토큰이 URL 에 실리는 것은 이메일 확인·비밀번호 재설정과 같다. 화면이 여기서 토큰을
     * 꺼내 본문으로 보내는 구조라, 서버로 가는 요청에는 토큰이 URL 에 남지 않는다.
     */
    public String workspaceInviteLink(String token) {
        return "%s/join-workspace?token=%s".formatted(trimmedBaseUrl(), token);
    }

    private String trimmedBaseUrl() {
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }
}
