package com.axcore.workspace.design.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 등록 · 리비전 본문의 BOM 한 줄 — 정제 엑셀에서 추출한 표기 그대로.
 *
 * @param itemCode 화면이 이미 매핑을 알고 있으면 보낸다(리비전 때 앞 리비전의 매핑을 이어 간다). 비면 서버가
 *                 품목 마스터에서 호칭+규격 → 품명 순으로 찾아 자동 매핑한다
 */
public record BomLineRequest(
        @NotBlank @Size(max = 100) String item,
        @Size(max = 100) String spec,
        @Size(max = 100) String size,
        @Min(1) int qty,
        @Size(max = 50) String itemCode) {}
