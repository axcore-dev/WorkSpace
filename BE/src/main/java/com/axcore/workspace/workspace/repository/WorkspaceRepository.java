package com.axcore.workspace.workspace.repository;

import com.axcore.workspace.workspace.entity.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 회사 조회.
 *
 * <p>지금은 읽기만 한다. 회사를 만드는 경로는 테넌트 스키마 생성·마이그레이션 순회와 함께
 * 붙어야 하고, 그건 아직 없다.
 */
public interface WorkspaceRepository extends JpaRepository<Workspace, Long> {
}
