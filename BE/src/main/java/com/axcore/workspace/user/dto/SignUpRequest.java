package com.axcore.workspace.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 회원가입 요청.
 *
 * <p>비밀번호 규칙(영문·숫자·특수문자 조합 8~16자)은 화면 기획을 그대로 옮긴 것이고
 * 앱 레벨 검증이다. DB 에는 평문이 어떤 형태로도 남지 않는다.
 */
public record SignUpRequest(
        @NotBlank(message = "이메일은 필수입니다")
        @Email(message = "이메일 형식이 아닙니다")
        @Size(max = 255, message = "이메일은 255자를 넘을 수 없습니다")
        String email,

        @NotBlank(message = "비밀번호는 필수입니다")
        @Pattern(
                regexp = PasswordRequests.PASSWORD_PATTERN,
                message = PasswordRequests.PASSWORD_MESSAGE)
        String password,

        @NotBlank(message = "이름은 필수입니다")
        @Size(max = 100, message = "이름은 100자를 넘을 수 없습니다")
        String name) {
}
