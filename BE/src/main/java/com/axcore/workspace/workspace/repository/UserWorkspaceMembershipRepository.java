package com.axcore.workspace.workspace.repository;

import com.axcore.workspace.workspace.entity.UserWorkspaceMembership;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
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

    /**
     * 여러 회사의 구성원 수를 한 번에 센다. 운영자 목록이 쓴다.
     *
     * <p>행마다 세면 한 페이지에 회사 수만큼 질의가 나간다(N+1). 목록은 최대 200행까지 열 수
     * 있어서 그대로 두면 화면 하나에 200번을 부른다.
     *
     * <p>돌아온 목록에 없는 회사는 구성원이 0명이다 — 부르는 쪽이 0 으로 채워야 한다.
     */
    @Query(
            """
            select m.workspace.id as workspaceId, count(m) as memberCount
              from UserWorkspaceMembership m
             where m.workspace.id in :workspaceIds
             group by m.workspace.id
            """)
    List<MemberCount> countByWorkspaceIds(@Param("workspaceIds") Collection<Long> workspaceIds);

    /** {@link #countByWorkspaceIds} 결과 한 줄. */
    interface MemberCount {
        Long getWorkspaceId();

        long getMemberCount();
    }
}
