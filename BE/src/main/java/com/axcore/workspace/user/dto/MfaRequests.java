package com.axcore.workspace.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 2단계 인증 요청 본문들.
 *
 * <p>코드에 {@code @Pattern} 을 거는 것은 형식 검증일 뿐 방어가 아니다. 자릿수가 다른 입력을
 * BCrypt 대조까지 보내지 않으려는 것이고, 실제 방어는 시도 횟수 제한이 한다.
 */
public final class MfaRequests {

    private static final String CODE_PATTERN = "^[0-9]{6}$";

    private static final String CODE_MESSAGE = "인증 코드는 숫자 6자리입니다";

    private MfaRequests() {
    }

    /** 로그인 2단계 통과. {@code mfaToken} 은 로그인 응답으로 받은 값이다. */
    public record VerifyRequest(
            @NotBlank(message = "인증 토큰은 필수입니다") String mfaToken,
            @NotBlank(message = "인증 코드는 필수입니다")
            @Pattern(regexp = CODE_PATTERN, message = CODE_MESSAGE)
            String code) {
    }

    /** 2단계 등록 확인. 로그인 상태에서 부른다. */
    public record ConfirmRequest(
            @NotBlank(message = "인증 토큰은 필수입니다") String mfaToken,
            @NotBlank(message = "인증 코드는 필수입니다")
            @Pattern(regexp = CODE_PATTERN, message = CODE_MESSAGE)
            String code) {
    }

    /**
     * 2단계 끄기. 비밀번호를 다시 묻는다.
     *
     * <p>access 토큰만 탈취한 쪽이 2단계를 꺼 버리는 것을 막는다. 방어를 걷어내는 조작은
     * 비밀번호 변경과 같은 수준으로 취급한다.
     */
    public record DisableRequest(@NotBlank(message = "비밀번호는 필수입니다") String password) {
    }
}
