package com.axcore.workspace.workspace.provisioning;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * AI 서버 전용 DB 역할({@code axcore_ai}, shared V16)의 비밀번호를 부팅 때 맞춘다.
 *
 * <p>역할은 마이그레이션이 만들지만 비밀번호는 저장소에 둘 수 없다. 그래서 환경 변수 {@code AI_DB_PASSWORD}
 * ({@code app.ai.db-password})를 받아 {@code shared.set_ai_role_password(?)} 로 넘긴다. 값은 함수 안에서
 * {@code format('%L')} 로 인용되므로 여기서 SQL 을 잇지 않는다.
 *
 * <p>비어 있으면 아무것도 하지 않는다 — 그 경우 AI 서버는 로그인할 수 없고, 로그에 이유가 남는다.
 * 매 부팅마다 다시 설정하는 이유는 값을 바꾸면 재배포 한 번으로 회전이 끝나게 하려는 것이다. 값 자체는 어떤 로그에도 남기지 않는다.
 */
@Component
public class AiDbRoleOnBoot {

    private static final Logger log = LoggerFactory.getLogger(AiDbRoleOnBoot.class);

    private final JdbcTemplate jdbc;
    private final String password;

    public AiDbRoleOnBoot(JdbcTemplate jdbc, @Value("${app.ai.db-password:}") String password) {
        this.jdbc = jdbc;
        this.password = password;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        if (password == null || password.isBlank()) {
            log.warn("AI_DB_PASSWORD 가 비어 있어 AI 서버 DB 역할(axcore_ai) 비밀번호를 설정하지 않았다. AI 서버가 DB 에 붙지 못한다");
            return;
        }
        try {
            jdbc.queryForObject("SELECT shared.set_ai_role_password(?)", Object.class, password);
            log.info("AI 서버 DB 역할(axcore_ai) 비밀번호를 설정했다");
        } catch (RuntimeException e) {
            // 부팅은 막지 않는다. AI 서버만 DB 에 못 붙고, 원인은 여기 남는다
            log.error("AI 서버 DB 역할 비밀번호 설정 실패", e);
        }
    }
}
