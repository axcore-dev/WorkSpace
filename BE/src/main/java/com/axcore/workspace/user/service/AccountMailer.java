package com.axcore.workspace.user.service;

import com.axcore.workspace.notification.MailMessage;
import com.axcore.workspace.notification.MailProperties;
import com.axcore.workspace.notification.MailSender;
import com.axcore.workspace.user.entity.User;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * 계정 관련 메일 본문을 만든다.
 *
 * <p>문구를 서비스마다 흩어 두면 톤이 갈리고, 무엇보다 "링크가 얼마 뒤 만료되는지"를 적는 걸
 * 빠뜨리기 쉽다. 만료를 적지 않으면 사용자는 링크가 죽은 이유를 알 수 없다.
 *
 * <p>본문에 토큰과 코드가 그대로 들어간다. 이 클래스가 만든 문자열은 로그로 나가면 안 되고,
 * 그 규칙이 깨지는 유일한 지점이 개발용 {@code LoggingMailSender} 다.
 */
@Component
public class AccountMailer {

    private final MailSender mailSender;
    private final MailProperties properties;

    public AccountMailer(MailSender mailSender, MailProperties properties) {
        this.mailSender = mailSender;
        this.properties = properties;
    }

    public void sendEmailVerification(User user, String rawToken, Duration ttl) {
        String link = properties.emailVerificationLink(rawToken);
        send(
                user,
                "[AXpoint] 이메일 주소를 확인해 주세요",
                """
                %s 님, 환영합니다.

                아래 링크를 열면 이메일 주소 확인이 끝납니다.

                %s

                이 링크는 %s 뒤에 만료됩니다.
                본인이 가입한 것이 아니라면 이 메일을 무시하셔도 됩니다.
                """
                        .formatted(user.getName(), link, humanize(ttl)));
    }

    public void sendPasswordReset(User user, String rawToken, Duration ttl) {
        String link = properties.passwordResetLink(rawToken);
        send(
                user,
                "[AXpoint] 비밀번호 재설정",
                """
                %s 님, 비밀번호 재설정 요청을 받았습니다.

                아래 링크에서 새 비밀번호를 설정하세요.

                %s

                이 링크는 %s 뒤에 만료되고, 한 번만 사용할 수 있습니다.

                본인이 요청하지 않았다면 이 메일을 무시하세요. 링크를 열지 않는 한
                비밀번호는 바뀌지 않습니다. 다만 누군가 회원님의 이메일 주소를 알고
                있다는 뜻이므로, 비밀번호를 한 번 바꿔 두시길 권합니다.
                """
                        .formatted(user.getName(), link, humanize(ttl)));
    }

    /**
     * 로그인 도중의 2단계 코드.
     *
     * <p>"본인이 아니라면 비밀번호를 바꾸라"는 문장을 넣는 이유: 이 메일이 왔다는 것은 누군가
     * 비밀번호를 맞혔다는 뜻이다. 코드가 새지 않아도 비밀번호는 이미 노출된 상태다.
     */
    public void sendLoginCode(User user, String code, Duration ttl) {
        send(
                user,
                "[AXpoint] 로그인 확인 코드",
                """
                로그인 확인 코드입니다.

                    %s

                %s 뒤에 만료됩니다.

                본인이 로그인을 시도한 것이 아니라면, 누군가 회원님의 비밀번호를
                알고 있다는 뜻입니다. 지금 바로 비밀번호를 변경하세요.
                """
                        .formatted(code, humanize(ttl)));
    }

    /** 2단계 수단을 켤 때 보내는 소유 확인 코드. 로그인용과 문구를 나눈다. */
    public void sendEnrollmentCode(User user, String code, Duration ttl) {
        send(
                user,
                "[AXpoint] 2단계 인증 등록 확인",
                """
                2단계 인증을 켜기 위한 확인 코드입니다.

                    %s

                %s 뒤에 만료됩니다.

                코드를 입력하면 다음 로그인부터 이 주소로 확인 코드가 발송됩니다.
                """
                        .formatted(code, humanize(ttl)));
    }

    /**
     * 비밀번호가 바뀌었음을 알린다. 코드도 링크도 없는 순수 통지다.
     *
     * <p>바뀐 뒤에 보내는 것이 중요하다. 사용자가 모르는 사이에 바뀌었다면 이 메일이 유일한
     * 신호다.
     */
    public void sendPasswordChanged(User user) {
        send(
                user,
                "[AXpoint] 비밀번호가 변경되었습니다",
                """
                %s 님의 비밀번호가 방금 변경되었습니다.
                모든 기기에서 로그아웃되었으므로 새 비밀번호로 다시 로그인해 주세요.

                본인이 변경한 것이 아니라면 즉시 비밀번호 재설정을 요청하고
                관리자에게 알려 주세요.
                """
                        .formatted(user.getName()));
    }

    /**
     * 계정이 잠겼다.
     *
     * <p>해제 방법을 반드시 적는다. 잠긴 계정의 로그인 응답은 다른 실패와 같은 401 이라
     * 화면만 보고는 무엇이 잘못됐는지 알 수 없고, 시간이 지나도 풀리지 않기 때문이다.
     *
     * <p>재설정 링크는 여기에 넣지 않는다. 링크를 담으려면 토큰을 발급해야 하는데, 그러면
     * 남의 주소로 로그인을 6번 틀리는 것만으로 유효한 재설정 토큰을 발송시킬 수 있다.
     */
    public void sendAccountLocked(User user) {
        send(
                user,
                "[AXpoint] 계정이 잠겼습니다",
                """
                %s 님의 계정이 비밀번호 연속 실패 %d회로 잠겼습니다.
                보안을 위해 시간이 지나도 자동으로 풀리지 않습니다.
                로그인 화면의 "비밀번호를 잊으셨나요"에서 재설정을 요청하고 새 비밀번호를
                설정하면 잠금이 함께 풀립니다.
                본인이 시도한 것이 아니라면, 누군가 회원님의 계정 비밀번호를 추측하고
                있다는 뜻입니다. 다른 곳에서 같은 비밀번호를 쓰고 있다면 그쪽도 바꾸세요.
                """
                        .formatted(user.getName(), User.MAX_LOGIN_ATTEMPTS));
    }

    private void send(User user, String subject, String body) {
        mailSender.send(new MailMessage(user.getEmail(), subject, body));
    }

    /** "30분" · "24시간" 처럼 읽히게. 분 단위 미만은 쓰지 않으므로 다루지 않는다. */
    private static String humanize(Duration ttl) {
        long minutes = ttl.toMinutes();
        if (minutes < 60) {
            return minutes + "분";
        }
        long hours = ttl.toHours();
        return hours % 24 == 0 && hours >= 24 ? (hours / 24) + "일" : hours + "시간";
    }
}
