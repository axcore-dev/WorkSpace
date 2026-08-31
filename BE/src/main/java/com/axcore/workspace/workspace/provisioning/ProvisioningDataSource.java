package com.axcore.workspace.workspace.provisioning;

import com.zaxxer.hikari.HikariDataSource;

import javax.sql.DataSource;

/**
 * 테넌트 DDL 전용 커넥션 풀. 요청을 처리하는 풀과 분리한다.
 *
 * <p><b>왜 {@code DataSource} 를 그대로 빈으로 두지 않는가.</b> Spring Boot 의
 * {@code DataSourceAutoConfiguration} 은 {@code @ConditionalOnMissingBean(DataSource.class)} 다.
 * {@code DataSource} 타입 빈을 하나라도 직접 만들면 <b>기본 DataSource 자동 설정이 통째로
 * 꺼진다.</b> 그래서 한 겹 감싸 타입을 감춘다.
 *
 * <h2>분리하는 이유 둘</h2>
 *
 * <p><b>1. 세션 상태가 요청 처리용 커넥션에 남지 않는다.</b> Flyway 는 대상 스키마를 잡으려고
 * 자기가 빌린 커넥션의 {@code search_path} 를 바꾼다. Flyway 가 닫을 때 원래 값을 되돌리기는
 * 하지만, 그건 라이브러리 내부 동작이다. 테넌트 격리를 남의 구현 세부에 기대지 않는다 —
 * 애초에 그 커넥션이 사용자 요청을 처리하지 않으면 되돌리든 말든 상관이 없다.
 *
 * <p><b>2. DDL 이 요청용 커넥션을 잡아먹지 않는다.</b> 스키마 하나를 만드는 데 테이블 DDL 이
 * 전량 도는데, 회사가 늘어 순회 배포가 길어지면 그동안 요청 처리 커넥션이 묶인다.
 *
 * <p>풀이 작다. 프로비저닝은 드물게 일어나고 순회 배포는 잡 하나로 유지하는 것이 맞다 —
 * 동시 실행은 Flyway 가 {@code pg_advisory_lock} 으로 막아 주지만 락 대기로 배포가 길어질 뿐이다.
 */
public final class ProvisioningDataSource implements AutoCloseable {

    private final HikariDataSource delegate;

    public ProvisioningDataSource(HikariDataSource delegate) {
        this.delegate = delegate;
    }

    public DataSource dataSource() {
        return delegate;
    }

    @Override
    public void close() {
        delegate.close();
    }
}
