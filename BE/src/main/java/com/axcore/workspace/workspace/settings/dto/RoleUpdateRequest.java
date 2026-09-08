package com.axcore.workspace.workspace.settings.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 직급 전체 저장 — 화면의 「저장하기」 한 번이 이 요청 하나다.
 *
 * <p>부분 수정(PATCH)이 아니라 전체 교체다. 화면이 이름·부서·권한·범위를 한 폼으로 들고 있다가 한 번에 저장하므로,
 * 서버도 그 스냅샷을 통째로 받아 검증한다(관리자의 "자기 권한 안" 검사는 결과 전체를 봐야 한다).
 *
 * @param departmentId 고정 직급(owner · member)에서는 무시된다. 그 외에는 필수
 * @param tabs 볼 수 있는 기능 탭 id 전부. 빈 목록이면 기능 탭이 하나도 없는 직급이다
 */
public record RoleUpdateRequest(
        @NotBlank(message = "직급 이름은 필수입니다") @Size(max = 100, message = "직급 이름은 100자 이내입니다") String name,
        Long departmentId,
        boolean admin,
        boolean canInvite,
        boolean canManageIntegrations,
        @NotNull @Pattern(regexp = "all|dept|own", message = "데이터 범위는 all · dept · own 중 하나입니다") String dataScope,
        boolean showAmounts,
        @NotNull List<@NotBlank String> tabs) {}
