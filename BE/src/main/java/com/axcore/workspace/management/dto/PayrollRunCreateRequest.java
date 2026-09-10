package com.axcore.workspace.management.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** 새 회차. 항목은 가장 최근 정기급여 회차를 그대로 복사한다(화면 "회차 만들기" 와 같은 규칙). */
public record PayrollRunCreateRequest(@NotBlank @Size(max = 100) String name, @NotNull LocalDate payDate) {}
