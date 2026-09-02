package com.axcore.workspace.workspace.repository;

import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.entity.WorkspaceStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/**
 * 운영자 목록 화면의 검색 조건.
 *
 * <p>조건이 있을 때만 술어를 붙인다. JPQL 에 {@code (:keyword IS NULL OR ...)} 로 적으면
 * PostgreSQL 이 null 파라미터의 타입을 알 수 없어 {@code bytea} 로 바인딩하고,
 * {@code lower(bytea) does not exist} 로 터진다. 여기서는 조건이 없으면 그 자리 자체가 없다.
 */
public final class WorkspaceSpecifications {

    private WorkspaceSpecifications() {
        // 유틸리티
    }

    /**
     * @param keyword 상호(부분 일치, 대소문자 무시) 또는 사업자번호(앞에서부터 일치). 비어 있으면
     *     조건에서 뺀다
     * @param status 없으면 전체
     */
    public static Specification<Workspace> search(String keyword, WorkspaceStatus status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            } else {
                // 해지된 회사는 기본 목록에서 뺀다. 계약이 끝난 곳이 매일 보는 목록에 계속
                // 쌓이면 살아 있는 회사를 찾기 어려워진다. 보려면 status=terminated 로
                // 명시해야 한다 — 지우는 것이 아니라 접어 두는 것이다.
                predicates.add(
                        cb.notEqual(root.get("status"), WorkspaceStatus.TERMINATED));
            }
            if (keyword != null && !keyword.isBlank()) {
                String trimmed = keyword.strip();
                predicates.add(
                        cb.or(
                                cb.like(
                                        cb.lower(root.get("name")),
                                        "%" + trimmed.toLowerCase() + "%"),
                                // 사업자번호는 앞 와일드카드를 붙이지 않는다. 10자리 숫자라 앞에서
                                // 부터 치는 검색이고, 앞을 열면 인덱스를 쓸 수 없다.
                                cb.like(root.get("bizNumber"), trimmed + "%")));
            }
            return predicates.isEmpty() ? null : cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
