package com.axcore.workspace.user.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.axcore.workspace.oauth.OAuthUserInfo;
import com.axcore.workspace.user.entity.AuthProvider;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserIdentity;
import com.axcore.workspace.user.repository.UserIdentityRepository;
import com.axcore.workspace.user.repository.UserRepository;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * 계정 설정에서 소셜 계정을 붙이는 갈래({@link SocialAccountLinker#linkToCurrent})만 본다. DB · Spring 없이 돈다.
 *
 * <p>모킹 라이브러리가 없어 리포지토리는 {@link Proxy} 로 필요한 메서드만 흉내 낸다. 나머지 메서드가 불리면
 * 그 자체가 실패다. 이 갈래가 건드리지 않아야 하는 협력자(메일 · 밀어내기 · 확인 토큰)는 null 이라 불리면 바로 터진다.
 */
class SocialAccountLinkerLinkToCurrentTest {

    private static final UUID ME = UUID.randomUUID();
    private static final UUID OTHER = UUID.randomUUID();

    private final User me = userWithId(ME);
    private final User other = userWithId(OTHER);
    private final List<UserIdentity> saved = new ArrayList<>();
    private final List<UserIdentity> existing = new ArrayList<>();

    private SocialAccountLinker linker() {
        UserRepository users = fake(UserRepository.class, (proxy, m, args) -> {
            if (m.getName().equals("findById")) {
                UUID id = (UUID) args[0];
                return id.equals(ME) ? Optional.of(me) : id.equals(OTHER) ? Optional.of(other) : Optional.empty();
            }
            throw new AssertionError("이 갈래가 부르면 안 되는 메서드: " + m.getName());
        });
        UserIdentityRepository identities = fake(UserIdentityRepository.class, (proxy, m, args) -> {
            switch (m.getName()) {
                case "findByProviderAndSubject" -> {
                    return existing.stream()
                            .filter(i -> i.getProvider() == args[0] && i.getProviderUserId().equals(args[1]))
                            .findFirst();
                }
                case "findByUserIdAndProvider" -> {
                    return existing.stream()
                            .filter(i -> i.getUser().getId().equals(args[0]) && i.getProvider() == args[1])
                            .findFirst();
                }
                case "save" -> {
                    saved.add((UserIdentity) args[0]);
                    return args[0];
                }
                default -> throw new AssertionError("이 갈래가 부르면 안 되는 메서드: " + m.getName());
            }
        });
        // 확인 토큰 · 메일 · 밀어내기는 이 갈래가 절대 부르지 않아야 한다. 클래스라 프록시로 못 만드니 null 로 둔다 —
        // 부르면 NullPointerException 으로 바로 드러난다.
        return new SocialAccountLinker(users, identities, null, null, null);
    }

    @Test
    void 다른_사용자에게_붙은_제공자_계정은_붙이지_않고_그렇다고_알린다() {
        existing.add(UserIdentity.link(other, AuthProvider.GOOGLE, "sub-1", "other@example.com"));

        SocialLinkConflictException e =
                assertThrows(SocialLinkConflictException.class, () -> linker().linkToCurrent(ME, google("sub-1")));

        assertTrue(e.getMessage().contains("이미 다른 사용자 계정에 연결"), e.getMessage());
        assertTrue(saved.isEmpty(), "남의 연결을 가져오거나 새로 만들면 안 된다");
    }

    @Test
    void 같은_제공자가_다른_식별자로_이미_내_계정에_있으면_막는다() {
        existing.add(UserIdentity.link(me, AuthProvider.GOOGLE, "sub-old", "me@example.com"));

        SocialLinkConflictException e =
                assertThrows(SocialLinkConflictException.class, () -> linker().linkToCurrent(ME, google("sub-new")));

        assertTrue(e.getMessage().contains("먼저 해제"), e.getMessage());
        assertTrue(saved.isEmpty());
    }

    @Test
    void 이미_내_계정에_붙은_같은_식별자면_아무_일도_하지_않고_그_연결을_돌려준다() {
        UserIdentity mine = UserIdentity.link(me, AuthProvider.GOOGLE, "sub-1", "me@example.com");
        existing.add(mine);

        UserIdentity result = linker().linkToCurrent(ME, google("sub-1"));

        assertSame(mine, result);
        assertTrue(saved.isEmpty());
    }

    @Test
    void 처음_붙이는_제공자_계정은_이메일_확인_여부와_무관하게_현재_계정에_붙는다() {
        // 제공자가 이메일 소유를 확인해 주지 않았고(false), 주소도 내 계정과 다르다 — 로그인 갈래라면 막히는 조합이다
        OAuthUserInfo unverifiedOtherEmail =
                new OAuthUserInfo(AuthProvider.GOOGLE, "sub-1", "elsewhere@example.com", false, "이름", null);

        UserIdentity result = linker().linkToCurrent(ME, unverifiedOtherEmail);

        assertEquals(1, saved.size());
        assertSame(me, result.getUser());
        assertEquals(AuthProvider.GOOGLE, result.getProvider());
        assertEquals("sub-1", result.getProviderUserId());
        assertEquals("elsewhere@example.com", result.getEmail());
    }

    // ------------------------------------------------------------------ 도구

    private static OAuthUserInfo google(String subject) {
        return new OAuthUserInfo(AuthProvider.GOOGLE, subject, "me@example.com", true, "이름", null);
    }

    @SuppressWarnings("unchecked")
    private static <T> T fake(Class<T> type, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, handler);
    }

    /** JPA 가 채우는 id 를 테스트에서 직접 넣는다. 세터를 두지 않는 엔티티 규칙을 깨지 않으려고 리플렉션을 쓴다. */
    private static User userWithId(UUID id) {
        User user = User.createSocial(id + "@example.com", "사용자", null);
        try {
            Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(user, id);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
        return user;
    }
}
