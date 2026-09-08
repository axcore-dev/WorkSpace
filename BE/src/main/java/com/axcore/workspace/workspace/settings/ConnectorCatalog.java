package com.axcore.workspace.workspace.settings;

import java.util.List;
import java.util.Set;

/**
 * AI 대화가 부를 수 있는 외부 서비스(커넥터)의 카탈로그. <b>{@code FE/data/chat.ts} 의 {@code CONNECTOR_LIB} 와
 * 같은 순서·같은 slug 여야 한다.</b>
 *
 * <p>{@link FeatureCatalog} 와 같은 이유로 코드에 둔다 — 이름 · 설명 · 아이콘 · 로그인 주소가 전부 화면에 있어서
 * DB 에 두면 두 곳을 맞춰야 한다. DB({@code connected_services})에는 slug 만 저장하고 여기서 검증한다.
 *
 * <p>기본값은 "연결 안 함" 이다. 회사를 새로 열 때 심는 데이터가 없다.
 */
public final class ConnectorCatalog {

    private static final List<String> SLUGS =
            List.of(
                    "slack",
                    "kakaowork",
                    "naverworks",
                    "jandi",
                    "teams",
                    "googledrive",
                    "googlesheets",
                    "excel",
                    "notion",
                    "gmail",
                    "googlecalendar",
                    "outlook",
                    "ecount",
                    "douzone");

    private static final Set<String> BY_SLUG = Set.copyOf(SLUGS);

    private ConnectorCatalog() {}

    /** 카탈로그 순서 그대로. 화면 순서다. */
    public static List<String> slugs() {
        return SLUGS;
    }

    public static boolean has(String slug) {
        return slug != null && BY_SLUG.contains(slug);
    }
}
