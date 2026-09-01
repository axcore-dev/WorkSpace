package com.axcore.workspace.workspace.admin.exception;

/**
 * 지금 상태에서는 할 수 없는 조작이다. (중지된 회사를 또 중지하는 등)
 *
 * <p>409 다. 요청 자체는 올바른데 대상의 상태가 맞지 않는 경우라, 400 으로 답하면 화면이
 * 입력값을 고치라고 안내하게 된다.
 */
public class WorkspaceStateException extends RuntimeException {

    public WorkspaceStateException(String message) {
        super(message);
    }
}
