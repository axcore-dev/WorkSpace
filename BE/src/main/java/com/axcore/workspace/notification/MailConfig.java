package com.axcore.workspace.notification;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 메일 설정 바인딩.
 *
 * <p>{@link MailProperties} 는 발송 방식과 무관하게 필요하다. 링크 주소를 만드는 쪽
 * ({@code AccountMailer})이 쓰기 때문에, {@link LoggingMailSender} 가 등록되지 않는 환경에서도
 * 빈이 있어야 한다. 그래서 구현체가 아니라 여기에 건다.
 */
@Configuration
@EnableConfigurationProperties(MailProperties.class)
public class MailConfig {
}
