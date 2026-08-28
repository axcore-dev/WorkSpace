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

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * 비밀번호는 통과했지만 2단계가 남은 중간 상태. (shared.mfa_challenges)
 *
 * <p>이 행이 사는 동안에는 access·refresh 가 발급되지 않는다. 클라이언트가 들고 있는 것은
 * 챌린지 토큰뿐이고, 그것만으로는 아무 API 도 부를 수 없다.
 *
 * <p>통과하려면 <b>두 가지</b>가 모두 맞아야 한다 — 응답으로 받은 챌린지 토큰(256비트 난수)과
 * 메일로 받은 6자리 코드. 코드만 알아서는 어느 챌린지인지 지목할 수 없고, 챌린지 토큰만
 * 가로채도 코드를 모르면 통과하지 못한다.
 *
 * <p>코드를 {@code PasswordEncoder} 로 저장하는 이유는 자릿수 때문이다. 후보가 100만 개뿐이라
 * SHA-256 이면 덤프를 얻은 쪽이 즉시 역산한다. 다만 해시를 느리게 하는 것만으로는 온라인 대입을
 * 막지 못해서, 실질적인 방어선은 {@link #MAX_ATTEMPTS} 와 짧은 만료다.
 */
@Entity
@Table(
        name = "mfa_challenges",
        schema = "shared",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "ux_mfa_challenges_token_hash",
                        columnNames = "token_hash"),
        indexes = @Index(name = "ix_mfa_challenges_user_id", columnList = "user_id"))
public class MfaChallenge {

    /**
     * 코드 오입력 상한. 6자리를 무작위로 맞힐 확률이 시도당 100만분의 1이라, 5회로 끊으면
     * 챌린지 한 장당 성공 확률이 20만분의 1이다. 넘으면 챌린지를 폐기하고 다시 로그인시킨다.
     */
    public static final int MAX_ATTEMPTS = 5;

    /**
     * 메일이 도착해 사람이 옮겨 적기에 충분하면서, 메일함이 잠깐 열려 있는 상황을 길게 남기지
     * 않는 값이다.
     */
    public static final Duration TTL = Duration.ofMinutes(10);

    /** 사람이 옮겨 적는 값이라 늘리면 오입력이 늘고, 줄이면 대입이 쉬워진다. */
    public static final int CODE_DIGITS = 6;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private MfaPurpose purpose;

    @Column(nullable = false, length = 20)
    private MfaMethod method;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    /** {@code PasswordEncoder} 가 만든 문자열이라 접두어가 붙는다. SHA-256 hex 가 아니다. */
    @Column(name = "code_hash", nullable = false, length = 255)
    private String codeHash;

    @Column(nullable = false)
    private int attempts;

    /**
     * 로그인 요청에 실려 온 "로그인 유지" 값.
     *
     * <p>2단계를 통과한 뒤에야 세션이 발급되는데 그때는 원래 요청 본문이 없다. 여기 담아 두지
     * 않으면 2단계를 켠 사용자만 로그인 유지가 조용히 풀린다.
     */
    @Column(name = "remember_me", nullable = false)
    private boolean rememberMe;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected MfaChallenge() {
        // JPA 용
    }

    private MfaChallenge(
            User user,
            MfaPurpose purpose,
            MfaMethod method,
            String tokenHash,
            String codeHash,
            boolean rememberMe,
            Instant expiresAt) {
        this.user = user;
        this.purpose = purpose;
        this.method = method;
        this.tokenHash = tokenHash;
        this.codeHash = codeHash;
        this.rememberMe = rememberMe;
        this.expiresAt = expiresAt;
    }

    /**
     * @param tokenHash 챌린지 토큰의 SHA-256 해시
     * @param codeHash  6자리 코드의 {@code PasswordEncoder} 해시. 어느 쪽도 원문을 넘기지 않는다.
     */
    public static MfaChallenge issue(
            User user,
            MfaPurpose purpose,
            MfaMethod method,
            String tokenHash,
            String codeHash,
            boolean rememberMe,
            Instant now) {
        return new MfaChallenge(
                user, purpose, method, tokenHash, codeHash, rememberMe, now.plus(TTL));
    }

    public boolean isUsable(Instant now) {
        return consumedAt == null
                && attempts < MAX_ATTEMPTS
                && !SecureTokens.isExpired(expiresAt, now);
    }

    /**
     * 코드가 틀렸다. 시도 횟수를 올리고, 상한에 닿으면 그 자리에서 폐기한다.
     *
     * @return 상한에 닿아 폐기됐으면 true
     */
    public boolean recordFailedAttempt(Instant at) {
        this.attempts++;
        if (this.attempts >= MAX_ATTEMPTS) {
            consume(at);
            return true;
        }
        return false;
    }

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

    public MfaPurpose getPurpose() {
        return purpose;
    }

    public MfaMethod getMethod() {
        return method;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public int getAttempts() {
        return attempts;
    }

    public boolean isRememberMe() {
        return rememberMe;
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
        return o instanceof MfaChallenge other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    /** tokenHash·codeHash 는 로그에 남기지 않는다. */
    @Override
    public String toString() {
        return "MfaChallenge{id=%s, purpose=%s, method=%s, attempts=%d}"
                .formatted(id, purpose, method, attempts);
    }
}
