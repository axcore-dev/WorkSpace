package com.axcore.workspace.workspace.settings.dto;

import jakarta.validation.constraints.NotNull;

/** 구성원 소속 변경 — 부서와 직급을 함께 저장한다(화면의 「저장」 한 번). {@code departmentId} 는 없음(null) 가능. */
public record MemberUpdateRequest(@NotNull(message = "직급을 골라 주세요") Long roleId, Long departmentId) {}
