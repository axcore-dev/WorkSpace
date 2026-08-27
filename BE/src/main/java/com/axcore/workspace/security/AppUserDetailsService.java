package com.axcore.workspace.security;

import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인 시점에만 쓰인다. 이후 요청은 JWT 서명만 보고 통과하므로 여기를 타지 않는다.
 *
 * <p>여기서 던지는 {@link UsernameNotFoundException} 은 DaoAuthenticationProvider 가
 * BadCredentialsException 으로 바꿔 준다(hideUserNotFoundExceptions). "없는 계정" 과
 * "비밀번호 불일치" 가 같은 예외가 돼야 계정 존재 여부가 새지 않는다. (명세 2.1.4)
 */
@Service
public class AppUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public AppUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user =
                userRepository
                        .findByEmail(User.normalizeEmail(email))
                        .orElseThrow(() -> new UsernameNotFoundException("계정을 찾을 수 없습니다"));
        return UserPrincipal.from(user);
    }
}
