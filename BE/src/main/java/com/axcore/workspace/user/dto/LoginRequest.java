package com.axcore.workspace.user.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 로그인 요청.
 *
 * <p>가입과 달리 형식 검증을 최소로 둔다. 여기서 @Email 이나 비밀번호 패턴을 걸면
 * "형식이 틀렸다"와 "비밀번호가 틀렸다"가 응답으로 구분돼, 공격자가 저장된 계정의
 * 비밀번호 규칙을 추측할 단서를 준다.
 *
 * @param rememberMe 화면의 "로그인 유지" 체크값. (명세 2.1.2) 원시 타입 boolean 으로 두면
 *                   JSON 에서 이 필드가 빠졌을 때 역직렬화 자체가 실패한다. 빠뜨린 요청을
 *                   400 으로 되돌려 보낼 이유가 없어서 Boolean 으로 받고 없으면 해제로 본다.
 *                   공용 PC 를 고려해 기본 해제를 요구하는 명세와 같은 방향이다.
 */
public record LoginRequest(
        @NotBlank(message = "이메일은 필수입니다") String email,
        @NotBlank(message = "비밀번호는 필수입니다") String password,
        Boolean rememberMe) {

    public boolean rememberMeOrDefault() {
        return Boolean.TRUE.equals(rememberMe);
    }
}
