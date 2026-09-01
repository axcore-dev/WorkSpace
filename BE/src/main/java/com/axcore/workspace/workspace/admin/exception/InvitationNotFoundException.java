package com.axcore.workspace.workspace.admin.exception;

import java.util.UUID;

/** 운영자가 없는 초대를 회수하려 했다. */
public class InvitationNotFoundException extends RuntimeException {

    public InvitationNotFoundException(UUID id) {
        super("초대를 찾을 수 없습니다: " + id);
    }
}
