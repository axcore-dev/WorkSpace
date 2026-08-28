package com.axcore.workspace.user.entity;

import com.axcore.workspace.security.SecureTokens;
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

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * 메일 링크에 실리는 일회용 토큰. (shared.user_tokens)
 *
 * <p>{@link UserSession} 과 같은 규칙이다. 원문은 저장하지 않고 SHA-256 해시만 남긴다. 다른 점은
 * 회전이 없고 한 번 쓰면 끝난다는 것이다.
 *
 * <p>쓴 행을 지우지 않고 {@code consumedAt} 을 채워 두는 이유는, 지워 버리면 "이미 쓴 토큰"과
 * "처음부터 없던 토큰"이 구분되지 않아서다. 응답은 어차피 같게 내보내지만 로그에서는 구분되어야
 * 링크가 두 번 열린 것인지 남의 토큰이 들어온 것인지 알 수 있다.
 */
@Entity
@Table(
        name = "user_tokens",
        schema = "shared",
        uniqueConstraints =
                @UniqueConstraint(name = "ux_user_tokens_token_hash", columnNames = "token_hash"),
        indexes =
                @Index(
                        name = "ix_user_tokens_user_purpose",
                        columnList = "user_id, purpose"))
public class UserToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 30)
    private TokenPurpose purpose;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected UserToken() {
        // JPA 용
    }

    private UserToken(User user, TokenPurpose purpose, String tokenHash, Instant expiresAt) {
        this.user = user;
        this.purpose = purpose;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    /**
     * @param tokenHash 반드시 해시. 토큰 원문을 넘기지 않는다.
     */
    public static UserToken issue(
            User user, TokenPurpose purpose, String tokenHash, Instant now) {
        return new UserToken(user, purpose, tokenHash, now.plus(purpose.ttl()));
    }

    public boolean isUsable(Instant now) {
        return consumedAt == null && !SecureTokens.isExpired(expiresAt, now);
    }

    /** 이미 쓴 토큰을 다시 소비해도 최초 시각을 유지한다. */
    public void consume(Instant at) {
        if (this.consumedAt == null) {
            this.consumedAt = at;
        }
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public TokenPurpose getPurpose() {
        return purpose;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getConsumedAt() {
        return consumedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        return o instanceof UserToken other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    /** tokenHash 는 로그에 남기지 않는다. */
    @Override
    public String toString() {
        return "UserToken{id=%s, purpose=%s, expiresAt=%s}".formatted(id, purpose, expiresAt);
    }
}
