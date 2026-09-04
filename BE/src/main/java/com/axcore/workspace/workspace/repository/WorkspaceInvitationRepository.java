package com.axcore.workspace.workspace.repository;

import com.axcore.workspace.workspace.entity.WorkspaceInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceInvitationRepository extends JpaRepository<WorkspaceInvitation, UUID> {

    /** 링크를 받았을 때 쓴다. 워크스페이스를 함께 당겨 온다 — 미리보기·수락 양쪽에서 바로 필요하다. */
    @Query(
            """
            select i from WorkspaceInvitation i
              join fetch i.workspace
             where i.tokenHash = :tokenHash
            """)
    Optional<WorkspaceInvitation> findByTokenHashWithWorkspace(
            @Param("tokenHash") String tokenHash);

    @Query(
            """
            select i from WorkspaceInvitation i
             where i.workspace.id = :workspaceId
             order by i.createdAt desc
            """)
    List<WorkspaceInvitation> findAllByWorkspaceId(@Param("workspaceId") Long workspaceId);

    Optional<WorkspaceInvitation> findByIdAndWorkspaceId(UUID id, Long workspaceId);

    /**
     * 같은 회사·같은 주소로 아직 살아 있는(수락·회수되지 않고 만료 전인) 초대.
     *
     * <p>부분 유니크 인덱스({@code ux_wi_pending})가 수락·회수 전 초대를 주소당 하나로 묶어 두므로
     * 결과는 최대 한 건이다. 운영자 콘솔이 "이미 초대돼 있음" 을 보여 줄 때 쓴다 — 링크 원문은
     * 저장하지 않으므로 이 조회로 링크를 다시 꺼낼 수는 없다.
     */
    @Query(
            """
            select i from WorkspaceInvitation i
             where i.workspace.id = :workspaceId
               and i.email = :email
               and i.acceptedAt is null
               and i.revokedAt is null
               and i.expiresAt > :now
            """)
    Optional<WorkspaceInvitation> findOutstanding(
            @Param("workspaceId") Long workspaceId,
            @Param("email") String email,
            @Param("now") Instant now);

    /**
     * 같은 회사·같은 주소로 살아 있는 초대를 회수한다.
     *
     * <p>재발송 직전에 부른다. 부분 유니크 인덱스({@code ux_wi_pending})가 중복을 막고 있어서,
     * 이걸 먼저 하지 않으면 두 번째 발송이 제약 위반으로 떨어진다. 동시에 유효한 링크가 여러 장
     * 돌아다니는 것도 막는다.
     */
    // clearAutomatically 를 켜지 않는다. 이 쿼리를 부르는 invite() 는 직전에 Workspace 를
    // 들고 있다가 직후에 markLinkSent() 로 수정한다. 컨텍스트를 비우면 그 엔티티가 detach 돼
    // 발송 시각이 조용히 저장되지 않는다. 여기서 회수한 초대를 뒤에서 다시 읽지 않으므로
    // 비울 이유도 없다. flush 는 필요하다 — 벌크 update 전에 밀린 변경이 먼저 나가야 한다.
    @Modifying(flushAutomatically = true)
    @Query(
            """
            update WorkspaceInvitation i
               set i.revokedAt = :at
             where i.workspace.id = :workspaceId
               and i.email = :email
               and i.acceptedAt is null
               and i.revokedAt is null
            """)
    int revokeOutstanding(
            @Param("workspaceId") Long workspaceId,
            @Param("email") String email,
            @Param("at") Instant at);
}
