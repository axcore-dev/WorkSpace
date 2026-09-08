package com.axcore.workspace.workspace.settings.dto;

/** 구성원 한 줄 — 초대 관리 › 구성원 탭. 소유자는 {@code roleCode = owner} 로 구분한다(소속 변경 불가). */
public record MemberResponse(
        Long id,
        String name,
        String email,
        Long roleId,
        String roleCode,
        String roleName,
        Long departmentId,
        String departmentName) {}
