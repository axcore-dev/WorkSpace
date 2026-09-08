package com.axcore.workspace.workspace.settings;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 핵심 기능(모듈)과 그 하위 탭의 카탈로그. <b>{@code FE/data/modules.ts} 와 같은 순서·같은 값이어야 한다.</b>
 *
 * <p>카탈로그를 DB 가 아니라 코드에 두기로 했다. 화면 구성({@code FE/data/pages/*.ts})이 코드에 있어서 DB 에
 * 두면 두 곳을 맞춰야 하고, 어긋나면 "DB 에는 있는데 화면이 없는 탭" 이 생긴다. 대신 DB 에는 slug 만 저장하고,
 * 이 목록으로 검증해 알려진 값만 통과시킨다 — 테넌트 테이블에 엉뚱한 slug 가 들어 있어도 여기서 걸러진다.
 *
 * <p>기본 ON 집합도 여기 있다. {@code enabled_features} 에 행이 없는 탭은 이 값을 따른다.
 * 화면의 {@code DEFAULT_ON_MODULES}(management · inventory · sales)와 같다.
 */
public final class FeatureCatalog {

    /** 모듈 하나. 탭 순서는 화면 순서다. */
    public record Module(String slug, String name, List<String> tabs) {}

    private static final List<Module> MODULES =
            List.of(
                    new Module("management", "경영지원", List.of("hr", "payroll", "materials", "accounting")),
                    new Module("design", "제품설계", List.of("drawings", "specs", "bom")),
                    new Module("production", "생산관리", List.of("monitoring", "workorders", "bottleneck", "reporting")),
                    new Module("equipment", "장비관리", List.of("predict", "maintenance")),
                    new Module("quality", "품질검사", List.of("defects", "control")),
                    new Module(
                            "inventory",
                            "재고·물류",
                            List.of("items", "stock", "safety", "receiving", "movements", "purchasing")),
                    new Module("sales", "영업관리", List.of("orders", "forecast", "quotes")),
                    new Module("support", "고객지원", List.of("tickets", "tracking", "voc")));

    /** 회사를 처음 열었을 때 켜져 있는 모듈. 나머지는 꺼진 채 시작한다. */
    private static final Set<String> DEFAULT_ON = Set.of("management", "inventory", "sales");

    private static final Map<String, Module> BY_SLUG;

    static {
        Map<String, Module> m = new LinkedHashMap<>();
        for (Module module : MODULES) {
            m.put(module.slug(), module);
        }
        BY_SLUG = Map.copyOf(m);
    }

    private FeatureCatalog() {}

    public static List<Module> modules() {
        return MODULES;
    }

    /** 모듈 slug 만, 화면 순서대로. */
    public static List<String> moduleSlugs() {
        return MODULES.stream().map(Module::slug).toList();
    }

    public static Optional<Module> module(String slug) {
        return Optional.ofNullable(BY_SLUG.get(slug));
    }

    public static boolean isKnownModule(String slug) {
        return BY_SLUG.containsKey(slug);
    }

    /** 이 모듈의 탭이 행 없이 기본으로 켜져 있는가. */
    public static boolean defaultEnabled(String moduleSlug) {
        return DEFAULT_ON.contains(moduleSlug);
    }
}
