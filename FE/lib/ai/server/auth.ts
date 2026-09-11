/**
 * AI 서버의 인증 — **모든 `/ai/*` 요청은 여기를 통과한다.**
 *
 * 토큰 검증을 여기서 직접 하지 않는다. access 토큰은 BE(Spring)가 HS256 대칭키로 발급하고, 그 키를
 * FE 컨테이너에도 넣으면 FE 서버가 토큰을 위조할 수 있는 주체가 된다. 대신 BE 의
 * `POST /api/auth/introspect` 에 토큰을 그대로 넘겨 판정을 받는다. BE 는 서명·만료뿐 아니라
 * 세션 폐기 여부와 회사 소속까지 요청 시점 DB 로 확인해 준다 — 서명만 보는 일반 API 보다 엄격하다.
 * 회사 기밀 문서를 여는 판정이라 그래야 한다.
 *
 * 서비스 간 호출임을 증명하는 것이 `X-Internal-Token` 이다. BE 는 이 헤더가 맞을 때만 introspect 에
 * 답한다. 클라이언트가 그 엔드포인트를 직접 두드려 스키마 이름 같은 내부 정보를 얻지 못하게 하려는 것이다.
 *
 * 판정 결과는 짧게 캐시한다. 스트리밍 한 턴에 업로드·검색·대화가 연달아 오는데 매번 BE 를 부르면
 * 왕복이 늘 뿐이다. 캐시 수명은 60초와 토큰 만료 중 짧은 쪽이라, 강제 로그아웃이 늦게 반영되는 창은
 * 최대 60초다.
 */
import "server-only";
import { createHash } from "node:crypto";
import { beConfig } from "./env";
import { HttpError } from "./http";

/** BE introspect 응답 = 이 요청의 주체. 스키마 이름은 이 값만 믿는다 */
export interface AiPrincipal {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
  workspaceId: number;
  workspaceName: string;
  /** 테넌트 스키마. `ax_00001` 형태. `withTenant` 가 한 번 더 형태를 본다 */
  schemaName: string;
  /**
   * 이 사용자가 쓸 수 있는 기능(모듈) slug — BE 가 역할·개인 부여로 계산한다. AI 는 이 분야의 자료만 검색하고
   * 이 분야 질문에만 답한다. 비어 있으면 어떤 분야도 열리지 않는다.
   */
  modules: string[];
  /**
   * 쓸 수 있는 <b>기능 탭</b> id — 모듈보다 한 칸 좁다. 경영지원을 가졌다고 급여 탭까지 가진 것은 아니다.
   * 업무 데이터 조회(`data-tools.ts`)가 이 값으로 목록을 거른다. 비어 있으면 조회할 수 있는 것이 없다.
   */
  tabs: string[];
  /** access 토큰 만료. 캐시 상한 */
  tokenExpiresAt: string;
}

const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 2_000;
const INTROSPECT_TIMEOUT_MS = 5_000;
/** BE 의 `SchemaName.PATTERN` 과 같다 */
const SCHEMA_RE = /^ax_[0-9]{5,}$/;

const cache = new Map<string, { principal: AiPrincipal; until: number }>();

function bearer(req: Request): string {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) throw new HttpError(401, "UNAUTHORIZED", "인증이 필요합니다");
  return m[1].trim();
}

/** 토큰 원문을 키로 쓰지 않는다 — 메모리 덤프에 토큰이 그대로 남는 것을 피한다 */
function cacheKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function remember(key: string, principal: AiPrincipal) {
  if (cache.size >= CACHE_MAX) {
    // 가장 오래된 것부터 비운다. Map 은 삽입 순서를 지킨다
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  const exp = Date.parse(principal.tokenExpiresAt);
  const until = Math.min(Date.now() + CACHE_TTL_MS, Number.isNaN(exp) ? Infinity : exp);
  cache.set(key, { principal, until });
}

async function introspect(token: string): Promise<AiPrincipal> {
  const { baseUrl, internalToken } = beConfig();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/auth/introspect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Internal-Token": internalToken,
      },
      signal: AbortSignal.timeout(INTROSPECT_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[ai-auth] BE 인증 서버에 연결하지 못했어요", e);
    throw new HttpError(502, "AUTH_UNAVAILABLE", "인증 서버에 연결하지 못했어요");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { code?: string; message?: string }
      | null;
    // 401·403·409 는 사용자 상황이라 BE 문구를 그대로 올린다. 503 은 서버 설정 문제다.
    if (res.status === 401 || res.status === 403 || res.status === 409) {
      throw new HttpError(
        res.status,
        body?.code ?? "UNAUTHORIZED",
        body?.message ?? "인증이 필요합니다",
      );
    }
    console.error("[ai-auth] introspect 실패", res.status, body?.code);
    throw new HttpError(502, "AUTH_UNAVAILABLE", "인증을 확인하지 못했어요");
  }

  const p = (await res.json()) as AiPrincipal;
  if (!p?.userId || !SCHEMA_RE.test(p.schemaName ?? "") || !Array.isArray(p.modules)) {
    // 여기 걸리면 BE 응답 계약이 깨진 것이다. 사용자에게 보일 일은 없어야 한다.
    console.error("[ai-auth] introspect 응답 형태가 어긋났어요");
    throw new HttpError(502, "AUTH_UNAVAILABLE", "인증을 확인하지 못했어요");
  }
  // slug 는 문자열만, 알 수 없는 값은 버린다 — 검색 쿼리의 배열 파라미터로 그대로 들어간다
  p.modules = p.modules.filter((m): m is string => typeof m === "string" && /^[a-z]{1,30}$/.test(m));
  // 탭은 없으면 빈 목록이다. FE 가 먼저 배포되고 BE 가 아직 옛 버전일 수 있다 — 그때 대화 전체를 502 로 끊는 대신
  // 업무 데이터 조회만 닫는다. 문서 검색은 modules 로 돌아가므로 답변은 계속 나온다
  p.tabs = Array.isArray(p.tabs)
    ? p.tabs.filter((t): t is string => typeof t === "string" && /^[a-z]{1,30}$/.test(t))
    : [];
  return p;
}

/**
 * 요청의 주체를 돌려준다. 실패하면 `HttpError` 를 던지고, 라우트는 그걸 그대로 응답으로 바꾼다.
 */
export async function authenticate(req: Request): Promise<AiPrincipal> {
  const token = bearer(req);
  const key = cacheKey(token);
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.principal;
  cache.delete(key);

  const principal = await introspect(token);
  remember(key, principal);
  return principal;
}
