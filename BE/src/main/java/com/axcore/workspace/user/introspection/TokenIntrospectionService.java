package com.axcore.workspace.user.introspection;

import com.axcore.workspace.security.AuthProperties;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.service.AuthService;
import com.axcore.workspace.user.service.UserSessionService;
import com.axcore.workspace.workspace.entity.UserWorkspaceMembership;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.repository.UserWorkspaceMembershipRepository;
import com.axcore.workspace.workspace.repository.WorkspaceRepository;
import com.axcore.workspace.workspace.service.WorkspaceAccessDeniedException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;

/**
 * AI 서버를 위한 토큰 판정.
 *
 * <p>일반 API 는 Bearer 필터가 서명·만료만 보고 통과시키고 DB 를 보지 않는다(SecurityConfig 주석).
 * 여기는 다르다. AI 서버는 이 판정 하나로 <b>회사 기밀 문서가 담긴 스키마</b>를 열기 때문에, 요청 시점
 * DB 로 세션이 살아 있는지와 그 회사에 지금도 소속돼 있는지를 확인한다. 회수된 소속으로 access TTL
 * 동안 문서를 계속 검색할 수 있으면 안 된다.
 *
 * <p>소속 판정은 {@code WorkspaceService#select} 와 같은 규칙이다. 서버 운영자는 소속 없이 들어가되
 * 스키마가 없는 회사는 막고, 일반 사용자는 소속과 회사가 모두 살아 있어야 한다.
 */
@Service
public class TokenIntrospectionService {

    private final AuthProperties properties;
    private final AuthService authService;
    private final UserSessionService sessionService;
    private final UserWorkspaceMembershipRepository membershipRepository;
    private final WorkspaceRepository workspaceRepository;
    private final ModuleAccessReader moduleAccess;

    public TokenIntrospectionService(
            AuthProperties properties,
            AuthService authService,
            UserSessionService sessionService,
            UserWorkspaceMembershipRepository membershipRepository,
            WorkspaceRepository workspaceRepository,
            ModuleAccessReader moduleAccess) {
        this.properties = properties;
        this.authService = authService;
        this.sessionService = sessionService;
        this.membershipRepository = membershipRepository;
        this.workspaceRepository = workspaceRepository;
        this.moduleAccess = moduleAccess;
    }

    /**
     * @param internalToken 요청의 {@code X-Internal-Token}. 없으면 null
     * @param tokenExpiresAt 필터가 검증한 access 토큰의 exp
     */
    @Transactional(readOnly = true)
    public IntrospectionResponse introspect(
            String internalToken, JwtPrincipal principal, Instant tokenExpiresAt, Instant now) {
        requireServiceCaller(internalToken);

        User user = authService.requireUser(principal.userId());
        // 폐기된 세션(로그아웃 · 다른 기기에서 끊음)은 여기서 바로 막힌다.
        UserSession session = sessionService.requireActive(user.getId(), principal.sessionId(), now);

        if (principal.workspaceId() == null) {
            throw new IntrospectionRejectedException(
                    HttpStatus.CONFLICT, "WORKSPACE_REQUIRED", "회사를 먼저 선택해 주세요");
        }
        Workspace workspace = resolveWorkspace(user, principal.workspaceId());

        if (workspace.getSchemaName() == null) {
            // 프로비저닝이 끝나기 전. 열 스키마가 없으니 AI 서버가 할 수 있는 일도 없다.
            throw new IntrospectionRejectedException(
                    HttpStatus.CONFLICT, "WORKSPACE_NOT_READY", "회사 공간이 아직 준비되지 않았어요");
        }

        // 마지막에 계산한다 — 테넌트 스키마를 여는 순간부터 이 트랜잭션의 search_path 가 그 회사로 바뀐다.
        // 위의 shared 조회들이 먼저 끝나 있어야 한다(search_path 뒤에 shared 가 붙어 있어 동작은 하지만, 순서를 지킨다).
        List<String> modules =
                moduleAccess.allowedModules(
                        workspace.getSchemaName(), user.getId(), user.isInternalAdmin());

        return new IntrospectionResponse(
                user.getId(),
                session.getId(),
                user.getEmail(),
                user.getName(),
                workspace.getId(),
                workspace.getName(),
                workspace.getSchemaName(),
                modules,
                tokenExpiresAt);
    }

    /**
     * 서비스 간 비밀을 대조한다.
     *
     * <p>비밀이 비어 있으면 <b>전부 거부</b>한다. 열어 두는 기본값은 설정을 잊은 배포에서 introspect 가
     * 익명에게 스키마 이름을 알려 주는 구멍이 된다. 길이가 달라도 {@link MessageDigest#isEqual} 로
     * 비교한다 — 문자열 {@code equals} 는 앞에서부터 다른 자리를 찾는 순간 끝나 시간이 새어 나간다.
     */
    private void requireServiceCaller(String internalToken) {
        String expected = properties.internalToken();
        if (expected == null || expected.isBlank()) {
            throw new IntrospectionRejectedException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "INTROSPECTION_DISABLED",
                    "토큰 검증이 비활성화되어 있습니다. AUTH_INTERNAL_TOKEN 을 확인하세요");
        }
        byte[] given =
                internalToken == null ? new byte[0] : internalToken.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given)) {
            throw new IntrospectionRejectedException(
                    HttpStatus.FORBIDDEN, "FORBIDDEN", "권한이 없습니다");
        }
    }

    private Workspace resolveWorkspace(User user, Long workspaceId) {
        if (user.isInternalAdmin()) {
            // 운영자는 소속 없이 들어간다. 상태로도 막지 않는다 — WorkspaceService#selectAsInternalAdmin
            return workspaceRepository
                    .findById(workspaceId)
                    .orElseThrow(() -> new WorkspaceAccessDeniedException("접근할 수 없는 회사입니다"));
        }
        UserWorkspaceMembership membership =
                membershipRepository
                        .findByUserIdAndWorkspaceIdWithWorkspace(user.getId(), workspaceId)
                        .orElseThrow(() -> new WorkspaceAccessDeniedException("접근할 수 없는 회사입니다"));
        if (!membership.isEnterable()) {
            throw new WorkspaceAccessDeniedException(
                    membership.getStatus().isEnterable()
                            ? "지금 이용할 수 없는 회사입니다"
                            : "이 회사에 대한 접근 권한이 없습니다");
        }
        return membership.getWorkspace();
    }
}
