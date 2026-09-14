package com.axcore.workspace.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 관리번호 · 발주서 양식 규칙. {@code FE/data/inventory.ts} 의 {@code DocRules} 와 같다. DB 에는 이 모양 그대로
 * {@code inv_settings.doc_rules} (jsonb) 에 들어간다.
 *
 * @param codeSegments 관리번호를 이루는 조각의 순서
 */
public record DocRulesDto(
        @NotNull List<@Size(max = 20) String> codeSegments,
        @NotNull @Valid Separators separators,
        @NotNull @Valid Formats formats,
        @NotNull List<@Size(max = 20) String> processTags) {

    public record Separators(@Size(max = 5) String beforeTeam, @Size(max = 5) String beforeOp) {}

    /** 발주서 표의 머리글. 소재와 부품이 서로 다르다. */
    public record Formats(@NotNull List<@Size(max = 20) String> material, @NotNull List<@Size(max = 20) String> parts) {}

    /** 규칙을 아직 저장하지 않은 회사가 받는 값. 화면 기본값({@code data/inventory-demo.ts})과 같다. */
    public static DocRulesDto defaults() {
        return new DocRulesDto(
                List.of("year", "model", "team", "seq"),
                new Separators("-", " "),
                new Formats(List.of("품명", "규격", "수량", "비고"), List.of("품명", "호칭", "규격", "수량", "비고")),
                List.of("열처리", "연마", "도금", "방전"));
    }
}
