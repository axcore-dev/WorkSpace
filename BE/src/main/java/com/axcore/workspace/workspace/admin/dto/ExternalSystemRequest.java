package com.axcore.workspace.workspace.admin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Optional;

/**
 * 외부 시스템 등록 · 수정 본문 (운영 콘솔). 등록과 수정이 같은 모양이다 — 전체 교체(PUT).
 *
 * <p>접속 정보는 <b>전부 있거나 전부 없거나</b>다. host 만 적고 db_user 를 빼면 풀을 열 수 없으므로 400 으로 막는다.
 * 접속 정보가 없으면 표시만 하는 시스템이다(ERP 이름만 두는 경우).
 *
 * @param kind     external_systems 의 CHECK 와 같다
 * @param password 등록 때는 접속 정보가 있으면 필수. 수정 때 비우면 <b>저장된 값을 유지</b>한다 — 화면이 비밀번호를
 *                 되돌려 받지 못하므로 전체 교체에서 이 필드만 예외다
 * @param sslmode  비면 require
 */
public record ExternalSystemRequest(
        @NotBlank(message = "이름은 필수입니다") @Size(max = 100) String name,
        @NotBlank(message = "제품 이름은 필수입니다") @Size(max = 100) String vendor,
        @NotBlank @Pattern(regexp = "ERP|MES|PLM|QMS|WMS|CRM|센서|기타", message = "유형이 올바르지 않습니다") String kind,
        @Size(max = 255) String host,
        @Min(1) @Max(65535) Integer port,
        @Size(max = 100) String dbName,
        @Size(max = 100) String dbUser,
        String password,
        @Pattern(regexp = "disable|require|verify-ca|verify-full", message = "sslmode 가 올바르지 않습니다") String sslmode) {

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    /** 접속 정보를 적었는가(host · dbName · dbUser 중 하나라도). */
    public boolean linked() {
        return !blank(host) || !blank(dbName) || !blank(dbUser);
    }

    /**
     * 접속 정보의 짝이 맞는지. 맞지 않으면 사람이 읽을 이유를 돌려준다.
     *
     * @param hasStoredPassword 수정 중이고 저장된 비밀번호가 있으면 true — 비밀번호를 비워도 된다
     */
    public Optional<String> connectionProblem(boolean hasStoredPassword) {
        if (!linked()) {
            return Optional.empty();
        }
        if (blank(host) || blank(dbName) || blank(dbUser)) {
            return Optional.of("접속 정보는 호스트 · DB 이름 · 사용자를 모두 적어야 해요");
        }
        if (blank(password) && !hasStoredPassword) {
            return Optional.of("비밀번호를 적어 주세요");
        }
        return Optional.empty();
    }

    public int portOrDefault() {
        return port == null ? 5432 : port;
    }

    public String sslmodeOrDefault() {
        return blank(sslmode) ? "require" : sslmode;
    }
}
