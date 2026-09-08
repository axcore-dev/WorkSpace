package com.axcore.workspace.workspace.settings.dto;

import java.time.Instant;

/**
 * 초대 링크를 연 사람에게 보여 줄 것. 로그인 전에도 부른다.
 *
 * <p>회사 이름과 받게 될 직급·부서까지만이다. 링크만 가진 사람에게 그 이상을 보여 줄 이유가 없다.
 * 이메일 고정이 없다 — 이 링크는 주소에 묶이지 않는다.
 */
public record InviteLinkPreviewResponse(
        Long workspaceId, String workspaceName, String roleName, String departmentName, Instant expiresAt) {}
