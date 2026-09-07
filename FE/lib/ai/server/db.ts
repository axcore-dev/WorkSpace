/**
 * AI 서버의 PostgreSQL 접근. **테넌트 스키마를 여는 유일한 자리다.**
 *
 * BE 의 `TenantSearchPath` 와 같은 규칙을 따른다.
 *
 * - `SET search_path TO ...` 를 쓰지 않는다. 식별자라 바인딩이 안 돼 문자열을 이어야 한다.
 *   `set_config('search_path', $1, true)` 는 값으로 받아 바인딩된다.
 * - 세 번째 인자 `true`(is_local) 라 COMMIT·ROLLBACK 과 함께 사라진다. 풀에 반납된 커넥션이 다음
 *   요청에 남의 회사 스키마를 물려주는 일이 구조적으로 없다. 그래서 **트랜잭션 안에서만** 연다.
 * - 바인딩이 막는 것은 인젝션까지다. 형태가 멀쩡한 남의 스키마 이름은 통과하므로, 스키마 이름은
 *   BE introspect 가 준 값(`AiPrincipal.schemaName`)만 쓰고 여기서 형태를 한 번 더 본다.
 * - `public` 을 search_path 에 넣지 않는다. pgvector 타입·연산자는 `public.vector` ·
 *   `OPERATOR(public.<=>)` 로 스키마를 붙여 부른다.
 *
 * 접속 정보는 `pg` 가 표준 환경 변수(PGHOST · PGPORT · PGUSER · PGPASSWORD · PGDATABASE)에서 읽는다.
 * URL 로 합치지 않는 이유는 비밀번호에 특수문자가 있으면 인코딩 실수가 나기 때문이다.
 */
import "server-only";
import { Pool, type PoolClient } from "pg";

const SCHEMA_RE = /^ax_[0-9]{5,}$/;

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      // 서버 한 대에 BE 풀과 함께 산다. 크게 잡을 이유가 없다.
      max: Number(process.env.AI_PG_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: "axpoint-ai",
    });
    pool.on("error", (e) => console.error("[ai-db] 풀 오류", e));
  }
  return pool;
}

export type Db = PoolClient;

/**
 * 트랜잭션을 열고 그 안에서 테넌트 스키마를 잡은 뒤 `fn` 을 실행한다. 정상 종료면 COMMIT,
 * 예외면 ROLLBACK 이다. 어느 쪽이든 search_path 는 원래대로 돌아간 채 커넥션이 반납된다.
 */
export async function withTenant<T>(
  schemaName: string,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  if (!SCHEMA_RE.test(schemaName)) {
    throw new Error("허용되지 않는 스키마 이름입니다");
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // 테넌트 뒤에 shared — 테넌트 테이블이 shared.users 를 참조하고, 이름이 겹치면 테넌트가 이긴다.
    await client.query("SELECT set_config('search_path', $1, true)", [
      `${schemaName}, shared`,
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
