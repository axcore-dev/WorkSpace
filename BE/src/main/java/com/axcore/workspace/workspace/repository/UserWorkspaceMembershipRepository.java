package com.axcore.workspace.workspace.repository;

import com.axcore.workspace.workspace.entity.UserWorkspaceMembership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserWorkspaceMembershipRepository
        extends JpaRepository<UserWorkspaceMembership, Long> {

    /**
     * 소속 목록. 회사 이름을 함께 보여주므로 fetch join 으로 가져온다. 아니면 목록 길이만큼
     * 쿼리가 더 나간다.
     *
     * <p>{@code left} 상태까지 포함해 전부 돌려준다. 걸러내는 판단은 화면과 진입 시점이 각각
     * 다르게 하며, 리포지토리가 미리 줄여 버리면 "탈퇴한 회사"를 표시할 방법이 없어진다.
     */
    @Query(
            """
            select m from UserWorkspaceMembership m
              join fetch m.workspace w
             where m.user.id = :userId
             order by w.name asc
            """)
    List<UserWorkspaceMembership> findAllByUserIdWithWorkspace(@Param("userId") UUID userId);

    /**
     * 진입 시점에 소속을 다시 확인하는 경로. 세션에 담긴 {@code workspace_id} 를 믿고
     * {@code search_path} 를 세팅하면 소속이 회수된 뒤에도 접근이 열린 채로 남는다.
     * (docs/db/schema-draft-v2.md)
     */
    @Query(
            """
            select m from UserWorkspaceMembership m
              join fetch m.workspace w
             where m.user.id = :userId
               and w.id = :workspaceId
            """)
    Optional<UserWorkspaceMembership> findByUserIdAndWorkspaceIdWithWorkspace(
            @Param("userId") UUID userId, @Param("workspaceId") Long workspaceId);
}
