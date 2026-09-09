package com.axcore.workspace.connector;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

/**
 * Gmail API — 읽기만. 스코프가 {@code gmail.readonly} 라 보내기는 없다.
 *
 * <p>목록은 두 번 부른다. {@code messages.list} 는 id 만 주고, 보낸 사람·제목·날짜·미리보기는 {@code messages.get}
 * 을 메시지마다 한 번씩 불러야 나온다({@code format=metadata}). 그래서 한 번에 최대 20개로 막는다 —
 * 도구 한 번에 구글 호출 21번이 상한이다.
 *
 * <p>본문은 {@code text/plain} 파트만 꺼낸다. HTML 만 있는 메일은 태그를 벗겨 대충 읽을 정도로만 만든다.
 * 첨부는 다루지 않는다. 길이는 잘라서 돌려준다 — 모델 문맥을 메일 한 통이 채우면 안 된다.
 */
@Component
public class GmailClient {

    private static final String BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
    private static final int MAX_LIST = 20;
    private static final int MAX_BODY_CHARS = 12_000;

    private final GoogleApi api;

    public GmailClient(GoogleApi api) {
        this.api = api;
    }

    /** 목록 한 줄. 미리보기는 구글이 만든 첫 문장 요약이다 */
    public record MessageSummary(String id, String threadId, String from, String subject, String date, String snippet) {}

    /** 한 통. 본문은 잘려 있을 수 있다({@code truncated}) */
    public record Message(String id, String from, String to, String subject, String date, String body, boolean truncated) {}

    /**
     * @param query 지메일 검색 문법 그대로. 비어 있으면 최근 순
     * @param newerThanDays 이 일수 안의 메일만. query 에 덧붙인다
     */
    public List<MessageSummary> list(String accessToken, String query, int newerThanDays, int max) {
        String q = ((query == null ? "" : query.trim()) + " newer_than:" + Math.max(1, newerThanDays) + "d").trim();
        String uri =
                UriComponentsBuilder.fromUriString(BASE + "/messages")
                        .queryParam("q", q)
                        .queryParam("maxResults", Math.max(1, Math.min(max, MAX_LIST)))
                        .encode()
                        .toUriString();
        ListResponse page =
                api.call("메일 목록 조회", () ->
                        api.rest().get().uri(uri).header("Authorization", GoogleApi.bearer(accessToken)).retrieve().body(ListResponse.class));
        if (page == null || page.messages() == null) {
            return List.of();
        }
        List<MessageSummary> out = new ArrayList<>();
        for (Ref ref : page.messages()) {
            RawMessage m = get(accessToken, ref.id(), "metadata");
            out.add(new MessageSummary(m.id(), m.threadId(), header(m, "From"), header(m, "Subject"), header(m, "Date"), m.snippet()));
        }
        return out;
    }

    public Message read(String accessToken, String id) {
        RawMessage m = get(accessToken, id, "full");
        String body = extractText(m.payload());
        boolean truncated = body.length() > MAX_BODY_CHARS;
        return new Message(
                m.id(), header(m, "From"), header(m, "To"), header(m, "Subject"), header(m, "Date"),
                truncated ? body.substring(0, MAX_BODY_CHARS) : body, truncated);
    }

    private RawMessage get(String accessToken, String id, String format) {
        String uri =
                UriComponentsBuilder.fromUriString(BASE + "/messages/{id}")
                        .queryParam("format", format)
                        .queryParam("metadataHeaders", "From", "To", "Subject", "Date")
                        .buildAndExpand(id)
                        .encode()
                        .toUriString();
        RawMessage m =
                api.call("메일 읽기", () ->
                        api.rest().get().uri(uri).header("Authorization", GoogleApi.bearer(accessToken)).retrieve().body(RawMessage.class));
        if (m == null) {
            throw new ConnectorProviderException("메일 응답이 비어 있습니다");
        }
        return m;
    }

    private static String header(RawMessage m, String name) {
        if (m.payload() == null || m.payload().headers() == null) {
            return null;
        }
        return m.payload().headers().stream()
                .filter(h -> name.equalsIgnoreCase(h.name()))
                .map(Header::value)
                .findFirst()
                .orElse(null);
    }

    /** text/plain 을 우선, 없으면 text/html 을 벗긴다. 멀티파트는 재귀로 내려간다 */
    private static String extractText(Part part) {
        if (part == null) {
            return "";
        }
        String plain = find(part, "text/plain");
        if (!plain.isBlank()) {
            return plain;
        }
        String html = find(part, "text/html");
        return html.replaceAll("(?is)<(script|style)[^>]*>.*?</\\1>", " ")
                .replaceAll("(?s)<[^>]+>", " ")
                .replaceAll("&nbsp;", " ")
                .replaceAll("[ \\t]{2,}", " ")
                .trim();
    }

    private static String find(Part part, String mime) {
        if (part.mimeType() != null && part.mimeType().toLowerCase(Locale.ROOT).startsWith(mime)
                && part.body() != null && part.body().data() != null) {
            return new String(Base64.getUrlDecoder().decode(part.body().data()), StandardCharsets.UTF_8);
        }
        if (part.parts() != null) {
            for (Part p : part.parts()) {
                String found = find(p, mime);
                if (!found.isBlank()) {
                    return found;
                }
            }
        }
        return "";
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ListResponse(List<Ref> messages) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Ref(String id) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record RawMessage(String id, String threadId, String snippet, Part payload) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Part(String mimeType, List<Header> headers, Body body, List<Part> parts) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Header(String name, String value) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Body(String data) {}
}
