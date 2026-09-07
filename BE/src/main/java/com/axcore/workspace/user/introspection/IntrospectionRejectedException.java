package com.axcore.workspace.user.introspection;

import org.springframework.http.HttpStatus;

/**
 * introspect 가 판정을 내리지 못한 경우. 상태 코드와 응답 코드를 함께 들고 있어 핸들러가 그대로 옮긴다.
 *
 * <p>인증 실패(401)와 소속 거부(403 {@code WORKSPACE_ACCESS_DENIED})는 기존 예외가 맡고, 여기는 그
 * 둘로 표현되지 않는 상황만 다룬다 — 서비스 비밀 불일치 · 회사 미선택 · 스키마 미생성 · 설정 누락.
 */
public class IntrospectionRejectedException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public IntrospectionRejectedException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}
