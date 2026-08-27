package com.axcore.workspace.common;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * 오류 응답의 단일 형태.
 *
 * @param code   FE 가 분기할 기계용 값. 문구는 바뀌어도 이건 유지한다.
 * @param message 사람이 읽는 문구. 화면에 그대로 띄울 수 있는 수준으로 쓴다.
 * @param fields 입력 검증 실패에서만 채운다. 필드명 → 사유.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String code, String message, Map<String, String> fields) {

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, null);
    }
}
