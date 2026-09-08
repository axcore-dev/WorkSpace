package com.axcore.workspace.workspace.settings.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 이메일 초대 — 한 번에 여러 명, 같은 직급·부서로. 화면의 「직접 입력」 탭이 이 모양이다.
 * 파일(CSV) 초대는 줄마다 직급·부서가 달라 화면이 그룹별로 나눠 여러 번 부른다.
 *
 * @param emails 최대 100명. 형식이 틀린 주소 · 이미 구성원 · 이미 초대 중은 서버가 건너뛰고 결과에 이유를 적는다
 */
public record MemberInviteRequest(
        @NotEmpty(message = "초대할 주소가 없습니다") @Size(max = 100, message = "한 번에 100명까지 보낼 수 있습니다")
                List<@NotBlank String> emails,
        @NotNull(message = "직급을 골라 주세요") Long roleId,
        Long departmentId) {}
