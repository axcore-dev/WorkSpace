package com.axcore.workspace.workspace.settings.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.Map;

/**
 * 한 모듈의 탭 상태 저장. 보낸 탭만 바뀌고 나머지는 그대로다.
 *
 * <p>모듈 전체를 켜고 끄는 요청도 이 모양이다 — 화면이 그 모듈의 탭 전부를 같은 값으로 보낸다.
 * 별도의 "모듈 ON/OFF" 필드를 두지 않는 이유는 모듈 상태가 탭에서 파생되기 때문이다(V8 주석).
 *
 * @param tabs 탭 id → 켜짐. 카탈로그에 없는 탭이 섞이면 400
 */
public record FeatureUpdateRequest(@NotEmpty Map<String, Boolean> tabs) {}
