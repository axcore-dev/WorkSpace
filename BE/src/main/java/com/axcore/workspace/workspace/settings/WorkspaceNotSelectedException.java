package com.axcore.workspace.workspace.settings;

/**
 * 설정 API 를 불렀는데 아직 회사가 정해지지 않았다. 409.
 *
 * <p>두 경우다. access 토큰에 {@code wsid} 가 없다(회사 선택 전) — {@code WORKSPACE_REQUIRED}.
 * 회사는 골랐지만 스키마가 아직 없다(프로비저닝 중) — {@code WORKSPACE_NOT_READY}. introspect 가 AI 서버에
 * 돌려주는 코드와 같다 — 화면이 두 API 의 응답을 한 가지로 다루게 하려는 것이다.
 */
public class WorkspaceNotSelectedException extends RuntimeException {

    private final String code;

    private WorkspaceNotSelectedException(String code, String message) {
        super(message);
        this.code = code;
    }

    public static WorkspaceNotSelectedException required() {
        return new WorkspaceNotSelectedException("WORKSPACE_REQUIRED", "회사를 먼저 선택해 주세요");
    }

    public static WorkspaceNotSelectedException notReady() {
        return new WorkspaceNotSelectedException("WORKSPACE_NOT_READY", "회사 공간이 아직 준비되지 않았어요");
    }

    public String code() {
        return code;
    }
}
