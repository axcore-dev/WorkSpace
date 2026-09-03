package com.axcore.workspace.workspace.admin.repository;

import com.axcore.workspace.workspace.admin.entity.AdminAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {

    /**
     * 감사 목록. 워크스페이스로 좁힐 수 있다.
     *
     * <p>정렬은 호출하는 쪽의 {@code Pageable} 이 정한다. 화면 기본은 시각 내림차순이고,
     * 같은 시각이 여럿일 때를 대비해 id 를 두 번째 키로 함께 준다 — 없으면 페이지 경계에서
     * 같은 행이 두 번 나오거나 빠진다.
     */
    @Query(
            """
            select l from AdminAuditLog l
             where (:workspaceId is null or l.workspace.id = :workspaceId)
            """)
    Page<AdminAuditLog> search(@Param("workspaceId") Long workspaceId, Pageable pageable);
}
