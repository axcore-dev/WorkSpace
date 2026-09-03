package com.axcore.workspace.workspace.admin.dto;

import com.axcore.workspace.workspace.admin.entity.AdminAuditLog;

import java.time.Instant;

/**
 * 감사 기록 한 줄.
 *
 * <p>시각은 {@code Instant} 로 그대로 내보낸다. 화면이 쓰는 "YYYY-MM-DD HH:MM" 은 보는 사람의
 * 시간대에 따라 달라지므로 서버가 미리 문자열로 만들면 안 된다.
 *
 * @param actorName 행위 시점의 이름 스냅샷. 지금 그 계정이 없거나 이름이 바뀌었어도 당시 값이다
 * @param detail 없으면 null. 화면이 "—" 로 대신 보여 준다
 */
public record AuditLogResponse(
        Long id,
        Instant occurredAt,
        String actorName,
        String action,
        String targetSchema,
        String targetName,
        String detail) {

    public static AuditLogResponse from(AdminAuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getOccurredAt(),
                log.getActorName(),
                log.getAction().dbValue(),
                log.getTargetSchema(),
                log.getTargetName(),
                log.getDetail());
    }
}
