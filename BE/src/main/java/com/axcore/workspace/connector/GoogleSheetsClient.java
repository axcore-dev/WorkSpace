package com.axcore.workspace.connector;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Google Sheets API — 범위 읽기, 행 덧붙이기.
 *
 * <p>시트를 어떻게 찾는가: 이 API 는 id 를 알아야 한다. 사용자가 주소를 붙여 주면 {@link #spreadsheetIdOf} 가
 * id 를 꺼내고, 이름만 알면 Drive 검색(형식을 스프레드시트로 좁혀서)이 id 를 찾는다.
 *
 * <p>덧붙이기는 표의 마지막 행 아래에 붙인다({@code INSERT_ROWS}). 기존 셀을 덮어쓰는 도구는 두지 않았다 —
 * 모델이 어느 셀을 갈아 끼울지 정하게 하면 사고가 난다. 값은 문자열로만 보낸다({@code RAW}) — 수식이 들어가지 않는다.
 */
@Component
public class GoogleSheetsClient {

    private static final String BASE = "https://sheets.googleapis.com/v4/spreadsheets";
    private static final Pattern URL_ID = Pattern.compile("/spreadsheets/d/([a-zA-Z0-9-_]+)");
    private static final int MAX_ROWS = 200;

    private final GoogleApi api;

    public GoogleSheetsClient(GoogleApi api) {
        this.api = api;
    }

    /** 읽은 범위. {@code values} 는 행 배열이고 빈 셀은 빈 문자열이다 */
    public record Range(String spreadsheetId, String range, List<List<String>> values, boolean truncated) {}

    public record Appended(String spreadsheetId, String updatedRange, int updatedRows) {}

    /** 주소든 id 든 받아 id 로. 아무것도 안 맞으면 그대로 돌려준다(그냥 id 라고 본다) */
    public static String spreadsheetIdOf(String idOrUrl) {
        Matcher m = URL_ID.matcher(idOrUrl.trim());
        return m.find() ? m.group(1) : idOrUrl.trim();
    }

    public Range read(String accessToken, String idOrUrl, String range) {
        String id = spreadsheetIdOf(idOrUrl);
        String uri =
                UriComponentsBuilder.fromUriString(BASE + "/{id}/values/{range}")
                        .queryParam("valueRenderOption", "FORMATTED_VALUE")
                        .buildAndExpand(id, range).encode().toUriString();
        ValueRange r =
                api.call("시트 읽기", () ->
                        api.rest().get().uri(uri).header("Authorization", GoogleApi.bearer(accessToken)).retrieve().body(ValueRange.class));
        List<List<String>> rows = r == null || r.values() == null ? List.of() : r.values().stream().map(GoogleSheetsClient::strings).toList();
        boolean truncated = rows.size() > MAX_ROWS;
        return new Range(id, r == null ? range : r.range(), truncated ? rows.subList(0, MAX_ROWS) : rows, truncated);
    }

    public Appended append(String accessToken, String idOrUrl, String range, List<List<String>> rows) {
        String id = spreadsheetIdOf(idOrUrl);
        String uri =
                UriComponentsBuilder.fromUriString(BASE + "/{id}/values/{range}:append")
                        .queryParam("valueInputOption", "RAW")
                        .queryParam("insertDataOption", "INSERT_ROWS")
                        .buildAndExpand(id, range).encode().toUriString();
        Map<String, Object> body = Map.of("range", range, "majorDimension", "ROWS", "values", rows);
        AppendResponse r =
                api.call("시트에 행 추가", () ->
                        api.rest().post().uri(uri).header("Authorization", GoogleApi.bearer(accessToken))
                                .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(AppendResponse.class));
        if (r == null || r.updates() == null) {
            throw new ConnectorProviderException("시트 응답이 비어 있습니다");
        }
        return new Appended(id, r.updates().updatedRange(), r.updates().updatedRows() == null ? rows.size() : r.updates().updatedRows());
    }

    private static List<String> strings(List<Object> row) {
        return row.stream().map(v -> v == null ? "" : String.valueOf(v)).toList();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ValueRange(String range, List<List<Object>> values) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record AppendResponse(Updates updates) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        record Updates(String updatedRange, Integer updatedRows) {}
    }
}
