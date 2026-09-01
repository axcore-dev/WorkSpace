package com.axcore.workspace.workspace.provisioning;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 테넌트 스키마 이름.
 *
 * <p>{@code ax_ + lpad(workspaces.id, 5, '0')} 이다. 회사명은 들어가지 않는다 — PK 가 유일하므로
 * 충돌이 불가능하고, 회사명이 바뀌어도 스키마는 영향받지 않는다.
 * (docs/db/schema-draft-v2.md — "스키마 이름 규칙")
 *
 * <p><b>접두사는 문법상 필수다.</b> PostgreSQL 식별자는 숫자로 시작할 수 없어 {@code 00001} 은
 * 그 자체로 스키마 이름이 될 수 없다.
 *
 * <p><b>5자리를 넘으면 자연 증가한다.</b> {@code lpad} 는 자리수가 넘쳐도 자르지 않으므로 10만
 * 번째 회사는 {@code ax_100000} 이 된다. 사전순 정렬만 어긋나는데, 정렬이 필요하면
 * {@code workspaces.id} 로 한다 — <b>스키마 이름을 정렬 키로 쓰지 않는다.</b>
 *
 * <p>이 클래스가 따로 있는 이유는 검증 때문이다. 스키마 이름은 식별자라 바인딩 파라미터로
 * 넘길 수 없다. 조립이 필요한 두 자리는 DB 함수로 옮겨 {@code format} 의 {@code %I} 가 인용을
 * 대신하게 했고({@code shared.create_tenant_schema} · {@code shared.workspace_comment}),
 * 스키마를 열 때는 {@code set_config('search_path', ?, true)} 로 값으로 넘긴다
 * ({@link TenantSearchPath}). 그래서 애플리케이션에 SQL 을 잇는 자리는 남아 있지 않다.
 *
 * <p><b>그런데도 검증한다.</b> 바인딩이 막아 주는 것은 SQL 인젝션까지다. {@code ax_00002} 처럼
 * 형태가 멀쩡한 남의 스키마 이름은 바인딩을 그대로 통과하고, 그러면 다른 회사 데이터가 열린다.
 * 형태 검증은 그 위험을 줄이는 한 겹이고, "이 사람이 이 회사에 들어갈 수 있는가" 는 호출부가
 * {@code user_workspace_memberships} 로 따로 확인해야 한다.
 *
 * <p>같은 정규식이 세 곳에 있다 — 여기, DB CHECK 제약({@code ck_workspaces_schema_name}),
 * 그리고 위 두 함수 안. 함수가 자기 인자를 다시 보는 이유는 그 함수 자체가 임의의 식별자에
 * DDL 을 실행할 수 있는 도구이기 때문이다.
 */
public final class SchemaName {

    /** DB 의 {@code ck_workspaces_schema_name} 과 같은 식이어야 한다. */
    private static final Pattern PATTERN = Pattern.compile("^ax_[0-9]{5,}$");

    private static final String PREFIX = "ax_";

    private SchemaName() {
        // 유틸리티
    }

    /**
     * 워크스페이스 PK 로 스키마 이름을 만든다.
     *
     * <p>{@link Locale#ROOT} 를 명시하는 이유: 기본 로캘에 따라 {@code %05d} 가 아라비아 숫자가
     * 아닌 자릿수를 낼 수 있다. 그러면 정규식을 통과하지 못하고, 통과하더라도 식별자로 쓸 수
     * 없는 문자열이 된다.
     */
    public static String of(long workspaceId) {
        if (workspaceId <= 0) {
            throw new IllegalArgumentException("워크스페이스 id 는 양수여야 합니다: " + workspaceId);
        }
        return PREFIX + String.format(Locale.ROOT, "%05d", workspaceId);
    }

    /**
     * 조립 직전에 부르는 검증.
     *
     * @return 검증을 통과한 그 값. 호출부가 {@code SchemaName.requireValid(name)} 을 그대로
     *     문자열에 끼워 넣도록 값을 되돌려준다 — 검증과 사용이 한 줄에 붙어 있으면 빠뜨리기 어렵다
     * @throws IllegalArgumentException 형태가 어긋나면. 이 예외가 사용자에게 보이는 일은 없어야
     *     한다. 여기까지 왔다는 것은 우리 데이터가 이미 깨졌다는 뜻이다
     */
    public static String requireValid(String schemaName) {
        if (schemaName == null || !PATTERN.matcher(schemaName).matches()) {
            throw new IllegalArgumentException("허용되지 않는 스키마 이름입니다: " + schemaName);
        }
        return schemaName;
    }
}
