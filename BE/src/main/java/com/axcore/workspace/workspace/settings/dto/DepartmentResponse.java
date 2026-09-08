package com.axcore.workspace.workspace.settings.dto;

/**
 * 부서 한 줄.
 *
 * @param roleCount 이 부서에 속한 직급 수. 0 이어야 지울 수 있다
 */
public record DepartmentResponse(Long id, String name, int roleCount) {}
