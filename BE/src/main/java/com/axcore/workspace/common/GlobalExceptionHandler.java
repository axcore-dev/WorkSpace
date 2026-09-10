package com.axcore.workspace.common;

import com.axcore.workspace.oauth.exception.OAuthExchangeException;
import com.axcore.workspace.oauth.exception.OAuthNotConfiguredException;
import com.axcore.workspace.oauth.exception.SocialEmailUnavailableException;
import com.axcore.workspace.oauth.exception.SocialLinkBlockedException;
import com.axcore.workspace.user.service.DuplicateEmailException;
import com.axcore.workspace.user.service.EmailAlreadyVerifiedException;
import com.axcore.workspace.user.service.MfaStateException;
import com.axcore.workspace.connector.ConnectorNotConnectedException;
import com.axcore.workspace.connector.ConnectorProviderException;
import com.axcore.workspace.connector.ConnectorUnavailableException;
import com.axcore.workspace.storage.StorageUnavailableException;
import com.axcore.workspace.user.service.PasswordNotSetException;
import com.axcore.workspace.user.service.ProfilePhotoService;
import com.axcore.workspace.user.service.SamePasswordException;
import com.axcore.workspace.user.introspection.IntrospectionRejectedException;
import com.axcore.workspace.user.service.LastLoginMethodException;
import com.axcore.workspace.user.service.SessionNotFoundException;
import com.axcore.workspace.user.service.SocialIdentityNotFoundException;
import com.axcore.workspace.workspace.admin.exception.DuplicateBizNumberException;
import com.axcore.workspace.workspace.admin.exception.InternalAdminRequiredException;
import com.axcore.workspace.workspace.admin.exception.InvitationNotFoundException;
import com.axcore.workspace.workspace.admin.exception.WorkspaceNotFoundException;
import com.axcore.workspace.workspace.admin.exception.WorkspaceStateException;
import com.axcore.workspace.workspace.provisioning.TenantProvisioningException;
import com.axcore.workspace.workspace.service.WorkspaceAccessDeniedException;
import com.axcore.workspace.workspace.settings.SettingsConflictException;
import com.axcore.workspace.workspace.settings.SettingsForbiddenException;
import com.axcore.workspace.workspace.settings.SettingsNotFoundException;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import com.axcore.workspace.workspace.settings.WorkspaceNotSelectedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 컨트롤러 밖으로 나온 예외를 한 가지 형태로 바꾼다.
 *
 * <p>필터 단계(만료된 access 토큰 등)에서 나는 실패는 여기까지 오지 않는다. 그쪽은
 * SecurityConfig 의 AuthenticationEntryPoint 가 같은 모양으로 처리한다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 인증 실패는 원인을 구분하지 않고 전부 같은 401 로 나간다. 없는 계정 · 틀린 비밀번호 ·
     * 만료된 refresh · 재사용된 refresh 가 응답으로 구별되면 그 차이 자체가 정보다.
     * (명세 2.1.4)
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthentication(AuthenticationException e) {
        log.debug("인증 실패", e);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ErrorResponse.of("UNAUTHORIZED", safeMessage(e)));
    }

    /**
     * 문구는 호출한 쪽 맥락을 따른다. 로그인 실패에 "다시 로그인해 주세요"가 나오거나 토큰 만료에
     * "비밀번호가 틀렸다"가 나오면 사용자가 엉뚱한 행동을 한다.
     *
     * <p>다만 우리가 만든 예외의 문구만 쓴다. Spring Security 가 직접 던지는 예외의 문구를 그대로
     * 흘리면 계정 잠금 여부 같은 내부 상태가 응답에 실릴 수 있다. 어떤 경우에도 "계정이 없다"와
     * "비밀번호가 틀리다"는 구분되지 않는다. (명세 2.1.4)
     */
    private static String safeMessage(AuthenticationException e) {
        return e instanceof BadCredentialsException && e.getMessage() != null
                ? e.getMessage()
                : "인증 정보가 유효하지 않습니다";
    }

    @ExceptionHandler(DuplicateEmailException.class)
    public ResponseEntity<ErrorResponse> handleDuplicateEmail(DuplicateEmailException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("EMAIL_ALREADY_USED", e.getMessage()));
    }

    /**
     * 계정 설정의 상태 충돌. 전부 409 다.
     *
     * <p>인증 실패와 달리 문구를 그대로 내보낸다. 로그인된 사용자가 자기 설정을 보고 있는
     * 상황이라 감출 정보가 없고, 무엇이 어긋났는지 알려 주지 않으면 화면이 같은 요청을 반복한다.
     */
    @ExceptionHandler({
        MfaStateException.class,
        EmailAlreadyVerifiedException.class,
        SamePasswordException.class,
        PasswordNotSetException.class,
        LastLoginMethodException.class,
        SocialLinkBlockedException.class
    })
    public ResponseEntity<ErrorResponse> handleAccountStateConflict(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("ACCOUNT_STATE_CONFLICT", e.getMessage()));
    }

    /**
     * 제공자가 이메일을 주지 않았다. 400 이다.
     *
     * <p>사용자가 동의 화면에서 이메일 제공을 거절한 결과이므로 사용자가 고칠 수 있다. 문구에
     * 무엇을 해야 하는지 담는다.
     */
    @ExceptionHandler(SocialEmailUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleSocialEmailUnavailable(
            SocialEmailUnavailableException e) {
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of("SOCIAL_EMAIL_UNAVAILABLE", e.getMessage()));
    }

    /**
     * 제공자와의 통신 실패. 401 이다.
     *
     * <p>code 가 이미 쓰였거나 만료됐거나 위조된 경우다. 사용자 입장에서는 "로그인이 안 됐다" 와
     * 같아서 인증 실패로 답한다. 원인은 로그에만 남긴다 — 응답으로 흘리면 제공자 응답을 탐색하는
     * 통로가 된다.
     */
    @ExceptionHandler(OAuthExchangeException.class)
    public ResponseEntity<ErrorResponse> handleOAuthExchange(OAuthExchangeException e) {
        log.warn("소셜 로그인 실패", e);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ErrorResponse.of("SOCIAL_LOGIN_FAILED", "소셜 로그인에 실패했습니다. 다시 시도해 주세요"));
    }

    /**
     * 이 제공자의 자격증명이 서버에 설정되지 않았다. 503 이다.
     *
     * <p>사용자 잘못이 아니므로 4xx 가 아니다. 로그에 남겨 두면 배포에서 환경변수를 빠뜨린 것을
     * 바로 알 수 있다.
     */
    @ExceptionHandler(OAuthNotConfiguredException.class)
    public ResponseEntity<ErrorResponse> handleOAuthNotConfigured(OAuthNotConfiguredException e) {
        log.error("{} 로그인 자격증명이 설정되지 않았다", e.getProvider().dbValue());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(
                        ErrorResponse.of(
                                "SOCIAL_LOGIN_UNAVAILABLE",
                                "현재 이 방식의 로그인을 사용할 수 없습니다"));
    }

    /**
     * 회사 진입 거부. 403 이다.
     *
     * <p>404 로 감추지 않는 이유: 자기 소속 정보이고, "권한이 없다"와 "회사가 정지됐다"가
     * 구분돼야 사용자가 누구에게 문의할지 안다.
     */
    @ExceptionHandler(WorkspaceAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleWorkspaceAccess(WorkspaceAccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse.of("WORKSPACE_ACCESS_DENIED", e.getMessage()));
    }

    /**
     * AI 서버의 토큰 판정({@code POST /api/auth/introspect})이 내리지 못한 경우. 예외가 상태와 코드를
     * 함께 들고 있어 그대로 옮긴다 — 503 설정 누락 · 403 서비스 비밀 불일치 · 409 회사 미선택/미준비.
     */
    @ExceptionHandler(IntrospectionRejectedException.class)
    public ResponseEntity<ErrorResponse> handleIntrospectionRejected(
            IntrospectionRejectedException e) {
        if (e.status().is5xxServerError()) {
            log.error("introspect 비활성: {}", e.getMessage());
        }
        return ResponseEntity.status(e.status()).body(ErrorResponse.of(e.code(), e.getMessage()));
    }

    /**
     * 운영자 전용 API 를 운영자가 아닌 계정이 불렀다. 403 이다.
     *
     * <p>404 로 감추는 편이 API 존재를 숨기지만, 그러면 운영자 화면이 "없는 회사" 와 "권한
     * 없음" 을 구분하지 못한다. 인증된 사용자에게만 나가는 응답이라 403 으로 둔다.
     */
    @ExceptionHandler(InternalAdminRequiredException.class)
    public ResponseEntity<ErrorResponse> handleInternalAdminRequired(
            InternalAdminRequiredException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse.of("FORBIDDEN", e.getMessage()));
    }

    /**
     * 회사에는 들어왔지만 이 설정 작업을 할 직급이 아니다. 403 이다.
     *
     * <p>{@code WORKSPACE_ACCESS_DENIED}(회사 자체에 못 들어감)와 코드를 다르게 둔다. 화면은 이 코드를 받으면
     * 회사 선택으로 보내지 않고, 그 버튼만 잠근 채로 둔다.
     */
    @ExceptionHandler(SettingsForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleSettingsForbidden(SettingsForbiddenException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse.of("FORBIDDEN", e.getMessage()));
    }

    /**
     * 설정 API 를 불렀는데 회사가 아직 정해지지 않았다. 409 다. 코드({@code WORKSPACE_REQUIRED} ·
     * {@code WORKSPACE_NOT_READY})는 introspect 와 같다 — 화면이 두 API 를 한 가지로 다룬다.
     */
    @ExceptionHandler(WorkspaceNotSelectedException.class)
    public ResponseEntity<ErrorResponse> handleWorkspaceNotSelected(WorkspaceNotSelectedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of(e.code(), e.getMessage()));
    }

    /**
     * 지금 상태에서는 할 수 없는 설정 변경(직급이 남은 부서 · 구성원이 있는 직급 · 이미 있는 이름). 409 다.
     * 코드가 경우를 가르므로 화면이 「옮기고 지우기」 같은 다음 할 일을 안내할 수 있다.
     */
    @ExceptionHandler(SettingsConflictException.class)
    public ResponseEntity<ErrorResponse> handleSettingsConflict(SettingsConflictException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of(e.code(), e.getMessage()));
    }

    /** 이 회사에 그런 부서·직급이 없다. 404 다. */
    @ExceptionHandler(SettingsNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleSettingsNotFound(SettingsNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse.of("NOT_FOUND", e.getMessage()));
    }

    /** 올린 파일이 이미지가 아니거나 상한을 넘었다. */
    @ExceptionHandler(ProfilePhotoService.InvalidImageException.class)
    public ResponseEntity<ErrorResponse> handleInvalidImage(
            ProfilePhotoService.InvalidImageException e) {
        return ResponseEntity.badRequest().body(ErrorResponse.of("VALIDATION_FAILED", e.getMessage()));
    }

    /**
     * 서블릿이 먼저 거르는 크기 초과. {@code spring.servlet.multipart.max-file-size} 를 넘으면 컨트롤러까지
     * 오지 않으므로 여기서 같은 문구로 맞춘다 — 사용자에게는 같은 실패다.
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleUploadTooLarge(MaxUploadSizeExceededException e) {
        // 413. HttpStatus.PAYLOAD_TOO_LARGE 는 RFC 9110 에서 이름이 바뀌어 deprecated 다
        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE)
                .body(ErrorResponse.of("VALIDATION_FAILED", "사진은 2MB 까지 올릴 수 있습니다"));
    }

    /**
     * 파일 저장소가 없거나 응답하지 않는다. 설정 누락도 여기로 온다 — 화면에는 "지금은 안 된다" 로 같다.
     * 원인(자격증명·엔드포인트)은 로그에만 남기고 응답에 담지 않는다.
     */
    @ExceptionHandler(StorageUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleStorageUnavailable(StorageUnavailableException e) {
        log.warn("파일 저장소 오류", e);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ErrorResponse.of("STORAGE_UNAVAILABLE", e.getMessage()));
    }

    /** 연동 토큰 키나 제공자 자격증명이 없다. 배포 설정 문제라 503 이다. */
    @ExceptionHandler(ConnectorUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleConnectorUnavailable(ConnectorUnavailableException e) {
        log.error("연동 설정 누락: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ErrorResponse.of("CONNECTOR_UNAVAILABLE", e.getMessage()));
    }

    /** 앱이 연결돼 있지 않거나 토큰을 잃었다. 화면과 AI 도구가 「연결해 주세요」 로 안내한다. */
    @ExceptionHandler(ConnectorNotConnectedException.class)
    public ResponseEntity<ErrorResponse> handleConnectorNotConnected(ConnectorNotConnectedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("CONNECTOR_NOT_CONNECTED", e.getMessage()));
    }

    /** 제공자가 실패를 돌려줬다. 원인은 로그에만 — 응답으로 흘리면 제공자 응답을 탐색하는 통로가 된다. */
    @ExceptionHandler(ConnectorProviderException.class)
    public ResponseEntity<ErrorResponse> handleConnectorProvider(ConnectorProviderException e) {
        log.warn("제공자 호출 실패", e);
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(ErrorResponse.of("CONNECTOR_PROVIDER_FAILED", e.getMessage()));
    }

    /** 설정 값이 카탈로그·규칙에 맞지 않는다. {@code @Valid} 실패와 같은 코드다. */
    @ExceptionHandler(SettingsValidationException.class)
    public ResponseEntity<ErrorResponse> handleSettingsValidation(SettingsValidationException e) {
        return ResponseEntity.badRequest().body(ErrorResponse.of("VALIDATION_FAILED", e.getMessage()));
    }

    /** 없는 워크스페이스. 404 다. */
    @ExceptionHandler(WorkspaceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleWorkspaceNotFound(WorkspaceNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of("WORKSPACE_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(InvitationNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleInvitationNotFound(InvitationNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of("INVITATION_NOT_FOUND", e.getMessage()));
    }

    /**
     * 이미 개설된 사업자번호 · 지금 상태에서 할 수 없는 조작. 둘 다 409 다.
     *
     * <p>요청 자체는 올바른데 대상의 상태가 맞지 않는 경우다. 400 으로 답하면 화면이 입력값을
     * 고치라고 안내하게 되는데, 고칠 입력이 없다.
     */
    @ExceptionHandler({DuplicateBizNumberException.class, WorkspaceStateException.class})
    public ResponseEntity<ErrorResponse> handleWorkspaceConflict(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("WORKSPACE_STATE_CONFLICT", e.getMessage()));
    }

    /**
     * 테넌트 스키마를 만들지 못했다. 500 이다.
     *
     * <p>사용자 입력 문제가 아니라 우리 쪽 실패다. 원인을 응답에 싣지 않는다 — 스키마 이름과
     * DDL 오류가 그대로 드러난다. {@code shared.workspaces} 행은 {@code provisioning} 으로
     * 남아 있으므로 목록에서 찾아 다시 시도할 수 있다.
     */
    @ExceptionHandler(TenantProvisioningException.class)
    public ResponseEntity<ErrorResponse> handleTenantProvisioning(TenantProvisioningException e) {
        log.error("테넌트 프로비저닝 실패", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(
                        ErrorResponse.of(
                                "PROVISIONING_FAILED",
                                "워크스페이스를 개설하지 못했습니다. 목록에서 다시 시도해 주세요"));
    }

    /** 없는 세션과 남의 세션을 구분하지 않는다. 둘 다 404 다. */
    @ExceptionHandler(SessionNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleSessionNotFound(SessionNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of("SESSION_NOT_FOUND", e.getMessage()));
    }

    /** 내 계정에 그 제공자 연동이 없다(모르는 제공자 이름 포함). 404 다. */
    @ExceptionHandler(SocialIdentityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleSocialIdentityNotFound(SocialIdentityNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of("SOCIAL_IDENTITY_NOT_FOUND", e.getMessage()));
    }

    /**
     * 가입 요청이 동시에 들어오면 존재 확인을 통과한 뒤에 유니크 제약에서 걸린다. 사전 검사만으로는
     * 막을 수 없는 경합이라, DB 가 잡아 준 것을 같은 응답으로 옮긴다.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(DataIntegrityViolationException e) {
        log.debug("제약 위반", e);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("CONFLICT", "이미 존재하는 값입니다"));
    }

    /**
     * 본문이 JSON 으로 읽히지 않는 경우. 여기서 잡지 않으면 서블릿이 /error 로 다시 태우고,
     * 그 경로에서 나온 응답이 원래 원인과 무관한 모양으로 바뀐다.
     *
     * <p>파싱 실패 상세는 내보내지 않는다. 어떤 필드를 어떤 타입으로 기대하는지가 그대로 드러난다.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
        log.debug("본문 파싱 실패", e);
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of("MALFORMED_REQUEST", "요청 본문을 읽을 수 없습니다"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : e.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("VALIDATION_FAILED", "입력값을 확인해 주세요", fields));
    }
}
