package com.axcore.workspace.user.service;

import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 이메일 확인이 끝나지 않은 계정을 밀어낸다.
 *
 * <p><b>규칙은 하나다 — 확인되지 않은 계정은 그 이메일 주소를 점유하지 않는다.</b>
 *
 * <p>이것이 막는 것은 주소 선점이다. 남의 주소로 가입해 두면 그 주소의 진짜 주인이 가입할 수
 * 없게 된다({@code ux_users_email}). 탈취는 아니다 — 확인되지 않은 계정은
 * {@link SessionIssuer#nextStep} 이 회사 선택 앞에서 막기 때문에 데이터에 닿지 못한다. 하지만
 * 주인이 서비스를 쓰지 못하게 만드는 것만으로 충분히 문제다.
 *
 * <p>선점 경로는 둘이고 둘 다 이 규칙 하나로 닫힌다.
 *
 * <ul>
 *   <li>이메일 가입 — {@link AuthService#signUp} 에서 남의 주소로 계정을 만드는 경우
 *   <li>소셜 로그인 — {@link SocialAccountLinker} 에서 제공자 계정에 남의 주소를 적어 두고
 *       로그인하는 경우
 * </ul>
 *
 * <p><b>확인된 계정은 어떤 경우에도 밀어내지 않는다.</b> 그러면 이 장치 자체가 계정을 지우는
 * 공격 도구가 된다. 판단은 {@link User#isEmailVerified()} 하나뿐이고 다른 조건을 섞지 않는다.
 *
 * <p>밀어내기가 안전한 이유는 <b>확인 메일이 언제나 그 주소의 진짜 소유자에게 가기 때문</b>이다.
 * 선점한 쪽은 확인을 끝낼 수 없고, 소유자가 확인을 끝내는 순간 계정이 잠겨 더는 밀리지 않는다.
 * 즉 이 경쟁은 항상 소유자가 이긴다.
 *
 * <p>남는 것은 선점자가 계속 밀어내 소유자의 확인 링크를 무효로 만드는 방해뿐이다. 얻는 것이
 * 없는 공격이고, 원래 문제(주소가 영구히 잠기는 것)보다 가볍다. 미확인 계정 만료와 가입
 * 요청 제한은 이 문서 범위 밖이며 별도로 다룬다.
 */
@Service
public class UnverifiedAccountReclaimer {

    private static final Logger log = LoggerFactory.getLogger(UnverifiedAccountReclaimer.class);

    private final UserRepository userRepository;

    public UnverifiedAccountReclaimer(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * 확인되지 않은 계정이면 지운다.
     *
     * <p>딸린 세션·토큰·2단계 수단·소속은 DB 의 {@code ON DELETE CASCADE} 가 함께 지운다
     * ({@code V6__user_delete_cascade.sql}). 애플리케이션에서 순서대로 지우지 않는 이유는
     * users 를 참조하는 테이블이 늘 때마다 빠뜨릴 수 있기 때문이다.
     *
     * <p>지운 뒤 {@code flush} 하는 것이 중요하다. Hibernate 의 기본 실행 순서는 INSERT 가
     * DELETE 보다 앞이라, 같은 트랜잭션에서 밀어내고 새로 만들면 DELETE 가 나중에 나가
     * {@code ux_users_email} 위반이 된다. 여기서 먼저 내보내야 순서가 맞는다.
     *
     * <p>호출하는 쪽이 이 트랜잭션의 주인이다. 여기서 {@code @Transactional} 을 새로 열지
     * 않는다 — 밀어내기와 그 자리에 계정을 만드는 일은 하나의 단위여야 하고, 나뉘면 밀어낸
     * 뒤 생성이 실패했을 때 주소만 비워 둔 상태가 남는다.
     *
     * @return 실제로 지웠으면 {@code true}. 확인된 계정이라 그대로 두었으면 {@code false}
     */
    public boolean reclaimIfUnverified(User user) {
        if (user.isEmailVerified()) {
            return false;
        }
        log.info(
                "확인되지 않은 계정 {} 를 밀어낸다. 이 주소로 새 가입 요청이 들어왔다",
                user.getId());
        userRepository.delete(user);
        userRepository.flush();
        return true;
    }
}
