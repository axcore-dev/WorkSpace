package com.axcore.workspace.connector;

import com.axcore.workspace.security.InternalCallerGuard;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.SettingsValidationException;
import com.axcore.workspace.workspace.settings.TenantAccess;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * AI 서버의 도구가 부르는 <b>내부</b> 경로. 제공자 호출은 전부 여기서 한다 — 토큰이 BE 밖으로 나가지 않는다.
 *
 * <p>두 겹으로 증명한다. 사용자 access 토큰(누구를 대신하는가 — 회사와 권한이 여기서 정해진다)과
 * {@code X-Internal-Token}(자기가 우리 서비스인가). 브라우저는 후자를 갖지 않으므로 사람이 직접 두드릴 수 없다.
 * introspect 와 같은 규칙이다.
 *
 * <p>읽기·쓰기를 가르지 않는다. 쓰기 앞의 <b>승인 게이트</b>는 AI 서버의 도구 틀에 있다({@code tools.ts}) — 모델이
 * 쓰기 도구를 부르면 실행하지 않고 승인 카드를 띄우고, 사용자가 승인하면 그때 여기로 온다.
 *
 * <p>경로 첫 마디가 앱 slug 다. 그 앱이 연결돼 있지 않으면 409 CONNECTOR_NOT_CONNECTED 이고, 모델은 그 메시지를
 * 사용자에게 그대로 전한다("Gmail 을 먼저 연결해 주세요"). 앱마다 토큰을 따로 꺼내는 이유가 이것이다 — 구글 계정은
 * 하나지만 "이 앱을 켰는가 · 이 앱의 스코프를 받았는가" 는 앱마다 다르다.
 */
@RestController
@RequestMapping("/api/internal/connectors")
public class InternalConnectorController {

    private final InternalCallerGuard callerGuard;
    private final TenantAccess access;
    private final ConnectorTokenProvider tokens;
    private final GoogleCalendarClient calendar;
    private final GmailClient gmail;
    private final GoogleDriveClient drive;
    private final GoogleSheetsClient sheets;

    public InternalConnectorController(
            InternalCallerGuard callerGuard,
            TenantAccess access,
            ConnectorTokenProvider tokens,
            GoogleCalendarClient calendar,
            GmailClient gmail,
            GoogleDriveClient drive,
            GoogleSheetsClient sheets) {
        this.callerGuard = callerGuard;
        this.access = access;
        this.tokens = tokens;
        this.calendar = calendar;
        this.gmail = gmail;
        this.drive = drive;
        this.sheets = sheets;
    }

    /** 두 겹 인증 뒤 그 앱의 토큰. 모든 경로가 이 한 줄로 시작한다 */
    private String open(Jwt jwt, String internalToken, String slug) {
        callerGuard.require(internalToken);
        access.open(JwtPrincipal.of(jwt));
        return tokens.accessTokenFor(slug, Instant.now());
    }

    // ---------------------------------------------------------------- Google Calendar

    public record ListEventsRequest(Instant from, Instant to, @Min(1) @Max(50) Integer max) {}

    public record CreateEventRequest(
            @NotBlank @Size(max = 200) String summary,
            @NotNull Instant start,
            @NotNull Instant end,
            @Size(max = 2000) String description) {}

    @PostMapping("/googlecalendar/list-events")
    @Transactional
    public List<GoogleCalendarClient.Event> listEvents(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody ListEventsRequest request) {
        String token = open(jwt, internalToken, "googlecalendar");
        Instant from = request.from() == null ? Instant.now() : request.from();
        Instant to = request.to() == null ? from.plusSeconds(7 * 24 * 3600) : request.to();
        return calendar.listEvents(token, from, to, request.max() == null ? 20 : request.max());
    }

    @PostMapping("/googlecalendar/create-event")
    @Transactional
    public GoogleCalendarClient.Event createEvent(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody CreateEventRequest request) {
        if (!request.end().isAfter(request.start())) {
            throw new SettingsValidationException("끝나는 시각이 시작보다 뒤여야 합니다");
        }
        String token = open(jwt, internalToken, "googlecalendar");
        return calendar.createEvent(token, request.summary(), request.start(), request.end(), request.description());
    }

    // ---------------------------------------------------------------- Gmail

    public record ListMailRequest(@Size(max = 300) String query, @Min(1) @Max(365) Integer newerThanDays, @Min(1) @Max(20) Integer max) {}

    public record ReadMailRequest(@NotBlank @Size(max = 64) String id) {}

    @PostMapping("/gmail/list-messages")
    @Transactional
    public List<GmailClient.MessageSummary> listMail(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody ListMailRequest request) {
        String token = open(jwt, internalToken, "gmail");
        return gmail.list(token, request.query(), request.newerThanDays() == null ? 7 : request.newerThanDays(),
                request.max() == null ? 20 : request.max());
    }

    @PostMapping("/gmail/read-message")
    @Transactional
    public GmailClient.Message readMail(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody ReadMailRequest request) {
        return gmail.read(open(jwt, internalToken, "gmail"), request.id());
    }

    // ---------------------------------------------------------------- Google Drive

    public record SearchFilesRequest(@NotBlank @Size(max = 200) String keyword, @Size(max = 100) String mimeType, @Min(1) @Max(25) Integer max) {}

    public record ReadFileRequest(@NotBlank @Size(max = 128) String fileId) {}

    @PostMapping("/googledrive/search-files")
    @Transactional
    public List<GoogleDriveClient.File> searchFiles(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody SearchFilesRequest request) {
        String token = open(jwt, internalToken, "googledrive");
        return drive.search(token, request.keyword(), request.mimeType(), request.max() == null ? 10 : request.max());
    }

    @PostMapping("/googledrive/read-file")
    @Transactional
    public GoogleDriveClient.Content readFile(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody ReadFileRequest request) {
        return drive.read(open(jwt, internalToken, "googledrive"), request.fileId());
    }

    // ---------------------------------------------------------------- Google Sheets

    public record ReadRangeRequest(@NotBlank @Size(max = 300) String spreadsheet, @NotBlank @Size(max = 100) String range) {}

    public record AppendRowsRequest(
            @NotBlank @Size(max = 300) String spreadsheet,
            @NotBlank @Size(max = 100) String range,
            @NotEmpty @Size(max = 100) List<@NotNull List<@Size(max = 2000) String>> rows) {}

    @PostMapping("/googlesheets/read-range")
    @Transactional
    public GoogleSheetsClient.Range readRange(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody ReadRangeRequest request) {
        return sheets.read(open(jwt, internalToken, "googlesheets"), request.spreadsheet(), request.range());
    }

    @PostMapping("/googlesheets/append-rows")
    @Transactional
    public GoogleSheetsClient.Appended appendRows(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(name = "X-Internal-Token", required = false) String internalToken,
            @Valid @RequestBody AppendRowsRequest request) {
        return sheets.append(open(jwt, internalToken, "googlesheets"), request.spreadsheet(), request.range(), request.rows());
    }
}
