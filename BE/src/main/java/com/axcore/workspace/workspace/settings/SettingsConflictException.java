package com.axcore.workspace.workspace.settings;

/**
 * 지금 상태에서는 할 수 없는 설정 변경. 409.
 *
 * <p>모양이 틀린 것(400)도, 자격이 없는 것(403)도 아니다 — "직급이 남아 있는 부서" · "구성원이 있는 직급" ·
 * "이미 있는 이름" 처럼 <b>다른 데이터가 먼저 바뀌어야</b> 되는 요청이다. 코드로 어느 경우인지 알려 화면이
 * 다음 할 일(옮기고 지우기 · 다른 이름)을 안내할 수 있게 한다.
 */
public class SettingsConflictException extends RuntimeException {

    private final String code;

    public SettingsConflictException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
