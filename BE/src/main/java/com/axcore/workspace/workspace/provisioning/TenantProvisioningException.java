package com.axcore.workspace.workspace.provisioning;

/**
 * 테넌트 스키마를 만들지 못했다.
 *
 * <p>이 예외가 났을 때 스키마는 <b>남아 있지 않거나 비어 있다.</b> PostgreSQL 은 DDL 이
 * 트랜잭션 안에서 롤백되고 테넌트 마이그레이션을 {@code group(true)} 로 묶어 두었기 때문이다.
 * 다만 {@code shared.workspaces} 행은 별도 트랜잭션이라 {@code provisioning} 상태로 남는다 —
 * 그 상태로 오래 머문 행이 곧 실패한 개설이다.
 */
public class TenantProvisioningException extends RuntimeException {

    public TenantProvisioningException(String schemaName, Throwable cause) {
        super("테넌트 스키마를 만들지 못했습니다: " + schemaName, cause);
    }
}
