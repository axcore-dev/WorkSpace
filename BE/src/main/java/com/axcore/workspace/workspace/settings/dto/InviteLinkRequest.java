package com.axcore.workspace.workspace.settings.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 초대 링크 만들기. 「무제한」 「만료 없음」 은 없다 — 한 번 새어 나가면 회수할 방법이 지우는 것뿐이라, 한도와 만료가
 * 유일한 안전장치다(화면 {@code link-create-modal.tsx} 와 같은 범위).
 */
public record InviteLinkRequest(
        @NotNull(message = "직급을 골라 주세요") Long roleId,
        Long departmentId,
        @Min(value = 1, message = "사용 한도는 1명 이상입니다") @Max(value = 50, message = "사용 한도는 50명까지입니다") int maxUses,
        @Min(value = 1, message = "만료는 1일 이상입니다") @Max(value = 30, message = "만료는 30일까지입니다") int expiresInDays) {}
