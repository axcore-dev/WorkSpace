package com.axcore.workspace.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * 로그인 계정. (docs/db/schema-draft-v2.md 의 shared.users)
 *
 * <p>역할·부서는 여기 없다. 같은 계정이 A 워크스페이스에서는 관리자이고 B 에서는 구성원일 수
 * 있어서, 스키마 초안이 role_id/department_id 를 workspace_members 에 뒀다.
 */
@Entity
@Table(
        name = "users",
        schema = "shared",
        uniqueConstraints = @UniqueConstraint(name = "ux_users_email", columnNames = "email"))
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * 항상 소문자로 정규화해서 저장한다. {@link #normalizeEmail(String)} 참고.
     *
     * <p>저장 전에 소문자로 맞춰서 평범한 유니크 제약으로 중복을 막는다. Flyway 를 도입해
     * {@code lower(email)} 표현식 인덱스도 만들 수 있지만, 정규화 지점이 하나뿐이라 두지 않았다.
     */
    @Column(nullable = false, length = 255)
    private String email;

    /**
     * DelegatingPasswordEncoder 가 만든 문자열이라 {@code {bcrypt}$2a$10$...} 형태다.
     * 접두사가 붙어 있어서 나중에 argon2id 로 알고리즘을 바꿔도 기존 계정이 그대로 로그인된다.
     */
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    /**
     * 이메일 소유가 확인된 시각. null 이면 미확인이다.
     *
     * <p>가입 자체는 막지 않는다. 확인 링크를 열기 전에도 로그인은 되지만 회사 진입이 막힌다.
     * 아예 로그인을 막으면 확인 메일 재발송을 요청할 통로가 없어져서, 주소를 오타로 적은
     * 사용자가 스스로 빠져나올 수 없다.
     */
    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    /** 프로필 화면의 "비밀번호 마지막 변경" 표시에 쓴다. */
    @Column(name = "password_changed_at")
    private Instant passwordChangedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected User() {
        // JPA 용
    }

    private User(String email, String passwordHash, String name) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.name = name;
    }

    /**
     * @param passwordHash 반드시 인코딩된 해시. 평문을 넘기지 않는다.
     */
    public static User create(String email, String passwordHash, String name) {
        return new User(normalizeEmail(email), passwordHash, name);
    }

    /** 조회·저장 양쪽에서 같은 규칙을 써야 해서 여기에 둔다. */
    public static String normalizeEmail(String email) {
        return email == null ? null : email.strip().toLowerCase();
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
        if (this.passwordChangedAt == null) {
            this.passwordChangedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public void changePassword(String newPasswordHash) {
        this.passwordHash = newPasswordHash;
        this.passwordChangedAt = Instant.now();
    }

    public void recordLogin(Instant at) {
        this.lastLoginAt = at;
    }

    public boolean isEmailVerified() {
        return emailVerifiedAt != null;
    }

    /** 이미 확인된 계정에 다시 확인 링크가 들어와도 최초 시각을 유지한다. */
    public void verifyEmail(Instant at) {
        if (this.emailVerifiedAt == null) {
            this.emailVerifiedAt = at;
        }
    }

    public void updateProfile(String name, String avatarUrl) {
        this.name = name;
        this.avatarUrl = avatarUrl;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getName() {
        return name;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public Instant getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public Instant getPasswordChangedAt() {
        return passwordChangedAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    // id 가 null 인 영속화 전 인스턴스끼리는 동일성으로만 비교한다.
    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        return o instanceof User other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    /** 로그에 해시가 섞여 들어가지 않도록 password 계열은 제외한다. */
    @Override
    public String toString() {
        return "User{id=%s, email=%s, name=%s}".formatted(id, email, name);
    }
}
