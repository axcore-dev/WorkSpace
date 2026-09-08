package com.axcore.workspace.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 내 프로필 수정. 지금 바꿀 수 있는 것은 이름뿐이다.
 *
 * <p>이메일은 여기서 바꾸지 않는다 — 로그인 아이디라서 소유 확인을 다시 받아야 하고, 그건 가입 때와 같은
 * 메일 왕복이 필요하다. 프로필 사진도 여기가 아니다 — 파일 업로드는 저장소가 먼저 정해져야 한다.
 * 부서·직책은 회사가 정하는 값이라 계정이 아니라 회사 설정에 있다(소유자만 바꾼다).
 */
public record ProfileUpdateRequest(@NotBlank @Size(max = 100) String name) {}
