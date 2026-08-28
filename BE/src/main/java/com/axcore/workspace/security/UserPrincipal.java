package com.axcore.workspace.security;

import com.axcore.workspace.user.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * SecurityContext 에 담기는 인증 주체. 컨트롤러에서 {@code @AuthenticationPrincipal} 로 받는다.
 *
 * <p>User 엔티티를 그대로 담지 않는 이유는, 인증 필터가 만든 detached 엔티티가 요청 내내
 * 살아 있으면 LAZY 프록시 초기화 실패나 의도치 않은 dirty checking 이 생기기 때문이다.
 * 필요한 값만 복사해 불변으로 들고 있는다.
 *
 * <p>권한(authorities)은 지금 비어 있다. 스키마 초안의 권한 모델이 3층 교집합
 * (workspace_modules × role_module_grants × member_module_grants)인데 아직 미결정이라,
 * workspace_members 를 다룰 때 채운다.
 */
public final class UserPrincipal implements UserDetails {

    private final UUID id;
    private final String email;
    private final String name;
    private final String passwordHash;

    private UserPrincipal(UUID id, String email, String name, String passwordHash) {
        this.id = id;
        this.email = email;
        this.name = name;
        this.passwordHash = passwordHash;
    }

    public static UserPrincipal from(User user) {
        return new UserPrincipal(
                user.getId(), user.getEmail(), user.getName(), user.getPasswordHash());
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getName() {
        return name;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of();
    }

    /** DaoAuthenticationProvider 가 PasswordEncoder 로 대조할 값. */
    @Override
    public String getPassword() {
        return passwordHash;
    }

    /** Spring Security 가 말하는 username 은 로그인 식별자다. 여기서는 이메일. */
    @Override
    public String getUsername() {
        return email;
    }

    /**
     * 잠금·만료·비활성 상태는 아직 users 테이블에 컬럼이 없다. 전부 true 로 두되,
     * 상태 컬럼이 생기면 여기부터 반영하면 된다.
     */
    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    /** passwordHash 는 로그에 남기지 않는다. */
    @Override
    public String toString() {
        return "UserPrincipal{id=%s, email=%s}".formatted(id, email);
    }
}
