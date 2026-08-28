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
 * 로그인 세션. refresh 토큰 한 장이 기기 한 대에 대응한다. (docs/db/schema-draft-v2.md 의 shared.user_sessions)
 *
 * <p>access 토큰은 JWT 라 서버에 남지 않는다. 여기 저장되는 것은 refresh 토큰의 해시뿐이고,
 * 그래서 {@code revoked_at} 을 채우면 재발급이 막힌다. 다만 이미 발급돼 나간 access 토큰은
 * 서명만으로 통과하므로 최대 access TTL 만큼 더 살아 있다. TTL 을 짧게 두는 이유가 이것이다.
 *
 * <p>비밀번호를 바꿀 때 해당 사용자의 행을 일괄 revoke 하면 화면 문구인
 * "모든 기기에서 다시 로그인해야 합니다"가 된다.
 */
@Entity
@Table(
        name = "user_sessions",
        schema = "shared",
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
     * 선택된 회사. 로그인만 하고 아직 회사를 고르지 않은 상태가 있어 nullable 이다.
     *
     * <p>이 값이 그대로 {@code search_path} 를 정한다. 그래서 회사 전환 시점마다
     * {@code shared.user_workspace_memberships} 를 재확인해야 한다. 세션에 담긴 값을 믿고
     * 스키마를 열면 소속이 회수된 뒤에도 접근이 열린 채로 남는다.
     *
     * <p>연관관계 대신 식별자만 둔다. 세션 검증 경로에서 필요한 건 스키마 이름을 찾을 id 뿐이라
     * 워크스페이스 엔티티를 매번 로딩할 이유가 없다.
     */
    @Column(name = "workspace_id")
    private Long workspaceId;

    /**
     * refresh 토큰 원문은 저장하지 않는다. SHA-256 hex 라 길이가 항상 64다.
     *
     * <p>비밀번호와 달리 BCrypt 를 쓰지 않는다. refresh 토큰은 사람이 고른 문자열이 아니라
     * 256비트 난수라 사전 공격 대상이 아니고, BCrypt 는 느린 게 목적이라 재발급 경로에
     * 그대로 지연으로 얹힌다.
     */
    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    /**
     * 회전으로 이 행을 대체한 세션 id.
     *
     * <p>refresh 를 쓰면 그 자리에서 폐기하고 새 행을 발급한 뒤 그 id 를 여기 적는다. 이 값이
     * 채워진 폐기 행에 같은 토큰이 다시 들어오면, 정상 클라이언트는 이미 새 토큰을 들고 있으므로
     * 탈취된 사본이 쓰인 것으로 본다. 반대로 로그아웃·만료로 폐기된 행은 이 값이 비어 있어서
     * 단순 만료와 재사용을 구분할 수 있다.
     *
     * <p>연관관계 대신 식별자만 둔다. 회전 사슬을 거슬러 올라갈 일이 없다.
     */
    @Column(name = "rotated_to")
    private UUID rotatedTo;

    /**
     * 로그인 화면의 "로그인 유지" 체크값. (명세 2.1.2)
     *
     * <p>수명뿐 아니라 쿠키의 성격을 정한다. 꺼져 있으면 Max-Age 없는 세션 쿠키로 내려서
     * 브라우저를 닫는 순간 사라지게 한다. 공용 PC 를 고려해 기본값이 해제인 항목이라,
     * 재발급 때도 같은 성격을 이어가려면 세션 자체가 이 값을 들고 있어야 한다.
     */
    @Column(name = "remember_me", nullable = false)
    private boolean rememberMe;

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

    private UserSession(
            User user,
            String tokenHash,
            boolean rememberMe,
            String userAgent,
            String ip,
            Instant expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.rememberMe = rememberMe;
        this.userAgent = userAgent;
        this.ip = ip;
        this.expiresAt = expiresAt;
    }

    /**
     * @param tokenHash 반드시 해시. 토큰 원문을 넘기지 않는다.
     */
    public static UserSession issue(
            User user,
            String tokenHash,
            boolean rememberMe,
            String userAgent,
            String ip,
            Instant expiresAt) {
        return new UserSession(
                user,
                tokenHash,
                rememberMe,
                truncate(userAgent, 500),
                truncate(ip, 45),
                expiresAt);
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

    /**
     * 회사 선택 화면에서 고른 회사를 세션에 기록한다.
     *
     * <p>호출 전에 소속을 확인하는 건 호출자 몫이다. 이 메서드는 검증하지 않는다.
     */
    public void selectWorkspace(Long workspaceId) {
        this.workspaceId = workspaceId;
    }

    /**
     * 이 refresh 를 폐기하고 후속 세션으로 넘긴다. 회전(rotation)은 재사용 탐지의 전제다.
     * 회전하지 않으면 탈취된 토큰과 정상 토큰이 구별되지 않는다.
     */
    public void rotateTo(UUID nextSessionId, Instant at) {
        this.rotatedTo = nextSessionId;
        revoke(at);
    }

    /** 이미 회전된 refresh 가 다시 들어온 경우. 탈취로 간주하고 그 사용자의 세션을 전부 끊는다. */
    public boolean isReuseAttempt() {
        return revokedAt != null && rotatedTo != null;
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public Long getWorkspaceId() {
        return workspaceId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public UUID getRotatedTo() {
        return rotatedTo;
    }

    public boolean isRememberMe() {
        return rememberMe;
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
