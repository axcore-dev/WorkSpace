package com.axcore.workspace.workspace.settings.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 외부 서비스 하나를 연결하거나 해제한다.
 *
 * @param connected true = 연결, false = 해제. 해제해도 행은 남는다(누가 언제 껐는지)
 */
public record ConnectorUpdateRequest(@NotNull Boolean connected) {}
