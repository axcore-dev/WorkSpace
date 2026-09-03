package com.axcore.workspace.notification;

/**
 * 메일 발송 경계.
 *
 * <p>인터페이스를 두는 이유는 지금 실제 발송 수단이 없기 때문이다. SMTP 계정도, 발송 대행
 * 서비스도 정해지지 않았다. 그렇다고 이메일 확인·비밀번호 재설정을 미루면 그동안 계정 관리
 * 전체가 멈춘다.
 *
 * <p>그래서 도메인 로직은 이 인터페이스에만 의존하게 두고, 실제 전송은 구현체 교체로 붙인다.
 * 로컬에서는 {@link LoggingMailSender} 가 콘솔에 찍고({@code app.mail.mode=log}), 운영에서는
 * {@link SmtpMailSender} 가 SMTP 로 보낸다({@code app.mail.mode=smtp}). 도메인 코드는 그대로다.
 *
 * <p>구현체는 <b>실패를 예외로 던져도 된다.</b> 호출부가 트랜잭션 경계를 어떻게 잡을지 정한다.
 */
public interface MailSender {

    void send(MailMessage message);
}
