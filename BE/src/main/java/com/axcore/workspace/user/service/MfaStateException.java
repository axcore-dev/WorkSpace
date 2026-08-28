package com.axcore.workspace.user.service;

/**
 * 2단계 인증 수단의 상태가 요청과 맞지 않는 경우. (이미 켜져 있음 · 켜져 있지 않음 등)
 *
 * <p>인증 실패와 구분한다. 이쪽은 자기 계정 설정을 보고 있는 사용자에게 무엇이 어긋났는지
 * 알려 줘야 하는 상황이라, 감출 정보가 없다.
 */
public class MfaStateException extends RuntimeException {

    public MfaStateException(String message) {
        super(message);
    }
}
