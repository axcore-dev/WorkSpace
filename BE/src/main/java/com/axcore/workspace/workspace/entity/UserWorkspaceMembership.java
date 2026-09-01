package com.axcore.workspace.workspace.entity;

import com.axcore.workspace.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.Objects;

/**
 * 어느 스키마를 열어야 하는가만 답하는 라우팅 인덱스. (shared.user_workspace_memberships)
 *
 * <p>실제 역할·부서·모듈 권한은 테넌트 스키마의 {@code members} 에 있다. 여기 있는 것은
 * "이 사람이 이 회사에 들어갈 수 있는가" 하나뿐이다. 로그인 시점에는 아직 스키마가 정해지지
 * 않아서 이 판단만은 전역에 있어야 한다.
 */
@Entity
@Table(
        name = "user_workspace_memberships",
        schema = "shared",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "ux_uwm_user_workspace",
                        columnNames = {"user_id", "workspace_id"}),
        indexes = @Index(name = "ix_uwm_user_id", columnList = "user_id"))
public class UserWorkspaceMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * 목록 화면이 회사 이름을 함께 보여주므로 여기서는 연관관계로 둔다. 세션 검증 경로에서
     * 식별자만 필요한 {@code UserSession.workspaceId} 와는 쓰임이 다르다.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    @Column(nullable = false, length = 20)
    private MembershipStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserWorkspaceMembership() {
        // JPA 용
    }

    private UserWorkspaceMembership(User user, Workspace workspace, MembershipStatus status) {
        this.user = user;
        this.workspace = workspace;
        this.status = status;
    }

    /**
     * 초대를 수락해 회사에 합류한다.
     *
     * <p>{@link MembershipStatus#INVITED} 가 아니라 곧바로 {@code ACTIVE} 다. 초대의 대기
     * 상태는 {@code workspace_invitations} 가 들고 있고, 그쪽은 아직 가입하지 않은 주소도
     * 담을 수 있다. 여기에 행이 생겼다는 것은 이미 수락이 끝났다는 뜻이다.
     *
     * <p>{@code INVITED} 는 이미 가입한 사용자를 회사가 직접 초대하는 흐름이 생길 때 쓴다.
     */
    public static UserWorkspaceMembership join(User user, Workspace workspace) {
        return new UserWorkspaceMembership(user, workspace, MembershipStatus.ACTIVE);
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    /**
     * 소속과 회사가 <b>둘 다</b> 살아 있어야 진입할 수 있다.
     *
     * <p>둘을 따로 보면 정지된 회사에 활성 소속으로 들어가거나, 살아 있는 회사에 회수된 소속으로
     * 들어가는 구멍이 생긴다.
     */
    public boolean isEnterable() {
        return status.isEnterable() && workspace.isEnterable();
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public Workspace getWorkspace() {
        return workspace;
    }

    public MembershipStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        return o instanceof UserWorkspaceMembership other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "UserWorkspaceMembership{id=%s, status=%s}".formatted(id, status);
    }
}
