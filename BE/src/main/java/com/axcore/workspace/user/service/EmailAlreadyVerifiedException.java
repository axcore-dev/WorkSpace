package com.axcore.workspace.user.service;

/** 이미 확인된 주소에 확인 메일 재발송을 요청한 경우. */
public class EmailAlreadyVerifiedException extends RuntimeException {

    public EmailAlreadyVerifiedException() {
        super("이미 확인된 이메일입니다");
    }
}
