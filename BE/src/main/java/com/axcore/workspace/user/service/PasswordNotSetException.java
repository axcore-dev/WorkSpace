package com.axcore.workspace.user.service;

/**
 * 비밀번호가 없는 계정에서 현재 비밀번호를 요구하는 조작을 시도했다.
 *
 * <p>소셜 로그인으로만 가입한 계정이다. 비밀번호 변경과 2단계 끄기가 현재 비밀번호를 자격증명으로
 * 쓰는데, 확인할 비밀번호 자체가 없다.
 *
 * <p>401 이 아니라 409 로 답한다. 비밀번호가 틀린 것이 아니라 계정 상태가 이 조작과 맞지 않는
 * 것이고, 401 로 내보내면 화면이 "비밀번호를 다시 입력하세요"를 반복하게 만든다. 문구로 나갈
 * 길을 알려 주는 편이 낫다 — 재설정 링크로 비밀번호를 처음 설정할 수 있다.
 */
public class PasswordNotSetException extends RuntimeException {

    public PasswordNotSetException() {
        super("비밀번호가 설정되지 않은 계정입니다. 비밀번호 찾기로 먼저 설정해 주세요");
    }
}
