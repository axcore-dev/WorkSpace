package com.axcore.workspace.workspace.entity;

import com.axcore.workspace.security.SecureTokens;
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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * 워크스페이스 접속 링크 한 장.
 *
 * <p>초대는 사용자가 아니라 <b>주소</b>에 매달린다. 계약 회사 담당자가 아직 가입하지 않았을 수
 * 있어서, 초대 시점에 사용자를 특정할 수 없기 때문이다. 대신 수락하는 계정의 이메일이 초대
 * 주소와 같아야 한다 — 링크를 가진 것만으로는 들어가지 못한다.
 *
 * <p>링크가 새더라도 그 주소의 메일함을 열 수 있는 사람만 쓸 수 있다는 뜻이고, 이는 이메일
 * 확인·비밀번호 재설정과 같은 신뢰 모델이다.
 */
@Entity
@Table(
        name = "workspace_invitations",
        schema = "shared",
        uniqueConstraints =
                @UniqueConstraint(name = "ux_wi_token_hash", columnNames = "token_hash"),
        indexes = @Index(name = "ix_wi_workspace", columnList = "workspace_id"))
public class WorkspaceInvitation {

    /**
     * 링크 수명.
     *
     * <p>이메일 확인(24시간)보다 길게 잡는다. 계약 회사 담당자는 우리 일정에 맞춰 메일을 열지
     * 않는다. 결재나 담당자 지정이 끼면 며칠이 지나기도 한다. 반대로 무기한으로 두면 회수되지
     * 않은 링크가 계약 종료 뒤에도 살아 있게 된다.
     */
    public static final Duration TTL = Duration.ofDays(7);

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false)
    private Workspace workspace;

    /** 소문자로 정규화해서 저장한다. 수락 시 계정 이메일과 그대로 비교한다. */
    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by")
    private User invitedBy;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "opened_at")
    private Instant openedAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "accepted_by")
    private User acceptedBy;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected WorkspaceInvitation() {
        // JPA 용
    }

    private WorkspaceInvitation(
            Workspace workspace, String email, String tokenHash, User invitedBy, Instant expiresAt) {
        this.workspace = workspace;
        this.email = email;
        this.tokenHash = tokenHash;
        this.invitedBy = invitedBy;
        this.expiresAt = expiresAt;
    }

    /**
     * @param rawToken 해시해서 담는다. 원문은 메일에만 남는다
     */
    public static WorkspaceInvitation issue(
            Workspace workspace, String email, String rawToken, User invitedBy, Instant now) {
        return new WorkspaceInvitation(
                workspace,
                normalizeEmail(email),
                SecureTokens.hash(rawToken),
                invitedBy,
                now.plus(TTL));
    }

    /** 조회·저장 양쪽에서 같은 규칙을 써야 해서 여기에 둔다. {@code User.normalizeEmail} 과 같다. */
    public static String normalizeEmail(String email) {
        return email == null ? null : email.strip().toLowerCase();
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    /** 아직 쓸 수 있는 링크인가. 수락됨 · 회수됨 · 만료 중 하나라도 걸리면 못 쓴다. */
    public boolean isUsable(Instant now) {
        return acceptedAt == null
                && revokedAt == null
                && !SecureTokens.isExpired(expiresAt, now);
    }

    /** 초대 주소와 이 계정이 같은 사람인가. */
    public boolean matches(User user) {
        return email.equals(user.getEmail());
    }

    /** 링크를 처음 연 시각만 남긴다. 두 번째부터는 덮어쓰지 않는다. */
    public void markOpened(Instant at) {
        if (this.openedAt == null) {
            this.openedAt = at;
        }
    }

    public void accept(User user, Instant at) {
        this.acceptedAt = at;
        this.acceptedBy = user;
    }

    /** 회수. 이미 수락된 초대는 되돌리지 않는다 — 멤버십은 이미 만들어졌다. */
    public void revoke(Instant at) {
        if (this.acceptedAt == null && this.revokedAt == null) {
            this.revokedAt = at;
        }
    }

    /** 목록 화면이 쓰는 요약 상태. DB 컬럼이 아니라 세 시각에서 파생한다. */
    public Status statusAt(Instant now) {
        if (acceptedAt != null) {
            return Status.ACCEPTED;
        }
        if (revokedAt != null) {
            return Status.REVOKED;
        }
        return SecureTokens.isExpired(expiresAt, now) ? Status.EXPIRED : Status.PENDING;
    }

    public enum Status {
        PENDING,
        ACCEPTED,
        REVOKED,
        EXPIRED
    }

    public UUID getId() {
        return id;
    }

    public Workspace getWorkspace() {
        return workspace;
    }

    public String getEmail() {
        return email;
    }

    public User getInvitedBy() {
        return invitedBy;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getOpenedAt() {
        return openedAt;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        return o instanceof WorkspaceInvitation other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "WorkspaceInvitation{id=%s, email=%s, expiresAt=%s}".formatted(id, email, expiresAt);
    }
}
