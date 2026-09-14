package com.axcore.workspace.user.service;

import com.axcore.workspace.user.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 「데모 체험하기」 계정. {@code app.demo.*} 로 주입된다.
 *
 * <p>자격을 여기에만 둔다 — 브라우저로 보내지 않는다. 예전에는 FE 가 {@code NEXT_PUBLIC_DEMO_PASSWORD} 로
 * 비밀번호를 번들에 실어 로그인했고, 배포 사이트를 여는 누구나 그 값을 읽을 수 있었다(#92). 이제 FE 는
 * {@code POST /api/auth/demo-login} 만 부르고, 어느 계정으로 들어가는지는 서버만 안다.
 *
 * <p>둘 중 하나라도 비면 꺼진 것으로 본다. 데모용이 아닌 배포에는 그냥 값을 넣지 않으면 된다.
 */
@Component
public class DemoAccount {

    private final String email;
    private final String password;

    public DemoAccount(
            @Value("${app.demo.email:}") String email, @Value("${app.demo.password:}") String password) {
        this.email = email.isBlank() ? "" : User.normalizeEmail(email);
        this.password = password;
    }

    public boolean configured() {
        return !email.isEmpty() && !password.isBlank();
    }

    public String email() {
        return email;
    }

    public String password() {
        return password;
    }

    /**
     * 이 사용자가 데모 계정인가. 비밀번호·2단계 변경을 막는 데 쓴다 — 버튼을 누르는 누구나 이 계정의 세션을
     * 받으므로, 그중 한 사람이 비밀번호를 바꾸면 다음 시연부터 전부 막힌다.
     */
    public boolean is(User user) {
        return configured() && email.equals(user.getEmail());
    }
}
