package com.axcore.workspace.workspace.settings.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 부서 만들기 · 이름 바꾸기. */
public record DepartmentRequest(
        @NotBlank(message = "부서 이름은 필수입니다") @Size(max = 100, message = "부서 이름은 100자 이내입니다") String name) {}
