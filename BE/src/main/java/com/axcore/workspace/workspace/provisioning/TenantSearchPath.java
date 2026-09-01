package com.axcore.workspace.workspace.provisioning;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * 지금 트랜잭션에서 열 테넌트 스키마를 정한다. <b>{@code search_path} 를 건드리는 유일한 곳이다.</b>
 *
 * <h2>왜 {@code SET search_path} 를 직접 쓰지 않는가</h2>
 *
 * <p>두 가지가 다르다.
 *
 * <pre>
 *   SET search_path TO ax_00001          -- 식별자. 바인딩 불가 → 문자열 조립
 *   SELECT set_config('search_path', ?, true)  -- 값. 바인딩 가능
 * </pre>
 *
 * <p>{@code set_config} 는 설정 이름과 값을 <b>text 인자로 받는 함수</b>다. 그래서 값을 바인딩
 * 파라미터로 넘길 수 있고, 애플리케이션에 SQL 을 잇는 자리가 남지 않는다.
 *
 * <p><b>다만 바인딩이 막아 주는 것은 SQL 인젝션까지다.</b> {@code ax_00002} 처럼 형태는 멀쩡한
 * 남의 스키마 이름이 들어오면 바인딩은 그대로 통과시킨다. 즉 이 자리에는 위험이 둘 있다.
 *
 * <ol>
 *   <li><b>SQL 인젝션</b> — {@code set_config} 바인딩이 막는다
 *   <li><b>엉뚱한 테넌트를 여는 것</b> — 바인딩은 못 막는다. 호출부가 소속을 확인해서 넘긴
 *       값이어야 하고({@code user_workspace_memberships}), 여기서는
 *       {@link SchemaName#requireValid} 로 형태만 한 번 더 본다
 * </ol>
 *
 * <h2>왜 트랜잭션 안에서만 부를 수 있는가 — HikariCP</h2>
 *
 * <p>{@code search_path} 는 <b>세션 상태</b>다. HikariCP 는 물리 커넥션을 재사용하므로, 세션
 * 수준으로 설정하고 반납하면 <b>다음 요청이 그 값을 물려받는다.</b> 그 요청은 남의 회사
 * 데이터를 읽게 된다. 멀티테넌트에서 가장 나쁜 종류의 버그다.
 *
 * <p>Hikari 가 반납 때 되돌려 주는 것은 {@code autoCommit} · {@code readOnly} ·
 * {@code transactionIsolation} · {@code catalog} · {@code schema} · {@code networkTimeout} 뿐이다.
 * {@code search_path} 는 그 목록에 없다. {@code connectionInitSql} 도 커넥션을 <b>새로 만들 때</b>
 * 한 번 돌 뿐 반납·대여 때마다 돌지 않는다.
 *
 * <p>그래서 {@code set_config} 의 세 번째 인자를 {@code true}(= {@code is_local})로 준다.
 * <b>이 값은 COMMIT·ROLLBACK 과 함께 저절로 사라진다.</b> 커넥션이 풀로 돌아갈 때는 이미
 * 원래 값으로 돌아와 있으므로 반납 코드를 따로 두지 않아도 되고, 그 반납 코드를 빠뜨려서
 * 새는 경로 자체가 없다.
 *
 * <p>대신 <b>트랜잭션이 없으면 무의미해진다.</b> 트랜잭션 밖에서는 문장 하나하나가 각자
 * 트랜잭션이라 {@code is_local=true} 가 그 한 문장만 살고 사라진다. 즉 스키마를 열어 놓고
 * 이어서 조회하는 것이 불가능하다. 조용히 {@code shared} 를 읽어 빈 결과가 나오는 대신
 * <b>여기서 바로 막는다.</b>
 *
 * <h2>아직 부르는 곳이 없다</h2>
 *
 * <p>회사 선택({@code WorkspaceService#select})은 아직 세션에 기록만 하고 스키마를 열지 않는다.
 * 이 클래스는 그 라우팅이 붙을 때 <b>쓸 수 있는 유일한 경로</b>로 미리 둔 것이다. 라우팅을
 * 만들면서 {@code SET search_path} 를 직접 쓰는 코드가 새로 생기지 않게 하려는 것이 목적이다.
 */
@Component
public class TenantSearchPath {

    private static final Logger log = LoggerFactory.getLogger(TenantSearchPath.class);

    /**
     * 테넌트 스키마 뒤에 {@code shared} 를 둔다.
     *
     * <p>테넌트 테이블이 {@code shared.users} 를 크로스 스키마로 참조하고, 이름이 겹칠 때는
     * 테넌트 것이 이겨야 하므로 순서가 이렇다.
     *
     * <p><b>{@code public} 을 넣지 않는다.</b> 검색 경로에 있으면 그 스키마에 같은 이름의 함수나
     * 테이블을 만들 수 있는 사람이 우리 쿼리가 무엇을 부를지 바꿀 수 있다. 확장 함수가 필요하면
     * {@code public.gen_random_uuid()} 처럼 스키마를 붙여 부른다.
     */
    private static final String SHARED_SUFFIX = ", shared";

    private final JdbcTemplate jdbcTemplate;

    public TenantSearchPath(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * 지금 트랜잭션이 이 회사의 스키마를 보게 한다.
     *
     * <p>호출 시점에 <b>소속 확인이 이미 끝나 있어야 한다.</b> 이 메서드는 형태만 보지 "이
     * 사람이 이 회사에 들어갈 수 있는가" 는 모른다.
     *
     * @param schemaName {@code shared.workspaces.schema_name}
     * @throws IllegalStateException 트랜잭션 밖에서 불렀을 때. 그 경우 설정이 다음 문장까지
     *     살아남지 못해, 열었다고 생각하고 조회하면 조용히 엉뚱한 결과가 나온다
     */
    public void bind(String schemaName) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException(
                    "테넌트 스키마는 트랜잭션 안에서만 열 수 있습니다. "
                            + "트랜잭션 밖에서는 설정이 문장 하나만 살고 사라집니다: "
                            + schemaName);
        }
        String schema = SchemaName.requireValid(schemaName);

        // 세 번째 인자 true = is_local. COMMIT·ROLLBACK 과 함께 사라진다.
        jdbcTemplate.queryForObject(
                "SELECT set_config('search_path', ?, true)",
                String.class,
                schema + SHARED_SUFFIX);

        log.debug("search_path 를 {} 로 열었다. 트랜잭션이 끝나면 되돌아온다", schema);
    }

    /**
     * 지금 커넥션의 {@code search_path}. 누출을 확인할 때 쓴다.
     *
     * <p>트랜잭션이 끝난 뒤 이 값이 테넌트 스키마를 가리키고 있으면 어딘가에서
     * {@code is_local} 없이 설정한 것이다.
     */
    public String current() {
        return jdbcTemplate.queryForObject("SELECT current_setting('search_path')", String.class);
    }
}
