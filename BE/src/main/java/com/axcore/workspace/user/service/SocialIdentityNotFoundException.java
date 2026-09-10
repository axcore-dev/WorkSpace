package com.axcore.workspace.user.service;

/**
 * 이 계정에 그 제공자 연동이 없다. 모르는 제공자 이름도 같다 — 어느 쪽이든 "해제할 것이 없다".
 *
 * <p>404 로 답한다. 자기 계정의 연동 목록이라 감출 정보가 없다.
 */
public class SocialIdentityNotFoundException extends RuntimeException {

    public SocialIdentityNotFoundException() {
        super("연결된 소셜 계정이 아닙니다");
    }
}
