package com.axcore.workspace.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/**
 * 개발용 발송기. 메일을 보내지 않고 콘솔에 찍는다.
 *
 * <p>{@code app.mail.mode=log} 일 때만 등록된다. 기본값이 {@code log} 이므로 아무 설정 없이
 * 로컬을 띄우면 이쪽이 잡힌다. 반대로 운영에서 {@code app.mail.mode} 를 {@code smtp} 등으로
 * 바꾸면 이 빈이 사라지고, 그때 실제 구현체가 없으면 {@code MailSender} 주입이 실패해
 * <b>부팅 자체가 막힌다.</b> 의도한 동작이다. 메일이 조용히 안 나가는 상태로 운영에 올라가면
 * 비밀번호를 잃은 사용자가 복구할 방법이 없고, 그 사실은 아무 로그에도 남지 않는다.
 *
 * <p>본문에 확인 링크와 OTP 코드가 그대로 들어간다. 그래서 이 구현체는 <b>로컬 전용</b>이다.
 * 부팅할 때마다 경고를 남기는 이유가 이것이다.
 */
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "log", matchIfMissing = true)
public class LoggingMailSender implements MailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingMailSender.class);

    @PostConstruct
    void warnAboutMode() {
        log.warn(
                "메일이 실제로 발송되지 않는다. 확인 링크와 인증 코드가 로그에 그대로 남는다. "
                        + "운영 환경에서는 app.mail.mode 를 바꾸고 발송 구현체를 등록해야 한다.");
    }

    @Override
    public void send(MailMessage message) {
        log.info(
                """

                ───────────── 메일 (실제로 발송되지 않음) ─────────────
                To      : {}
                Subject : {}
                {}
                ──────────────────────────────────────────────────""",
                message.to(),
                message.subject(),
                message.body());
    }
}
