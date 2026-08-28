package com.axcore.workspace.user.dto;

/**
 * 2단계 챌린지 응답.
 *
 * <p>이 토큰만으로는 아무것도 할 수 없다. 메일로 받은 코드와 함께 제출해야 통과한다.
 * 코드는 여기에 담기지 않는다 — 담으면 2단계가 아니라 한 단계가 된다.
 */
public record MfaChallengeResponse(String mfaToken) {
}
