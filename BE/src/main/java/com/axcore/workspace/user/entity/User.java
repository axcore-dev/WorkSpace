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

    /**
     * 비밀번호를 연속으로 이만큼 틀리면 계정이 잠긴다.
     *
     * <p>잠금은 시간으로 풀리지 않고 비밀번호 재설정으로만 해제된다. 그래서 정상 사용자가
     * 오타로 닿기는 어렵고 공격자에게는 충분히 좁은 값이어야 해서 6 으로 둔다.
     */
    public static final int MAX_LOGIN_ATTEMPTS = 6;

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
     *
     * <p><b>null 일 수 있다.</b> 소셜 로그인으로만 가입한 계정은 비밀번호가 없다. 빈 문자열이나
     * 아무도 모르는 난수 해시를 채워 넣지 않는 이유는, 그러면 "비밀번호가 없다"와 "맞힐 수 없는
     * 비밀번호가 있다"를 구분할 수 없어서다. 비밀번호 로그인·변경 경로에서 그 차이가 필요하다.
     * {@link #hasPassword()} 로 확인한다.
     */
    @Column(name = "password_hash", length = 255)
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

    /**
     * 우리 쪽 운영자인가. ({@code /api/admin/**} 접근 가부)
     *
     * <p>워크스페이스는 고객이 직접 만들지 않고 우리가 만들어 준다. 그 API 를 부를 수 있는
     * 사람을 가르는 값이다. 고객 계정은 항상 false 다.
     *
     * <p><b>토큰에 싣지 않는다.</b> access 토큰은 최대 TTL 만큼 살아 있어서, 클레임으로 두면
     * 권한을 회수해도 그 시간 동안 계속 통한다. 회사 선택이 매번 소속을 다시 확인하는 것과
     * 같은 이유로 요청 시점의 이 값을 본다.
     */
    @Column(name = "is_internal_admin", nullable = false)
    private boolean internalAdmin;

    /** 프로필 화면의 "비밀번호 마지막 변경" 표시에 쓴다. */
    /**
     * 연속 비밀번호 실패 횟수. {@link #MAX_LOGIN_ATTEMPTS} 에 닿으면 계정이 잠긴다.
     *
     * <p>실패한 순간의 요청은 예외로 끝나 트랜잭션이 되돌아간다. 그래서 이 값을 올리는 일은
     * 로그인 트랜잭션이 아니라 별도 트랜잭션에서 해야 한다
     * ({@code LoginAttemptRecorder}). 2단계 코드 시도 횟수와 같은 구조다.
     */
    @Column(name = "failed_login_attempts", nullable = false)
    private int failedLoginAttempts;

    /** 비밀번호 연속 실패로 잠긴 시각. NULL 이면 정상. */
    @Column(name = "locked_at")
    private Instant lockedAt;

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

    /**
     * 소셜 로그인으로 처음 들어온 사람의 계정. 비밀번호가 없다.
     *
     * <p>이메일 확인 처리는 여기서 하지 않는다. 제공자가 소유를 확인해 준 경우에만
     * {@link #verifyEmail(Instant)} 를 부르는 것이 호출하는 쪽의 판단이고, 그 판단을 엔티티가
     * 대신하면 확인되지 않은 주소까지 확인 처리될 수 있다.
     */
    public static User createSocial(String email, String name, String avatarUrl) {
        User user = new User(normalizeEmail(email), null, name);
        user.avatarUrl = avatarUrl;
        return user;
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
        // 비밀번호가 없는 계정에는 채우지 않는다. 채우면 프로필 화면이 설정한 적 없는 비밀번호의
        // "마지막 변경" 시각을 보여 준다.
        if (this.passwordChangedAt == null && this.passwordHash != null) {
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

    /**
     * 소셜로만 가입된 계정(비밀번호 없음)에 이메일 가입이 들어왔다. 계정을 새로 만들지 않고
     * 이 계정에 비밀번호와 이름을 붙인다.
     *
     * <p><b>이메일 확인을 다시 받는다.</b> 이 요청은 주소를 아는 사람이면 누구나 보낼 수 있고,
     * 비밀번호를 붙이는 순간 그 사람이 비밀번호 로그인으로 이 계정에 들어올 수 있게 된다.
     * 확인 시각을 비워 두면 {@code SessionIssuer#nextStep} 이 회사 선택 앞에서 막고, 확인 메일은
     * 언제나 주소의 진짜 주인에게만 간다. 주인이 그 메일을 열기 전에는 붙인 비밀번호로 회사
     * 데이터에 닿지 못한다. ({@link #verifyEmail} 이 최초 시각을 유지하는 것과 다른 경로다.)
     *
     * <p>비밀번호가 있는 계정에는 부르지 않는다. 그 계정은 중복 가입이고, 비밀번호를 덮어쓰면
     * 주소만 아는 사람이 남의 비밀번호를 바꿀 수 있게 된다. 호출하는 쪽이
     * {@link #hasPassword()} 로 먼저 거른다.
     *
     * @param passwordHash 반드시 인코딩된 해시. 평문을 넘기지 않는다.
     */
    public void completeEmailSignUp(String passwordHash, String name) {
        if (this.passwordHash != null) {
            throw new IllegalStateException("비밀번호가 있는 계정에는 이메일 가입을 덧붙일 수 없다");
        }
        this.passwordHash = passwordHash;
        this.passwordChangedAt = Instant.now();
        this.name = name;
        this.emailVerifiedAt = null;
    }

    public void recordLogin(Instant at) {
        this.lastLoginAt = at;
    }

    /**
     * 비밀번호가 틀렸다. 실패 횟수를 올리고, 상한에 닿으면 그 자리에서 잠근다.
     *
     * <p>이미 잠긴 계정은 더 올리지 않는다. 잠긴 뒤에도 계속 시도가 들어오면 숫자만 무한히
     * 커지고, 그 값으로 판단하는 것이 아무것도 없다.
     *
     * @return 이번 실패로 잠겼으면 true. 잠금 안내 메일을 보낼지 정하는 데 쓴다
     */
    public boolean recordFailedLogin(Instant at) {
        if (isLocked()) {
            return false;
        }
        this.failedLoginAttempts++;
        if (this.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
            this.lockedAt = at;
            return true;
        }
        return false;
    }

    /**
     * 실패 기록과 잠금을 함께 지운다.
     *
     * <p>부르는 곳은 셋이다. 로그인 성공 · 비밀번호 변경 · 비밀번호 재설정. 셋 다 "비밀번호를
     * 아는 사람" 이거나 "메일함을 여는 사람" 임이 증명된 시점이라 연속 실패 기록을 유지할
     * 이유가 없다.
     *
     * <p>시간으로는 풀리지 않는다. 자동 해제를 두면 잠금이 사실상 지연 장치가 되고, 공격자는
     * 기다렸다가 다시 시도하면 된다.
     */
    public void clearLoginFailures() {
        this.failedLoginAttempts = 0;
        this.lockedAt = null;
    }

    /** 잠긴 계정인가. 비밀번호 로그인만 막고 소셜 로그인은 막지 않는다 — 아래 참고. */
    public boolean isLocked() {
        return lockedAt != null;
    }

    /**
     * 비밀번호 자격증명을 가진 계정인가.
     *
     * <p>false 면 비밀번호 로그인이 불가능하고, 현재 비밀번호를 요구하는 조작(비밀번호 변경,
     * 2단계 끄기)도 할 수 없다. 처음 설정하는 통로는 둘이다 — 비밀번호 재설정 링크, 또는 같은
     * 주소로 이메일 가입({@link #completeEmailSignUp}).
     */
    public boolean hasPassword() {
        return passwordHash != null;
    }

    public boolean isEmailVerified() {
        return emailVerifiedAt != null;
    }

    /** 운영자 API 를 부를 수 있는가. 값을 바꾸는 경로는 애플리케이션에 두지 않는다 — 아래 참고. */
    public boolean isInternalAdmin() {
        return internalAdmin;
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

    public int getFailedLoginAttempts() {
        return failedLoginAttempts;
    }

    public Instant getLockedAt() {
        return lockedAt;
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
