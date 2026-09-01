package com.axcore.workspace.workspace.admin.exception;

/** 그런 워크스페이스가 없다. 404 다. */
public class WorkspaceNotFoundException extends RuntimeException {

    public WorkspaceNotFoundException(Long id) {
        super("워크스페이스를 찾을 수 없습니다: " + id);
    }
}
