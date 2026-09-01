package com.axcore.workspace.workspace.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 접속 링크의 토큰.
 *
 * <p>쿼리 파라미터가 아니라 본문으로 받는다. URL 에 실으면 브라우저 히스토리 · 프록시 로그 ·
 * Referer 헤더에 토큰이 남는다. 이메일 확인({@code EmailVerificationRequest})과 같은 이유,
 * 같은 모양이다.
 */
public record InvitationTokenRequest(@NotBlank(message = "토큰은 필수입니다") String token) {
}
