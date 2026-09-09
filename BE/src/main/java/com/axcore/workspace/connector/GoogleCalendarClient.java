package com.axcore.workspace.connector;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Google Calendar API — 다가오는 일정 읽기, 일정 등록. 기본 캘린더({@code primary})만 본다.
 *
 * <p>토큰은 인자로 받는다. 누구의 토큰인지, 만료됐는지, 갱신은 언제 하는지는 {@link ConnectorTokenProvider} 의
 * 몫이다 — 이 클래스는 구글 API 의 모양만 안다. 실패 변환은 {@link GoogleApi} 가 한다.
 */
@Component
public class GoogleCalendarClient {

    private static final String EVENTS_URI = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    private final GoogleApi api;

    public GoogleCalendarClient(GoogleApi api) {
        this.api = api;
    }

    /** 화면과 모델이 읽기 좋은 최소 모양. 구글 응답을 그대로 흘리지 않는다 */
    public record Event(String id, String summary, String start, String end, String location, String htmlLink) {}

    public List<Event> listEvents(String accessToken, Instant from, Instant to, int max) {
        String uri =
                UriComponentsBuilder.fromUriString(EVENTS_URI)
                        .queryParam("timeMin", from.toString())
                        .queryParam("timeMax", to.toString())
                        .queryParam("singleEvents", "true")
                        .queryParam("orderBy", "startTime")
                        .queryParam("maxResults", Math.max(1, Math.min(max, 50)))
                        .encode()
                        .toUriString();
        EventList body =
                api.call("일정 조회", () ->
                        api.rest().get().uri(uri).header("Authorization", GoogleApi.bearer(accessToken)).retrieve().body(EventList.class));
        return body == null || body.items() == null ? List.of() : body.items().stream().map(GoogleCalendarClient::toEvent).toList();
    }

    public Event createEvent(String accessToken, String summary, Instant start, Instant end, String description) {
        Map<String, Object> payload =
                Map.of(
                        "summary", summary,
                        "description", description == null ? "" : description,
                        "start", Map.of("dateTime", start.toString()),
                        "end", Map.of("dateTime", end.toString()));
        RawEvent created =
                api.call("일정 등록", () ->
                        api.rest().post().uri(EVENTS_URI).header("Authorization", GoogleApi.bearer(accessToken))
                                .contentType(MediaType.APPLICATION_JSON).body(payload).retrieve().body(RawEvent.class));
        if (created == null) {
            throw new ConnectorProviderException("일정 등록 응답이 비어 있습니다");
        }
        return toEvent(created);
    }

    private static Event toEvent(RawEvent r) {
        return new Event(r.id(), r.summary(), when(r.start()), when(r.end()), r.location(), r.htmlLink());
    }

    /** 종일 일정은 {@code date}, 시간 일정은 {@code dateTime} 에 온다 */
    private static String when(RawEvent.When w) {
        if (w == null) {
            return null;
        }
        return w.dateTime() != null ? w.dateTime() : w.date();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record EventList(List<RawEvent> items) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record RawEvent(String id, String summary, When start, When end, String location, String htmlLink) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        record When(String dateTime, String date) {}
    }
}
