package com.axcore.workspace.workspace.settings;

/**
 * 설정 값이 카탈로그·규칙에 맞지 않는다. 400.
 *
 * <p>{@code @Valid} 가 잡는 것은 모양(비어 있음 · 길이)까지다. "이 모듈에 그런 탭이 없다" 처럼 카탈로그를
 * 봐야 아는 것은 서비스가 판정하고 이 예외로 알린다. 응답 코드는 {@code @Valid} 실패와 같은
 * {@code VALIDATION_FAILED} 다 — 화면이 둘을 구분할 이유가 없다.
 */
public class SettingsValidationException extends RuntimeException {

    public SettingsValidationException(String message) {
        super(message);
    }
}
