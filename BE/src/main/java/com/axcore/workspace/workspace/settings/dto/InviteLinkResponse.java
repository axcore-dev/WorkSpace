package com.axcore.workspace.workspace.settings.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 초대 링크 한 줄.
 *
 * @param url    링크 원문. <b>만든 직후의 응답에만 있다.</b> 서버는 해시만 저장하므로 목록에서는 null 이다 — 화면이 그때 복사해 두라고 안내한다
 * @param active 지금 쓸 수 있는가(회수 안 됨 · 만료 전 · 한도 남음)
 */
public record InviteLinkResponse(
        UUID id,
        String url,
        Long roleId,
        String roleName,
        Long departmentId,
        String departmentName,
        int maxUses,
        int useCount,
        Instant expiresAt,
        Instant revokedAt,
        boolean active) {}
