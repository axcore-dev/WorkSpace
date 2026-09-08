package com.axcore.workspace.workspace.settings;

/** 이 회사 스키마에 그런 부서·직급이 없다. 404. 다른 회사의 id 를 넘겨도 스키마가 달라 여기로 온다. */
public class SettingsNotFoundException extends RuntimeException {

    public SettingsNotFoundException(String message) {
        super(message);
    }
}
