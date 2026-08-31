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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * 계정에 연결된 소셜 제공자. (shared.user_identities)
 *
 * <p>연결 키는 {@code providerUserId} 다. 제공자가 주는 불변 식별자(Google 의 {@code sub},
 * 네이버의 {@code id})이며 제공자 쪽에서 이메일을 바꿔도 이 값은 그대로다. 이메일로 이었다면
 * 주소를 바꾼 사용자가 다음 로그인에서 남처럼 취급돼 계정이 하나 더 생긴다.
 *
 * <p>이메일도 함께 저장하지만 조회에는 쓰지 않는다. 연결 당시의 기록일 뿐이고, 제공자 쪽에서
 * 바뀐 뒤에는 사실과 다를 수 있다.
 */
@Entity
@Table(
        name = "user_identities",
        schema = "shared",
        uniqueConstraints = {
            @UniqueConstraint(
                    name = "ux_user_identities_provider_subject",
                    columnNames = {"provider", "provider_user_id"}),
            @UniqueConstraint(
                    name = "ux_user_identities_user_provider",
                    columnNames = {"user_id", "provider"})
        },
        indexes = @Index(name = "ix_user_identities_user", columnList = "user_id"))
public class UserIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private AuthProvider provider;

    @Column(name = "provider_user_id", nullable = false, length = 255)
    private String providerUserId;

    @Column(length = 255)
    private String email;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserIdentity() {
        // JPA 용
    }

    private UserIdentity(User user, AuthProvider provider, String providerUserId, String email) {
        this.user = user;
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.email = email;
    }

    public static UserIdentity link(
            User user, AuthProvider provider, String providerUserId, String email) {
        return new UserIdentity(user, provider, providerUserId, email);
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

    /** 제공자 쪽 이메일이 바뀌었을 때 기록을 맞춘다. 연결 자체는 그대로다. */
    public void refreshEmail(String email) {
        this.email = email;
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public AuthProvider getProvider() {
        return provider;
    }

    public String getProviderUserId() {
        return providerUserId;
    }

    public String getEmail() {
        return email;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        return other instanceof UserIdentity that && id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
