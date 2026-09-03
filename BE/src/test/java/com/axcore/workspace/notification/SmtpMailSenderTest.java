package com.axcore.workspace.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/**
 * 네트워크 없이 도는 단위 테스트. 실제 SMTP 는 건드리지 않는다.
 *
 * <p>{@link JavaMailSenderImpl} 을 상속해 전송 메서드만 가로챈다. 모킹 라이브러리 없이도
 * 매핑(From/To/Subject/Body)과 부팅 검사 두 가지를 확인할 수 있다.
 */
class SmtpMailSenderTest {

    private static final MailProperties PROPS =
            new MailProperties("smtp", "http://localhost:8000", "no-reply@axcore.ai.kr");

    /** 보내는 대신 받아 두기만 하는 가짜. */
    static class CapturingSender extends JavaMailSenderImpl {
        final List<SimpleMailMessage> sent = new ArrayList<>();

        @Override
        public void send(SimpleMailMessage simpleMessage) {
            sent.add(simpleMessage);
        }
    }

    @Test
    void 메일_한_통을_From_To_Subject_Body_그대로_옮긴다() {
        CapturingSender fake = new CapturingSender();
        SmtpMailSender sender = new SmtpMailSender(fake, PROPS);

        sender.send(new MailMessage("user@example.com", "[AXpoint] 제목", "본문\n둘째 줄"));

        assertEquals(1, fake.sent.size());
        SimpleMailMessage m = fake.sent.get(0);
        assertEquals("no-reply@axcore.ai.kr", m.getFrom());
        assertNotNull(m.getTo());
        assertEquals(1, m.getTo().length);
        assertEquals("user@example.com", m.getTo()[0]);
        assertEquals("[AXpoint] 제목", m.getSubject());
        assertEquals("본문\n둘째 줄", m.getText());
    }

    @Test
    void 호스트가_비어_있으면_부팅_검사에서_막힌다() {
        JavaMailSenderImpl impl = new JavaMailSenderImpl();
        impl.setUsername("ops@axcore.ai.kr");
        impl.setPassword("app-password");
        SmtpMailSender sender = new SmtpMailSender(impl, PROPS);

        IllegalStateException e = assertThrows(IllegalStateException.class, sender::verifyConfiguration);
        assertTrue(e.getMessage().contains("MAIL_HOST"));
    }

    @Test
    void 계정이_비어_있으면_부팅_검사에서_막힌다() {
        JavaMailSenderImpl impl = new JavaMailSenderImpl();
        impl.setHost("smtp.gmail.com");
        SmtpMailSender sender = new SmtpMailSender(impl, PROPS);

        IllegalStateException e = assertThrows(IllegalStateException.class, sender::verifyConfiguration);
        assertTrue(e.getMessage().contains("MAIL_USERNAME"));
    }

    @Test
    void From_이_비어_있으면_부팅_검사에서_막힌다() {
        JavaMailSenderImpl impl = new JavaMailSenderImpl();
        impl.setHost("smtp.gmail.com");
        impl.setUsername("ops@axcore.ai.kr");
        impl.setPassword("app-password");
        MailProperties noFrom = new MailProperties("smtp", "http://localhost:8000", " ");
        SmtpMailSender sender = new SmtpMailSender(impl, noFrom);

        IllegalStateException e = assertThrows(IllegalStateException.class, sender::verifyConfiguration);
        assertTrue(e.getMessage().contains("MAIL_FROM"));
    }
}
