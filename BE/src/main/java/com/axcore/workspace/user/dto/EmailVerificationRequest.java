package com.axcore.workspace.user.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 이메일 확인 링크의 토큰.
 *
 * <p>쿼리 파라미터가 아니라 본문으로 받는다. URL 에 실으면 브라우저 히스토리 · 프록시 로그 ·
 * Referer 헤더에 토큰이 남는다. 화면이 링크에서 토큰을 꺼내 POST 로 보내는 구조다.
 */
public record EmailVerificationRequest(@NotBlank(message = "토큰은 필수입니다") String token) {
}
