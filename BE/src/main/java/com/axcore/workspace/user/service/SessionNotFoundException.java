package com.axcore.workspace.user.service;

/**
 * 지목한 세션이 없거나 내 것이 아닌 경우.
 *
 * <p>두 상황을 나누지 않는다. 나눠 주면 세션 id 의 존재 여부가 응답으로 새고, 나눠서 얻는
 * 것은 없다.
 */
public class SessionNotFoundException extends RuntimeException {

    public SessionNotFoundException() {
        super("세션을 찾을 수 없습니다");
    }
}
