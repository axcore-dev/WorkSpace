package com.axcore.workspace.user.service;

import com.axcore.workspace.oauth.OAuthUserInfo;
import com.axcore.workspace.oauth.exception.SocialEmailUnavailableException;
import com.axcore.workspace.oauth.exception.SocialLinkBlockedException;
import com.axcore.workspace.oauth.client.OAuthClient;
import com.axcore.workspace.user.entity.TokenPurpose;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserIdentity;
import com.axcore.workspace.user.repository.UserIdentityRepository;
import com.axcore.workspace.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * 제공자에서 받은 정보를 우리 계정과 잇는다. 소셜 로그인의 보안 판단이 모두 여기에 있다.
 *
 * <p>다섯 갈래다. 판단에 쓰는 값은 둘뿐이다 — <b>주소를 쥔 계정이 확인됐는가</b>, 그리고
 * <b>제공자가 이 이메일의 소유를 확인해 줬는가</b>.
 *
 * <ol>
 *   <li><b>이미 연결된 소셜 계정</b> — 그 계정으로 로그인한다. 이메일은 보지 않는다.
 *   <li><b>처음 보는 주소</b> — 계정을 새로 만들고 <b>우리 확인 메일을 보낸다</b>.
 *   <li><b>확인된 계정이 쥐고 있음 + 제공자가 확인해 줌</b> — 그 계정에 연결한다.
 *   <li><b>확인된 계정이 쥐고 있음 + 제공자가 확인해 주지 않음</b> — 거절한다. 허용하면 남의
 *       주소를 적어 둔 제공자 계정으로 그 사람의 계정에 들어갈 수 있다.
 *   <li><b>확인되지 않은 계정이 쥐고 있음</b> — 그 계정은 주소를 점유하지 않는다
 *       ({@link UnverifiedAccountReclaimer}). 제공자가 소유를 확인해 줬으면 밀어내고 새로
 *       만들고, 확인해 주지 않았으면 어느 쪽도 주인이라는 증거가 없으므로 거절한다.
 * </ol>
 *
 * <p><b>제공자의 주장({@code info.emailVerified()})은 보안 판단에만 쓴다.</b> 위 3·4·5 번이다 —
 * 남의 계정을 넘겨줄지, 남의 미확인 계정을 밀어낼지. <b>새 계정을 확인 처리할지에는 쓰지 않는다</b>
 * (2번). 소셜로 가입한 사람도 이메일로 가입한 사람과 같은 조건을 통과해야 해서,
 * {@link #createFromSocial} 이 언제나 확인 메일을 보낸다.
 *
 * <p>두 결정을 한 값으로 함께 정하지 않는 이유는 실패의 무게가 다르기 때문이다. 연결을 잘못하면
 * 계정 탈취이고, 확인 메일을 생략하면 소유가 증명되지 않은 주소가 남을 뿐이다. 묶어 두면 무거운
 * 쪽을 열려고 가벼운 쪽까지 같이 꺼진다 — 네이버를 {@code emailVerified=true} 로 올렸을 때
 * 실제로 그렇게 됐다.
 *
 * <p>{@link OAuthClient} 호출과 분리된 별도 빈인 이유는 트랜잭션
 * 경계다. 제공자 왕복은 두 번의 네트워크 호출이고, 그 동안 DB 커넥션을 붙잡고 있으면 제공자가
 * 느려질 때 커넥션 풀이 먼저 마른다. 네트워크는 트랜잭션 밖에서, DB 작업은 여기서 한다.
 */
@Service
public class SocialAccountLinker {

    private static final Logger log = LoggerFactory.getLogger(SocialAccountLinker.class);

    private final UserRepository userRepository;
    private final UserIdentityRepository identityRepository;
    private final VerificationTokenService verificationTokenService;
    private final AccountMailer mailer;
    private final UnverifiedAccountReclaimer reclaimer;

    public SocialAccountLinker(
            UserRepository userRepository,
            UserIdentityRepository identityRepository,
            VerificationTokenService verificationTokenService,
            AccountMailer mailer,
            UnverifiedAccountReclaimer reclaimer) {
        this.userRepository = userRepository;
        this.identityRepository = identityRepository;
        this.verificationTokenService = verificationTokenService;
        this.mailer = mailer;
        this.reclaimer = reclaimer;
    }

    @Transactional
    public User resolve(OAuthUserInfo info, Instant now) {
        Optional<UserIdentity> linked =
                identityRepository.findByProviderAndSubject(
                        info.provider(), info.providerUserId());

        if (linked.isPresent()) {
            return loginWithLinkedIdentity(linked.get(), info);
        }
        if (!info.hasEmail()) {
            throw new SocialEmailUnavailableException(info.provider());
        }
        String email = User.normalizeEmail(info.email());
        Optional<User> holder = userRepository.findByEmail(email);
        if (holder.isEmpty()) {
            return createFromSocial(email, info, now);
        }

        User existing = holder.get();
        if (existing.isEmailVerified()) {
            // 주소의 주인이 정해져 있다. 붙일지 말지는 제공자가 소유를 확인해 줬는지로 갈린다.
            return linkToExisting(existing, info);
        }

        // 여기서부터는 주소를 쥔 계정이 확인되지 않은 계정이다. 그 계정은 이 주소를 점유하지
        // 않는다({@link UnverifiedAccountReclaimer}).
        if (!info.emailVerified()) {
            // 제공자도 소유를 확인해 주지 않았다. 양쪽 다 주인이라는 증거가 없으므로 아무것도
            // 하지 않는다. 여기서 밀어내면 확인되지 않은 계정을 아무나 지울 수 있게 된다.
            log.warn(
                    "확인되지 않은 계정과 확인되지 않은 소셜 이메일이 만났다. 연결하지 않는다."
                            + " provider={} email={}",
                    info.provider().dbValue(),
                    maskEmail(info.email()));
            throw new SocialLinkBlockedException();
        }

        // 제공자가 소유를 확인해 줬다. 이 사람이 주소의 주인이고, 주소를 쥔 미확인 계정은
        // 아니다. 그 계정을 밀어내고 새로 만든다.
        //
        // 연결해서 재사용하지 않는 이유가 있다. 그 계정에 남아 있는 비밀번호는 소유가 증명되지
        // 않은 쪽이 정한 값이다. 붙이기만 하면 남의 주소로 미리 가입해 둔 사람이 그 비밀번호로
        // 계속 들어올 수 있다 — 소셜 로그인이 계정 탈취 경로가 되는 지점이다.
        //
        // 대가로 정상적인 사용자도 비밀번호를 잃는다. 이메일로 가입해 두고 확인 링크를 누르기
        // 전에 소셜로 들어온 경우다. 확인되지 않은 계정에는 회사 데이터가 딸릴 수 없어
        // (SessionIssuer#nextStep) 잃는 것은 비밀번호뿐이고, 비밀번호 재설정으로 다시 설정할 수
        // 있다. 되돌릴 수 없는 쪽은 탈취다.
        reclaimer.reclaimIfUnverified(existing);
        return createFromSocial(email, info, now);
    }

    /**
     * 이미 연결된 계정. 여기서는 이메일을 보지 않는다.
     *
     * <p>제공자 쪽 이메일이 바뀌었어도 같은 사람이다. {@code users.email} 은 <b>건드리지 않는다</b> —
     * 우리 쪽 이메일은 로그인 아이디이고 유니크 제약이 걸려 있어서, 제공자가 알려 준 새 주소가
     * 다른 계정과 겹치면 로그인이 통째로 실패한다. 제공자 이메일 변경을 우리 계정에 반영하는 것은
     * 사용자가 명시적으로 하는 일이어야 한다.
     */
    private User loginWithLinkedIdentity(UserIdentity identity, OAuthUserInfo info) {
        if (info.hasEmail() && !info.email().equals(identity.getEmail())) {
            log.info(
                    "소셜 계정 {} 의 이메일이 변경됐다. 연결 기록만 갱신한다 (계정 {})",
                    identity.getProvider().dbValue(),
                    identity.getUser().getId());
            identity.refreshEmail(info.email());
        }
        return identity.getUser();
    }

    /**
     * 같은 이메일의 기존 계정에 붙인다.
     *
     * <p><b>이미 이메일이 확인된 계정만 받는다.</b> 확인되지 않은 계정은 주소를 점유하지 않아
     * {@link #resolve} 에서 다른 갈래로 빠진다.
     *
     * <p><b>{@code emailVerified} 검사가 이 메서드의 핵심이다.</b> 제공자가 확인해 주지 않은 주소로
     * 연결을 허용하면, 아무 제공자 계정에 남의 주소를 적어 두고 로그인하는 것만으로 그 사람의
     * 계정에 들어갈 수 있다. 소셜 로그인이 계정 탈취 경로로 바뀌는 지점이다.
     */
    private User linkToExisting(User user, OAuthUserInfo info) {
        if (!info.emailVerified()) {
            log.warn(
                    "미확인 이메일로 기존 계정 연결 시도를 거절했다. provider={} email={}",
                    info.provider().dbValue(),
                    maskEmail(info.email()));
            throw new SocialLinkBlockedException();
        }
        // 계정당 제공자 하나라는 제약을 먼저 확인한다. 그냥 저장하면
        // ux_user_identities_user_provider 위반으로 DataIntegrityViolationException 이 나고,
        // 그건 "이미 존재하는 값입니다" 라는 뜻 없는 문구로 나간다.
        if (identityRepository.findByUserIdAndProvider(user.getId(), info.provider()).isPresent()) {
            log.warn(
                    "계정 {} 에 {} 가 이미 다른 식별자로 연결돼 있다",
                    user.getId(),
                    info.provider().dbValue());
            throw new SocialLinkBlockedException();
        }

        identityRepository.save(
                UserIdentity.link(user, info.provider(), info.providerUserId(), info.email()));

        // 확인 처리를 하지 않는다. 이 메서드는 이미 확인된 계정만 받는다 — 확인되지 않은 계정은
        // resolve 에서 밀어내기로 갈라져 여기까지 오지 않는다.

        log.info(
                "기존 계정 {} 에 {} 를 연결했다",
                user.getId(),
                info.provider().dbValue());
        return user;
    }

    /**
     * 처음 보는 사람. 비밀번호 없는 계정을 만든다.
     *
     * <p><b>제공자가 무엇을 말했든 우리가 직접 확인한다.</b> {@code info.emailVerified()} 를 보지
     * 않고 언제나 확인 메일을 보낸다. 이메일로 가입한 사람과 소셜로 가입한 사람이 같은 조건을
     * 통과하게 하려는 것이다 — 그래야 {@code users.email_verified_at} 이 가입 경로와 무관하게
     * 「우리가 소유를 증명한 주소」라는 한 가지 뜻을 갖는다. 청구서와 알림이 실제로 닿는지가
     * 그 값에 걸려 있다.
     *
     * <p>{@code emailVerified} 를 여기서 쓰지 않는 이유를 적어 둔다. 그 값은 <b>제공자의 주장</b>
     * 이고, {@link #resolve} 의 보안 판단 전용이다 — 같은 주소를 쥔 확인된 계정에 자동 연결할지,
     * 주소를 쥔 미확인 계정을 밀어낼지. 두 결정은 실패했을 때의 무게가 다르다. 연결을 잘못하면
     * 남의 계정을 넘겨주는 것이고, 확인 메일을 생략하면 소유가 증명되지 않은 주소가 남을 뿐이다.
     * 한 값으로 둘을 함께 정하면 무거운 쪽을 열려고 가벼운 쪽까지 같이 꺼진다.
     *
     * <p>확인을 마치기 전에는 {@link SessionIssuer#nextStep} 이 회사 선택 앞에서 막으므로 고객사
     * 데이터에 닿지 못한다. 메일을 놓쳐도 갇히지 않는다 — 로그인한 미확인 사용자가
     * {@code POST /api/auth/email/verify-request} 로 다시 받을 수 있다.
     */
    private User createFromSocial(String email, OAuthUserInfo info, Instant now) {
        User user =
                userRepository.save(
                        User.createSocial(email, info.displayName(), info.safeAvatarUrl()));

        // 여기서 보내지 않으면 next=EMAIL_VERIFICATION_REQUIRED 상태로 계정이 만들어지는데 확인
        // 메일은 오지 않아, 사용자가 스스로 빠져나올 수 없는 상태가 된다.
        String token = verificationTokenService.issue(user, TokenPurpose.EMAIL_VERIFICATION, now);
        mailer.sendEmailVerification(user, token, TokenPurpose.EMAIL_VERIFICATION.ttl());

        identityRepository.save(
                UserIdentity.link(user, info.provider(), info.providerUserId(), info.email()));

        log.info(
                "{} 로 계정 {} 를 새로 만들었다. 확인 메일을 보냈다 (제공자 주장={})",
                info.provider().dbValue(),
                user.getId(),
                info.emailVerified());
        return user;
    }

    /** 로그에 주소 전체를 남기지 않는다. */
    private static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
