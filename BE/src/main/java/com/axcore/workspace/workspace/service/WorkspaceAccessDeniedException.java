package com.axcore.workspace.workspace.service;

/**
 * 회사에 들어갈 수 없는 경우. (소속이 없음 · 소속이 회수됨 · 회사가 정지됨 · 이메일 미확인)
 *
 * <p>"소속이 없다"와 "회사가 정지됐다"를 구분해 알려 준다. 자기 소속 정보라 감출 것이 없고,
 * 사용자가 누구에게 문의해야 하는지가 달라진다.
 */
public class WorkspaceAccessDeniedException extends RuntimeException {

    public WorkspaceAccessDeniedException(String message) {
        super(message);
    }
}
