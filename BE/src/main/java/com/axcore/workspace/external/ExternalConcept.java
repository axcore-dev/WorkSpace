package com.axcore.workspace.external;

import java.util.List;
import java.util.Map;

/**
 * 외부 시스템 개념 한 행({@code external_system_concepts}). 모델용 설명과 실행용 정의가 한 곳에 있다.
 *
 * @param systemId      어느 외부 시스템의 개념인가({@code external_systems.id}). 풀도 이 id 로 찾는다
 * @param systemName    화면 · 출처 문구에 쓰는 시스템 이름
 * @param systemKind    MES · ERP …
 * @param conceptId     모델이 고르는 값. 회사 안에서 유일
 * @param tab           권한 탭(모듈 탭 id)
 * @param attrs         출력 컬럼 → 라벨. 키가 곧 SELECT 컬럼
 * @param sql           FROM 까지의 SELECT. {@link ExternalQuery} 가 서브쿼리로 감싼다
 * @param filterColumns 동등 조건을 걸 수 있는 출력 컬럼
 * @param orderBy       ORDER BY 절(출력 컬럼 이름)
 */
public record ExternalConcept(
        long id,
        long systemId,
        String systemName,
        String systemKind,
        String conceptId,
        String name,
        List<String> synonyms,
        String tab,
        String description,
        Map<String, String> attrs,
        List<Relation> relations,
        String formula,
        String sql,
        List<String> filterColumns,
        String orderBy,
        int sortOrder) {

    /** 다른 개념을 가리키는 속성. {@code to} 는 개념 id(내장 개념 포함). */
    public record Relation(String attr, String to) {}
}
