package com.axcore.workspace.workspace.admin.dto;

import com.axcore.workspace.external.ExternalConcept;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

/**
 * 개념 등록 · 수정 본문 (운영 콘솔). 전체 교체(PUT). 모양은 {@link ExternalConcept} 행과 같다.
 *
 * @param conceptId     회사 안에서 유일. 영문 소문자 · 숫자 · 밑줄, 50자
 * @param tab           권한 탭(모듈 탭 id). 서버가 카탈로그에 있는 탭인지 본다
 * @param attrs         출력 컬럼 → 라벨. 비면 안 된다 — 모델이 속성을 모르면 filter 를 못 쓴다
 * @param filterColumns attrs 의 키 중 동등 조건을 걸 컬럼
 */
public record ExternalConceptRequest(
        @NotBlank @Pattern(regexp = "[a-z][a-z0-9_]{1,49}", message = "개념 id 는 영문 소문자로 시작하는 소문자 · 숫자 · 밑줄 2~50자예요") String conceptId,
        @NotBlank(message = "이름은 필수입니다") @Size(max = 100) String name,
        List<@NotBlank @Size(max = 50) String> synonyms,
        @NotBlank(message = "권한 탭은 필수입니다") @Size(max = 30) String tab,
        @NotBlank(message = "설명은 필수입니다") @Size(max = 1000) String description,
        @NotEmpty(message = "속성을 하나 이상 적어 주세요") Map<@Pattern(regexp = "[a-z_][a-z0-9_]*") String, @Size(max = 200) String> attrs,
        List<ExternalConcept.Relation> relations,
        @Size(max = 200) String formula,
        @NotBlank(message = "SQL 은 필수입니다") String sql,
        List<@NotBlank String> filterColumns,
        @NotBlank(message = "정렬은 필수입니다") @Size(max = 200) String orderBy,
        Integer sortOrder) {

    public ExternalConcept toConcept(long id, long systemId) {
        return new ExternalConcept(
                id, systemId, null, null, conceptId.strip(), name.strip(),
                synonyms == null ? List.of() : synonyms.stream().map(String::strip).filter(s -> !s.isEmpty()).toList(),
                tab.strip(), description.strip(), attrs,
                relations == null ? List.of() : relations,
                formula == null || formula.isBlank() ? null : formula.strip(),
                sql.strip(),
                filterColumns == null ? List.of() : filterColumns.stream().map(String::strip).filter(s -> !s.isEmpty()).toList(),
                orderBy.strip(), sortOrder == null ? 0 : sortOrder);
    }
}
