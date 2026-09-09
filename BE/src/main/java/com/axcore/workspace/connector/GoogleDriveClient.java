package com.axcore.workspace.connector;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

/**
 * Google Drive API — 파일 찾기, 문서 본문 읽기. 읽기만.
 *
 * <p>스코프는 {@code drive.readonly} 다. 처음 카탈로그에 적었던 {@code drive.file} 은 "이 앱이 만든 파일" 만 보여서
 * 사용자의 도면·시방서를 찾을 수 없다. 넓은 스코프라 구글이 민감 권한으로 분류하고, 운영 배포 전에는 앱 검증이
 * 필요하다 — 테스트 모드에서는 테스트 사용자에게 바로 동작한다.
 *
 * <p>본문은 텍스트로 뽑을 수 있는 것만 읽는다. 구글 문서는 {@code export}(text/plain), 구글 시트는 CSV,
 * 일반 텍스트·CSV 파일은 그대로. PDF · 이미지 · 오피스 파일은 메타데이터만 돌려준다 — 그 파싱은 AI 문서
 * 업로드 쪽({@code FE/lib/ai/server/extract.ts})이 이미 하고 있고, 여기서 다시 만들 일이 아니다.
 */
@Component
public class GoogleDriveClient {

    private static final String FILES = "https://www.googleapis.com/drive/v3/files";
    private static final String FIELDS = "files(id,name,mimeType,modifiedTime,size,webViewLink,owners(displayName))";
    private static final int MAX_LIST = 25;
    private static final int MAX_TEXT_CHARS = 20_000;

    private static final String DOC = "application/vnd.google-apps.document";
    private static final String SHEET = "application/vnd.google-apps.spreadsheet";

    private final GoogleApi api;

    public GoogleDriveClient(GoogleApi api) {
        this.api = api;
    }

    public record File(String id, String name, String mimeType, String modifiedTime, String owner, String webViewLink) {}

    /** 본문. 텍스트로 읽을 수 없는 형식이면 {@code text} 가 null 이고 {@code note} 가 이유다 */
    public record Content(File file, String text, boolean truncated, String note) {}

    /**
     * 이름 부분일치 + 본문 검색. 휴지통은 뺀다.
     *
     * @param mimeType 구글 시트만 찾고 싶을 때처럼 형식으로 좁힌다. null 이면 전부
     */
    public List<File> search(String accessToken, String keyword, String mimeType, int max) {
        String escaped = keyword.replace("\\", "\\\\").replace("'", "\\'");
        StringBuilder q = new StringBuilder("trashed = false and (name contains '").append(escaped)
                .append("' or fullText contains '").append(escaped).append("')");
        if (mimeType != null && !mimeType.isBlank()) {
            q.append(" and mimeType = '").append(mimeType.replace("'", "")).append("'");
        }
        String uri =
                UriComponentsBuilder.fromUriString(FILES)
                        .queryParam("q", q.toString())
                        .queryParam("fields", FIELDS)
                        .queryParam("pageSize", Math.max(1, Math.min(max, MAX_LIST)))
                        .queryParam("orderBy", "modifiedTime desc")
                        .encode()
                        .toUriString();
        ListResponse r =
                api.call("드라이브 검색", () ->
                        api.rest().get().uri(uri).header("Authorization", GoogleApi.bearer(accessToken)).retrieve().body(ListResponse.class));
        return r == null || r.files() == null ? List.of() : r.files().stream().map(GoogleDriveClient::toFile).toList();
    }

    public Content read(String accessToken, String fileId) {
        String metaUri =
                UriComponentsBuilder.fromUriString(FILES + "/{id}")
                        .queryParam("fields", "id,name,mimeType,modifiedTime,size,webViewLink,owners(displayName)")
                        .buildAndExpand(fileId).encode().toUriString();
        RawFile raw =
                api.call("드라이브 파일 조회", () ->
                        api.rest().get().uri(metaUri).header("Authorization", GoogleApi.bearer(accessToken)).retrieve().body(RawFile.class));
        if (raw == null) {
            throw new ConnectorProviderException("드라이브 파일 응답이 비어 있습니다");
        }
        File file = toFile(raw);
        String mime = raw.mimeType() == null ? "" : raw.mimeType().toLowerCase(Locale.ROOT);

        String uri;
        if (DOC.equals(mime)) {
            uri = FILES + "/" + fileId + "/export?mimeType=text/plain";
        } else if (SHEET.equals(mime)) {
            uri = FILES + "/" + fileId + "/export?mimeType=text/csv";
        } else if (mime.startsWith("text/") || mime.equals("application/json") || mime.equals("text/csv")) {
            uri = FILES + "/" + fileId + "?alt=media";
        } else {
            return new Content(file, null, false, "이 형식은 본문을 텍스트로 읽지 않는다. 링크로 열어 보거나 AI 소스로 올려 달라");
        }
        byte[] bytes =
                api.call("드라이브 본문 읽기", () ->
                        api.rest().get().uri(uri).header("Authorization", GoogleApi.bearer(accessToken)).retrieve().body(byte[].class));
        String text = bytes == null ? "" : new String(bytes, StandardCharsets.UTF_8);
        boolean truncated = text.length() > MAX_TEXT_CHARS;
        return new Content(file, truncated ? text.substring(0, MAX_TEXT_CHARS) : text, truncated, null);
    }

    private static File toFile(RawFile r) {
        String owner = r.owners() == null || r.owners().isEmpty() ? null : r.owners().get(0).displayName();
        return new File(r.id(), r.name(), r.mimeType(), r.modifiedTime(), owner, r.webViewLink());
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ListResponse(List<RawFile> files) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record RawFile(String id, String name, String mimeType, String modifiedTime, String webViewLink, List<Owner> owners) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Owner(String displayName) {}
}
