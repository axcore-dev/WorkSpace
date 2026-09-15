package com.axcore.workspace.workspace.admin.dto;

import com.axcore.workspace.external.ExternalConcept;
import java.util.List;
import java.util.Map;

/** 운영 콘솔의 개념 한 줄 — 실행용 정의(SQL · 허용 컬럼 · 정렬)까지 전부. 운영자만 본다. */
public record ExternalConceptAdminResponse(
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
        List<ExternalConcept.Relation> relations,
        String formula,
        String sql,
        List<String> filterColumns,
        String orderBy,
        int sortOrder) {

    public static ExternalConceptAdminResponse of(ExternalConcept c) {
        return new ExternalConceptAdminResponse(c.id(), c.systemId(), c.systemName(), c.systemKind(), c.conceptId(), c.name(), c.synonyms(),
                c.tab(), c.description(), c.attrs(), c.relations(), c.formula(), c.sql(), c.filterColumns(), c.orderBy(), c.sortOrder());
    }
}
