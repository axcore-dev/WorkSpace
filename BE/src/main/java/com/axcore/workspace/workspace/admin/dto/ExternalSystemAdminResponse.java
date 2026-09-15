package com.axcore.workspace.workspace.admin.dto;

import java.time.Instant;

/**
 * 운영 콘솔의 외부 시스템 한 줄. 비밀번호는 <b>절대 실리지 않는다</b> — 있는지({@code hasPassword})만 알린다.
 *
 * @param status   저장된 값(ok · delayed · down). 실제 접속 여부는 「연결 테스트」로 본다
 * @param host     비어 있으면 표시만 하는 시스템
 */
public record ExternalSystemAdminResponse(
        long id,
        String name,
        String vendor,
        String kind,
        String status,
        String host,
        int port,
        String dbName,
        String dbUser,
        boolean hasPassword,
        String sslmode,
        Instant updatedAt) {}
