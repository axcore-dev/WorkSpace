package com.axcore.workspace.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /vendors} — 품목 수정 팝업의 「만들기」. 이름 하나만 받는다.
 *
 * <p>나머지는 기본값이다: 종류 {@code parts} · 리드타임 없음(기한 넘김을 판단하지 않는다) · 이니셜 빈 값. 거래처
 * 탭에서 마저 채우라는 뜻이라 여기서 더 묻지 않는다.
 */
public record VendorCreateRequest(@NotBlank @Size(max = 100) String name) {}
