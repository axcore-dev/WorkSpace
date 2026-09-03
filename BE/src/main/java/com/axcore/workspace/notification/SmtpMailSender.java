package com.axcore.workspace.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/**
 * SMTP 실발송기. {@code app.mail.mode=smtp} 일 때만 등록된다.
 *
 * <p>전송은 Spring 의 {@link JavaMailSender} 에 맡긴다. 접속 정보는 {@code spring.mail.*}
 * (환경변수 {@code MAIL_HOST} {@code MAIL_PORT} {@code MAIL_USERNAME} {@code MAIL_PASSWORD})
 * 에서 온다. 첫 대상은 Google Workspace(smtp.gmail.com:587, STARTTLS, 앱 비밀번호)지만
 * 코드에 제공자 이름은 없다. 다른 SMTP 로 옮길 때는 환경변수만 바꾼다.
 *
 * <p><b>부팅 시점 검사.</b> 호스트나 계정이 비어 있으면 여기서 막는다. {@code mode=smtp} 를
 * 켰는데 접속 정보가 없다는 것은 설정 실수이고, 그 상태로 떠 있으면 가입 메일이 조용히 안
 * 나간다 — {@link LoggingMailSender} 가 부팅을 막는 것과 같은 이유다. 반면 실제 접속 시험은
 * 실패해도 부팅을 막지 않고 ERROR 로만 남긴다. 메일 서버의 일시 장애가 API 전체를 내려
 * 버리면 안 되기 때문이다.
 *
 * <p>보내는 주소는 {@link MailProperties#from()} 이다. Gmail 은 인증한 계정(또는 그 계정에
 * 등록된 별칭)이 아닌 From 을 인증 계정 주소로 바꿔 버리므로, {@code MAIL_FROM} 은
 * {@code MAIL_USERNAME} 과 같거나 Gmail 「다른 주소에서 메일 보내기」에 등록된 주소여야 한다.
 */
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "smtp")
public class SmtpMailSender implements MailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpMailSender.class);

    private final JavaMailSender javaMailSender;
    private final MailProperties properties;

    public SmtpMailSender(JavaMailSender javaMailSender, MailProperties properties) {
        this.javaMailSender = javaMailSender;
        this.properties = properties;
    }

    @PostConstruct
    void verifyConfiguration() {
        if (!(javaMailSender instanceof JavaMailSenderImpl impl)) {
            // 테스트가 다른 구현을 끼워 넣은 경우. 검사할 대상이 없으니 그대로 둔다.
            return;
        }
        if (isBlank(impl.getHost())) {
            throw new IllegalStateException(
                    "app.mail.mode=smtp 인데 spring.mail.host(MAIL_HOST) 가 비어 있다. "
                            + "MAIL_HOST · MAIL_PORT · MAIL_USERNAME · MAIL_PASSWORD 를 설정하거나 "
                            + "MAIL_MODE 를 log 로 되돌려라.");
        }
        if (isBlank(impl.getUsername()) || isBlank(impl.getPassword())) {
            throw new IllegalStateException(
                    "app.mail.mode=smtp 인데 spring.mail.username/password(MAIL_USERNAME/MAIL_PASSWORD) 가 "
                            + "비어 있다. Google Workspace 는 계정 주소와 앱 비밀번호(16자)를 넣는다.");
        }
        if (isBlank(properties.from())) {
            throw new IllegalStateException("app.mail.from(MAIL_FROM) 이 비어 있다.");
        }

        try {
            impl.testConnection();
            log.info("SMTP 접속 확인: {}:{} ({})", impl.getHost(), impl.getPort(), impl.getUsername());
        } catch (Exception e) {
            // 부팅은 막지 않는다. 실제 발송 시점에 다시 시도하고, 그때 실패하면 호출부가 예외를 받는다.
            log.error(
                    "SMTP 접속 시험 실패: {}:{} — 접속 정보·방화벽(587 아웃바운드)·앱 비밀번호를 확인하라. 원인: {}",
                    impl.getHost(), impl.getPort(), e.getMessage());
        }
    }

    @Override
    public void send(MailMessage message) {
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(properties.from());
        mail.setTo(message.to());
        mail.setSubject(message.subject());
        mail.setText(message.body());
        javaMailSender.send(mail);
        // 본문은 남기지 않는다. 확인 링크·인증 코드가 들어 있다.
        log.info("메일 발송: to={} subject={}", message.to(), message.subject());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
