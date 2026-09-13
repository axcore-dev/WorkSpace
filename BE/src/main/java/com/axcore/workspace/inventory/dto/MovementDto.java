package com.axcore.workspace.inventory.dto;

/**
 * 입출고 이력 한 줄. {@code FE/data/inventory.ts} 의 {@code Movement} 와 같다.
 *
 * @param at ISO 분 단위 문자열({@code 2026-06-30T14:20}). 타임존을 붙이지 않는다 — 화면이 그대로 표시한다
 * @param qty 부호 있는 증감. {@code baseline} 은 새 기초 재고 값이라 합산하지 않는다
 */
public record MovementDto(
        String id,
        String at,
        String itemCode,
        String kind,
        int qty,
        String actor,
        String ref,
        String note,
        String poNo,
        String judgement) {}
