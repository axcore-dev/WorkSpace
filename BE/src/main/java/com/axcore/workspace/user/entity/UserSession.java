package com.axcore.workspace.user.entity;

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
 * 로그인 세션. (docs/db/schema-draft-v1.md 의 user_sessions)
 *
 * <p>JWT 가 아니라 서버 세션 토큰이다. 토큰의 유효 여부를 이 행이 결정하므로
 * {@code revoked_at} 을 채우는 것만으로 즉시 강제 로그아웃이 된다. 비밀번호를 바꿀 때
 * 해당 사용자의 행을 일괄 revoke 하면 화면 문구인 "모든 기기에서 다시 로그인해야 합니다"가 된다.
 */
@Entity
@Table(
        name = "user_sessions",
        uniqueConstraints =
                @UniqueConstraint(name = "ux_user_sessions_token_hash", columnNames = "token_hash"),
        indexes = @Index(name = "ix_user_sessions_user_id", columnList = "user_id"))
public class UserSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * 요청마다 조회되지만 대부분 user_id 만 있으면 되므로 LAZY 로 둔다.
     * 실제 User 가 필요한 경로에서는 리포지토리가 fetch join 으로 가져온다.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * 토큰 원문은 저장하지 않는다. SHA-256 hex 라 길이가 항상 64다.
     *
     * <p>비밀번호와 달리 BCrypt 를 쓰지 않는다. 세션 토큰은 사람이 고른 문자열이 아니라
     * 256비트 난수라 사전 공격 대상이 아니고, BCrypt 는 느린 게 목적이라 매 요청마다
     * 돌리면 그대로 응답 지연이 된다.
     */
    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    /** IPv6 최대 표기 길이가 45자다. */
    @Column(name = "ip", length = 45)
    private String ip;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected UserSession() {
        // JPA 용
    }

    private UserSession(User user, String tokenHash, String userAgent, String ip, Instant expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.userAgent = userAgent;
        this.ip = ip;
        this.expiresAt = expiresAt;
    }

    /**
     * @param tokenHash 반드시 해시. 토큰 원문을 넘기지 않는다.
     */
    public static UserSession issue(
            User user, String tokenHash, String userAgent, String ip, Instant expiresAt) {
        return new UserSession(user, tokenHash, truncate(userAgent, 500), truncate(ip, 45), expiresAt);
    }

    /** User-Agent 는 길이 제한이 없어서 컬럼 길이를 넘길 수 있다. 저장 실패보다 잘라 담는 게 낫다. */
    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public boolean isActive(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    /** 이미 취소된 세션을 다시 취소해도 최초 시각을 유지한다. */
    public void revoke(Instant at) {
        if (this.revokedAt == null) {
            this.revokedAt = at;
        }
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public String getIp() {
        return ip;
    }

    public Instant getExpiresAt() {
        return expiresAt;
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
        return o instanceof UserSession other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    /** tokenHash 는 로그에 남기지 않는다. */
    @Override
    public String toString() {
        return "UserSession{id=%s, expiresAt=%s, revokedAt=%s}".formatted(id, expiresAt, revokedAt);
    }
}
