package com.axcore.workspace.workspace.settings;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * AI 대화가 부를 수 있는 외부 서비스(커넥터)의 카탈로그. <b>{@code FE/data/chat.ts} 의 {@code CONNECTOR_LIB} 와
 * 같은 순서·같은 slug 여야 한다.</b>
 *
 * <p>{@link FeatureCatalog} 와 같은 이유로 코드에 둔다 — 이름 · 설명 · 아이콘이 전부 화면에 있어서 DB 에 두면 두 곳을
 * 맞춰야 한다. DB({@code connected_services})에는 slug 만 저장하고 여기서 검증한다.
 *
 * <p>앱마다 <b>제공자</b>와 <b>필요한 스코프</b>가 붙는다. 토큰은 제공자 단위로 하나({@code connector_accounts})라,
 * 구글 앱 넷은 같은 계정에 스코프만 더한다(구글의 incremental authorization). 앱이 "연결됨" 인 것은
 * 깃발이 서 있고 제공자 계정의 스코프가 이 목록을 덮을 때다.
 *
 * <p>2026-09-08 에 14개에서 6개로 줄였다. 카카오워크 · 네이버웍스 · 잔디 · Teams · Excel · Outlook · 이카운트 · 더존은
 * 파트너 승인이나 API 계약이 앞에 있어 1차에서 뺐다. 다시 넣을 때는 제공자 구현이 함께 와야 한다.
 */
public final class ConnectorCatalog {

    /** 카탈로그 한 줄. {@code scopes} 는 제공자에게 요청하는 값 그대로다. */
    public record App(String slug, String provider, List<String> scopes) {}

    private static final List<App> APPS =
            List.of(
                    new App("slack", "slack", List.of("chat:write", "channels:read")),
                    new App(
                            "googledrive",
                            "google",
                            List.of("https://www.googleapis.com/auth/drive.readonly")),
                    new App(
                            "googlesheets",
                            "google",
                            List.of("https://www.googleapis.com/auth/spreadsheets")),
                    new App("notion", "notion", List.of()),
                    new App(
                            "gmail",
                            "google",
                            List.of("https://www.googleapis.com/auth/gmail.readonly")),
                    new App(
                            "googlecalendar",
                            "google",
                            List.of("https://www.googleapis.com/auth/calendar.events")));

    private static final Map<String, App> BY_SLUG;

    static {
        Map<String, App> m = new LinkedHashMap<>();
        for (App app : APPS) {
            m.put(app.slug(), app);
        }
        BY_SLUG = Map.copyOf(m);
    }

    private ConnectorCatalog() {}

    /** 카탈로그 순서 그대로. 화면 순서다. */
    public static List<String> slugs() {
        return APPS.stream().map(App::slug).toList();
    }

    public static boolean has(String slug) {
        return slug != null && BY_SLUG.containsKey(slug);
    }

    public static Optional<App> app(String slug) {
        return Optional.ofNullable(slug == null ? null : BY_SLUG.get(slug));
    }

    /** 이 제공자를 쓰는 앱 전부. 해제할 때 "같은 계정을 쓰는 다른 앱이 남았는가" 를 본다. */
    public static List<App> appsOf(String provider) {
        return APPS.stream().filter(a -> a.provider().equals(provider)).toList();
    }

    /** 승인된 스코프가 이 앱을 덮는가. 구글 스코프는 URL 이라 문자열 그대로 비교한다. */
    public static boolean covers(Set<String> granted, App app) {
        return granted.containsAll(app.scopes());
    }
}
