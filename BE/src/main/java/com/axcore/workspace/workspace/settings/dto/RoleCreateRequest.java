package com.axcore.workspace.workspace.settings.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 직급 만들기. 권한 없이 시작한다 — 새 직급이 뭘 볼 수 있는지는 만든 사람이 이어서 정한다.
 *
 * @param departmentId 필수. 「전사」(부서 없음)에는 직급을 만들 수 없다 — 소유자 하나로 고정이다
 */
public record RoleCreateRequest(
        @NotBlank(message = "직급 이름은 필수입니다") @Size(max = 100, message = "직급 이름은 100자 이내입니다") String name,
        @NotNull(message = "부서를 골라 주세요") Long departmentId) {}
