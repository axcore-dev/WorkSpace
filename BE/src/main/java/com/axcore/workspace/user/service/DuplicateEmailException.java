package com.axcore.workspace.user.service;

/**
 * 이미 가입된 이메일.
 *
 * <p>가입에서는 이걸 그대로 알려 준다. 로그인·비밀번호 찾기(명세 2.1.4)와 달리, 가입 화면은
 * "이 주소는 이미 쓰이고 있다"를 말해 주지 않으면 사용자가 다음 행동을 정할 수 없다. 어차피
 * 가입을 시도해 보는 것만으로 확인 가능한 정보라 숨겨서 얻는 것도 없다.
 */
public class DuplicateEmailException extends RuntimeException {

    public DuplicateEmailException() {
        super("이미 가입된 이메일입니다");
    }
}
