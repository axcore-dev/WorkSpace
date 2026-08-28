package com.axcore.workspace.user.service;

/**
 * 새 비밀번호가 지금 것과 같은 경우.
 *
 * <p>막는 이유는 사용자가 "바꿨다"고 믿게 두지 않기 위해서다. 유출이 의심돼 바꾸는 상황에서
 * 같은 값으로 통과시키면 아무것도 달라지지 않았는데 안심하게 된다.
 */
public class SamePasswordException extends RuntimeException {

    public SamePasswordException() {
        super("새 비밀번호가 현재 비밀번호와 같습니다");
    }
}
