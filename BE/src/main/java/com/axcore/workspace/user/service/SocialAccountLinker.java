package com.axcore.workspace.user.service;

import com.axcore.workspace.oauth.OAuthUserInfo;
import com.axcore.workspace.oauth.SocialEmailUnavailableException;
import com.axcore.workspace.oauth.SocialLinkBlockedException;
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
 * <p>세 갈래다.
 *
 * <ol>
 *   <li><b>이미 연결된 소셜 계정</b> — 그 계정으로 로그인한다.
 *   <li><b>같은 이메일의 기존 계정이 있음</b> — 제공자가 이메일 소유를 확인해 준 경우에만 연결한다.
 *   <li><b>처음 보는 사람</b> — 계정을 새로 만든다.
 * </ol>
 *
 * <p>{@link com.axcore.workspace.oauth.OAuthClient} 호출과 분리된 별도 빈인 이유는 트랜잭션
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

    public SocialAccountLinker(
            UserRepository userRepository,
            UserIdentityRepository identityRepository,
            VerificationTokenService verificationTokenService,
            AccountMailer mailer) {
        this.userRepository = userRepository;
        this.identityRepository = identityRepository;
        this.verificationTokenService = verificationTokenService;
        this.mailer = mailer;
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
        return userRepository
                .findByEmail(email)
                .map(existing -> linkToExisting(existing, info, now))
                .orElseGet(() -> createFromSocial(email, info, now));
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
     * <p><b>{@code emailVerified} 검사가 이 메서드의 핵심이다.</b> 제공자가 확인해 주지 않은 주소로
     * 연결을 허용하면, 아무 제공자 계정에 남의 주소를 적어 두고 로그인하는 것만으로 그 사람의
     * 계정에 들어갈 수 있다. 소셜 로그인이 계정 탈취 경로로 바뀌는 지점이다.
     */
    private User linkToExisting(User user, OAuthUserInfo info, Instant now) {
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

        // 제공자가 소유를 확인해 줬으므로 미확인 계정이었다면 함께 확인 처리한다.
        // 비밀번호 재설정 링크를 통과했을 때와 같은 판단이다(PasswordService#reset).
        user.verifyEmail(now);

        log.info(
                "기존 계정 {} 에 {} 를 연결했다",
                user.getId(),
                info.provider().dbValue());
        return user;
    }

    /** 처음 보는 사람. 비밀번호 없는 계정을 만든다. */
    private User createFromSocial(String email, OAuthUserInfo info, Instant now) {
        User user =
                userRepository.save(
                        User.createSocial(email, info.displayName(), info.safeAvatarUrl()));

        if (info.emailVerified()) {
            user.verifyEmail(now);
        } else {
            // 제공자가 확인해 주지 않았으면 우리가 확인해야 한다. 여기서 보내지 않으면
            // next=EMAIL_VERIFICATION_REQUIRED 상태로 계정이 만들어지는데 확인 메일은 오지 않아,
            // 사용자가 스스로 빠져나올 수 없는 상태가 된다.
            String token =
                    verificationTokenService.issue(user, TokenPurpose.EMAIL_VERIFICATION, now);
            mailer.sendEmailVerification(user, token, TokenPurpose.EMAIL_VERIFICATION.ttl());
        }

        identityRepository.save(
                UserIdentity.link(user, info.provider(), info.providerUserId(), info.email()));

        log.info(
                "{} 로 계정 {} 를 새로 만들었다 (이메일 확인={})",
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
