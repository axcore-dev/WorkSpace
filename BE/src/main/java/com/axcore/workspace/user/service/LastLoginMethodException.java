package com.axcore.workspace.user.service;

/**
 * 마지막 남은 로그인 수단을 지우려 했다.
 *
 * <p>소셜로만 가입한 계정(비밀번호 없음)이 유일한 소셜 연동을 해제하면 다시 로그인할 길이 없어진다.
 * 해제는 비밀번호가 있거나 다른 소셜 연동이 하나 이상 남을 때만 된다.
 *
 * <p>409 로 답한다({@code GlobalExceptionHandler} 의 계정 상태 충돌 묶음). 권한 문제가 아니라 계정 상태가
 * 이 조작과 맞지 않는 것이고, 문구로 나갈 길(비밀번호 설정 · 다른 계정 연결)을 알려 준다.
 */
public class LastLoginMethodException extends RuntimeException {

    public LastLoginMethodException() {
        super("마지막 로그인 수단은 해제할 수 없습니다. 비밀번호를 먼저 설정하거나 다른 소셜 계정을 연결해 주세요");
    }
}
