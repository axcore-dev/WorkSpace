package com.axcore.workspace.user.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 로그인 요청.
 *
 * <p>가입과 달리 형식 검증을 최소로 둔다. 여기서 @Email 이나 비밀번호 패턴을 걸면
 * "형식이 틀렸다"와 "비밀번호가 틀렸다"가 응답으로 구분돼, 공격자가 저장된 계정의
 * 비밀번호 규칙을 추측할 단서를 준다.
 */
public record LoginRequest(
        @NotBlank(message = "이메일은 필수입니다") String email,
        @NotBlank(message = "비밀번호는 필수입니다") String password) {
}
