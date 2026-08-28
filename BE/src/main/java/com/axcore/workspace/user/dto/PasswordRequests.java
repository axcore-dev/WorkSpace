package com.axcore.workspace.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 비밀번호 관련 요청 본문들.
 *
 * <p>한 파일에 모으는 이유는 세 record 가 같은 규칙을 공유하기 때문이다. 새 비밀번호 규칙이
 * 바뀌면 세 곳이 같이 바뀌어야 하고, 떨어져 있으면 한 곳을 빠뜨린다. 그 상태에서는 재설정으로만
 * 약한 비밀번호를 넣을 수 있게 된다.
 */
public final class PasswordRequests {

    /**
     * 가입 시 규칙과 같다. ({@link SignUpRequest}) 정규식을 복사하지 않고 상수를 공유한다.
     */
    static final String PASSWORD_PATTERN = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,16}$";

    static final String PASSWORD_MESSAGE = "비밀번호는 영문·숫자·특수문자를 모두 포함한 8~16자여야 합니다";

    private PasswordRequests() {
    }

    /** 로그인 상태에서의 변경. 현재 비밀번호를 다시 묻는다. */
    public record ChangeRequest(
            @NotBlank(message = "현재 비밀번호는 필수입니다") String currentPassword,
            @NotBlank(message = "새 비밀번호는 필수입니다")
            @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE)
            String newPassword) {
    }

    /**
     * 재설정 링크 요청.
     *
     * <p>여기에 {@code @Email} 을 거는 것은 계정 존재 노출과 무관하다. 형식이 틀린 문자열은
     * 어차피 어떤 계정과도 맞지 않으므로, 걸러도 새는 정보가 없다.
     */
    public record ResetRequest(
            @NotBlank(message = "이메일은 필수입니다")
            @Email(message = "이메일 형식이 아닙니다")
            @Size(max = 255, message = "이메일은 255자를 넘을 수 없습니다")
            String email) {
    }

    /** 링크를 열고 새 비밀번호를 설정. 현재 비밀번호를 묻지 않는다 — 잊은 사람이 쓰는 경로다. */
    public record ResetConfirmRequest(
            @NotBlank(message = "토큰은 필수입니다") String token,
            @NotBlank(message = "새 비밀번호는 필수입니다")
            @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE)
            String newPassword) {
    }
}
