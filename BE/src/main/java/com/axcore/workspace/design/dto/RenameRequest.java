package com.axcore.workspace.design.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 도면명 수정. 도면번호는 바꾸지 않는다 — 발주 · 파생 도면이 번호로 가리킨다. */
public record RenameRequest(@NotBlank @Size(max = 100) String name) {}
