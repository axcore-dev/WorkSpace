package com.axcore.workspace.notification;

/**
 * 보낼 메일 한 통.
 *
 * @param to      받는 주소. 한 통에 한 명만 보낸다. 여러 명을 담으면 서로의 주소가 노출된다.
 * @param subject 제목
 * @param body    본문. 지금은 평문이다. HTML 이 필요해지면 필드를 늘리기보다 별도 타입을 둔다.
 */
public record MailMessage(String to, String subject, String body) {
}
