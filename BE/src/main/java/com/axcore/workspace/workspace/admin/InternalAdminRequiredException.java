package com.axcore.workspace.workspace.admin;

/**
 * 운영자 전용 API 를 운영자가 아닌 계정이 불렀다.
 *
 * <p>인증은 됐지만 권한이 없는 경우이므로 403 이다. 401 로 답하면 화면이 로그인으로 되돌리고,
 * 다시 로그인해도 같은 결과가 나와 사용자가 갇힌다.
 *
 * <p>문구에 "운영자" 를 드러내지 않는다. 이 API 의 존재와 조건을 고객 계정에 알려 줄 이유가
 * 없다.
 */
public class InternalAdminRequiredException extends RuntimeException {

    public InternalAdminRequiredException() {
        super("권한이 없습니다");
    }
}
