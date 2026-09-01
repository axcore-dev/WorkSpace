package com.axcore.workspace.workspace.repository;

import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.entity.WorkspaceStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 회사 조회·개설.
 *
 * <p>목록 검색은 {@link JpaSpecificationExecutor} 로 조립한다. JPQL 에
 * {@code (:keyword IS NULL OR ...)} 를 쓰면 PostgreSQL 이 null 파라미터의 타입을 추론하지 못해
 * {@code bytea} 로 바인딩하고, {@code lower(bytea) does not exist} 로 터진다. 조건이 있을 때만
 * 붙이면 그 자리 자체가 없어진다.
 */
public interface WorkspaceRepository
        extends JpaRepository<Workspace, Long>, JpaSpecificationExecutor<Workspace> {

    /**
     * 중복 개설 확인. {@code exists} 가 아니라 엔티티를 가져오는 이유는, 이미 열려 있을 때
     * 운영자에게 "어느 회사인가" 를 함께 알려 주기 때문이다.
     */
    Optional<Workspace> findByBizNumber(String bizNumber);

    /**
     * 순회 배포 대상.
     *
     * <p>호출부가 {@code active} 와 {@code suspended} 를 넘긴다. {@code provisioning} 은 스키마가
     * 아직 없거나 만들다 실패한 것이라 여기서 되살리면 안 되고, {@code terminated} 는 지울
     * 예정이라 새 구조를 밀어 넣을 이유가 없다.
     */
    List<Workspace> findByStatusInAndSchemaNameIsNotNullOrderByIdAsc(
            Collection<WorkspaceStatus> statuses);
}
