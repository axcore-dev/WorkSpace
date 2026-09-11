package com.axcore.workspace.user.introspection;

import com.axcore.workspace.security.InternalCallerGuard;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.user.entity.User;
import com.axcore.workspace.user.entity.UserSession;
import com.axcore.workspace.user.service.AuthService;
import com.axcore.workspace.user.service.UserSessionService;
import com.axcore.workspace.workspace.entity.Workspace;
import com.axcore.workspace.workspace.settings.TenantAccess;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    private final InternalCallerGuard callerGuard;
    private final AuthService authService;
    private final UserSessionService sessionService;
    private final TenantAccess tenantAccess;
    private final ModuleAccessReader moduleAccess;

    public TokenIntrospectionService(
            InternalCallerGuard callerGuard,
            AuthService authService,
            UserSessionService sessionService,
            TenantAccess tenantAccess,
            ModuleAccessReader moduleAccess) {
        this.callerGuard = callerGuard;
        this.authService = authService;
        this.sessionService = sessionService;
        this.tenantAccess = tenantAccess;
        this.moduleAccess = moduleAccess;
    }

    /**
     * @param internalToken 요청의 {@code X-Internal-Token}. 없으면 null
     * @param tokenExpiresAt 필터가 검증한 access 토큰의 exp
     */
    @Transactional(readOnly = true)
    public IntrospectionResponse introspect(
            String internalToken, JwtPrincipal principal, Instant tokenExpiresAt, Instant now) {
        callerGuard.require(internalToken);

        User user = authService.requireUser(principal.userId());
        // 폐기된 세션(로그아웃 · 다른 기기에서 끊음)은 여기서 바로 막힌다.
        UserSession session = sessionService.requireActive(user.getId(), principal.sessionId(), now);

        if (principal.workspaceId() == null) {
            throw new IntrospectionRejectedException(
                    HttpStatus.CONFLICT, "WORKSPACE_REQUIRED", "회사를 먼저 선택해 주세요");
        }
        // 소속 판정은 설정 API(TenantAccess)와 한 곳을 쓴다 — 규칙이 두 벌로 갈라지지 않게.
        Workspace workspace = tenantAccess.resolveWorkspace(user, principal.workspaceId());

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
        // 탭까지 내려보낸다 — AI 가 업무 데이터를 조회할 때 모듈이 아니라 탭 단위로 걸러야 한다.
        // 「경영지원을 가졌다」 와 「급여 탭을 가졌다」 는 다르고, 급여 API 는 후자만 연다.
        List<String> tabs =
                moduleAccess.allowedTabs(
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
                tabs,
                tokenExpiresAt);
    }

}
