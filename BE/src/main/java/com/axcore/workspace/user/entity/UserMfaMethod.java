package com.axcore.workspace.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.Objects;

/**
 * 사용자가 켜 둔 2단계 인증 수단. (shared.user_mfa_methods — V2 가 만들어 둔 테이블)
 *
 * <p>{@code enabled} 와 {@code verifiedAt} 을 따로 두는 이유: 수단을 등록하는 순간 켜 버리면
 * 소유 확인이 끝나기 전에 2단계가 걸린다. 오타가 난 주소를 등록하면 그대로 계정에서 잠긴다.
 * 등록은 확인 코드를 보내는 데까지고, {@code enabled} 는 코드가 맞은 뒤에 올라간다.
 *
 * <p>{@code secret_ref} 는 여기서 쓰지 않는다. TOTP 시드처럼 서버가 보관해야 하는 비밀이 있는
 * 수단에서만 필요하고, 이메일 OTP 는 발송할 주소가 이미 {@code users.email} 에 있다.
 */
@Entity
@Table(
        name = "user_mfa_methods",
        schema = "shared",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "ux_user_mfa_methods",
                        columnNames = {"user_id", "method"}))
public class UserMfaMethod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private MfaMethod method;

    @Column(nullable = false)
    private boolean enabled;

    /** 비밀 저장소의 참조 키만 둔다. 시드 원문은 DB 에 저장하지 않는다. 이메일 OTP 는 쓰지 않는다. */
    @Column(name = "secret_ref", length = 255)
    private String secretRef;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserMfaMethod() {
        // JPA 용
    }

    private UserMfaMethod(User user, MfaMethod method) {
        this.user = user;
        this.method = method;
        this.enabled = false;
    }

    /** 등록만 한 상태. 확인 코드가 맞을 때까지 켜지지 않는다. */
    public static UserMfaMethod register(User user, MfaMethod method) {
        return new UserMfaMethod(user, method);
    }

    public void markVerified(Instant at) {
        this.verifiedAt = at;
        this.enabled = true;
    }

    /**
     * 끄기. {@code verifiedAt} 은 지우지 않는다. 한 번 확인된 주소라는 사실은 남겨 두는 편이
     * 다시 켤 때 확인 절차를 판단하는 근거가 된다.
     */
    public void disable() {
        this.enabled = false;
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

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public MfaMethod getMethod() {
        return method;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getSecretRef() {
        return secretRef;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
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
        return o instanceof UserMfaMethod other && id != null && id.equals(other.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "UserMfaMethod{id=%s, method=%s, enabled=%s}".formatted(id, method, enabled);
    }
}
