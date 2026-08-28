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

        // 소셜 로그인으로만 가입한 계정은 비밀번호가 없다. 여기서 걸러야 하는 이유가 두 가지다.
        //
        // 하나, DelegatingPasswordEncoder 는 matches(raw, null) 에서 IllegalArgumentException 을
        // 던진다("no PasswordEncoder mapped for the id null"). 그대로 두면 401 이어야 할 요청이
        // 500 이 되고, 그 차이만으로 "이 주소는 소셜 계정" 이라는 사실이 새어 나간다.
        //
        // 둘, UsernameNotFoundException 으로 던지면 hideUserNotFoundExceptions 가 이를
        // BadCredentialsException 으로 바꿔 준다. 없는 계정·틀린 비밀번호·소셜 전용 계정이 모두
        // 같은 401 이 된다.
        if (!user.hasPassword()) {
            throw new UsernameNotFoundException("비밀번호가 설정되지 않은 계정입니다");
        }
        return UserPrincipal.from(user);
    }
}
