/**
 * 「AI 로 다듬기」 작업 — 서버가 든다(`shared.ai_refine_jobs`, shared V22).
 *
 * 왜 서버인가: 브라우저 메모리에 두면 새로고침 · 탭 닫기에 사라진다. 행을 만들고 이 프로세스가 개념을 하나씩(동시 3개) 돌리며
 * 끝날 때마다 진행과 결과를 행에 적는다. 화면은 폴링한다. 회사당 행 하나 — 새 작업이 시작되면 그 회사의 끝난 행을 지우고,
 * 검토를 마치면 행을 지운다. 도는 작업이 회사당 하나뿐인 것은 부분 유니크 인덱스가 보장한다.
 *
 * 목록(`listJobs`)은 진행만 싣고 결과(items)는 싣지 않는다 — 배지 · 헤더가 2.5초마다 받는 값이라. 결과는 검토 패널이 한 번 `getJob` 으로.
 * 오래 멈춘 running(서버 재시작)은 읽을 때 SELECT 안에서 failed 로 보인다 — 폴링마다 쓰지 않는다. 실제로 행을 바꾸는 것은 시작할 때뿐.
 *
 * ponytail: 작업은 이 Node 프로세스 안에서 돈다. BE 를 부르는 것이 운영자의 access 토큰(15분)이라 서버 재시작에는 이어지지 않고,
 * 토큰이 끝나면 남은 개념을 돌리지 않고 failed 로 멈춘다. 토큰 없이 BE 를 부를 내부 경로가 생기면 그때 이어 달리기 · 긴 작업이 된다.
 *
 * 권한: 운영 콘솔 기능이라 회사 소속(introspect)이 아니라 <b>서버 운영자</b>인지 본다 — BE `/api/auth/me` 의 internalAdmin. 실제
 * 데이터를 읽고 쓰는 BE 호출은 그 토큰으로 다시 판정된다. 끊긴 세션의 토큰은 BE JWT 필터가 즉시 401 을 낸다(PR #123).
 */
import "server-only";
import { createHash } from "node:crypto";
import type { RefineItem, RefineJob, RefineTarget } from "@/lib/ai/refine-types";
import { withShared } from "./db";
import { beConfig } from "./env";
import { HttpError } from "./http";
import { refineOne } from "./ontology-refine";

const PARALLEL = 3;
/**
 * running 인데 이보다 오래 갱신이 없으면 죽은 작업(서버 재시작)으로 본다. 개념 하나의 최악은 재료 30초 + 모델 60초 + 미리보기 2×30초
 * ≈ 2.5분이고 개념을 시작할 때도 한 번 갱신하므로, 5분이면 살아 있는 작업이 걸릴 일이 없다
 */
const STALE_MS = 5 * 60_000;
const STALE_ERROR = "서버가 다시 시작돼 작업이 멈췄어요. 다시 시도해 주세요";
/** 이보다 토큰 수명이 적게 남으면 다음 개념을 시작하지 않는다 — 개념 하나가 최악 2.5분이다 */
const TOKEN_MARGIN_MS = 3 * 60_000;
const TOKEN_ERROR = "로그인 토큰이 만료돼 멈췄어요. 다시 로그인한 뒤 다시 시도해 주세요";

/* ─────────────────────────── 운영자 판정 ─────────────────────────── */

const ADMIN_CACHE_TTL_MS = 60_000;
const ADMIN_CACHE_MAX = 500;
const adminCache = new Map<string, { userId: string; until: number }>();

/** Bearer 를 BE 에 물어 서버 운영자인지 본다. 폴링이 잦아 60초 캐시(토큰 만료를 넘지 않게) · 상한 · 오래된 것부터 비움 */
export async function requireInternalAdmin(req: Request): Promise<{ token: string; userId: string }> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "UNAUTHORIZED", "인증이 필요합니다");
  const key = createHash("sha256").update(token).digest("hex");
  const hit = adminCache.get(key);
  if (hit && hit.until > Date.now()) return { token, userId: hit.userId };
  adminCache.delete(key);

  const { baseUrl } = beConfig();
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res || res.status === 401) throw new HttpError(401, "UNAUTHORIZED", "인증이 필요합니다");
  if (!res.ok) throw new HttpError(502, "AUTH_UNAVAILABLE", "인증을 확인하지 못했어요");
  const me = (await res.json()) as { id?: string; internalAdmin?: boolean };
  if (!me?.id || me.internalAdmin !== true) throw new HttpError(403, "FORBIDDEN", "운영자만 쓸 수 있어요");

  if (adminCache.size >= ADMIN_CACHE_MAX) {
    const oldest = adminCache.keys().next().value;
    if (oldest !== undefined) adminCache.delete(oldest);
  }
  const exp = tokenExpiry(token);
  adminCache.set(key, { userId: me.id, until: Math.min(Date.now() + ADMIN_CACHE_TTL_MS, exp ?? Infinity) });
  return { token, userId: me.id };
}

/** JWT 의 exp(ms). 검증하지 않는다 — 판정은 BE 가 했고 여기서는 「언제 끝나나」 만 본다. 못 읽으면 null */
function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/* ─────────────────────────── 행 ↔ DTO ─────────────────────────── */

interface Row {
  id: string;
  workspace_id: string | number;
  status: RefineJob["status"];
  structure_only: boolean;
  targets: RefineTarget[];
  done: number;
  current: string[];
  done_ids: number[];
  items: RefineItem[] | null;
  error: string | null;
  updated_at: Date;
}

/** 오래 멈춘 running 은 읽는 자리에서 failed 로 보인다 — 폴링마다 UPDATE 하지 않는다 */
const STALE_CASE = `status = 'running' AND updated_at < now() - ($1 || ' milliseconds')::interval`;
const COLS =
  `id, workspace_id, CASE WHEN ${STALE_CASE} THEN 'failed' ELSE status END AS status, structure_only, targets, done, current, done_ids, ` +
  `CASE WHEN ${STALE_CASE} THEN '${STALE_ERROR}' ELSE error END AS error, updated_at`;

function toJob(r: Row): RefineJob {
  return {
    id: r.id,
    workspaceId: Number(r.workspace_id),
    status: r.status,
    structureOnly: r.structure_only,
    targets: r.targets,
    done: r.done,
    current: r.current,
    doneIds: r.done_ids,
    items: r.items ?? [],
    error: r.error,
    updatedAt: r.updated_at.toISOString(),
  };
}

/** 전부, 결과 없이 — 배지 · 헤더 폴링용. 회사당 한 행이라 많아야 회사 수만큼이다 */
export async function listJobs(): Promise<RefineJob[]> {
  return withShared(async (db) => {
    const { rows } = await db.query<Row>(`SELECT ${COLS}, NULL::jsonb AS items FROM ai_refine_jobs ORDER BY updated_at DESC`, [String(STALE_MS)]);
    return rows.map(toJob);
  });
}

/** 한 건, 결과까지 — 검토 패널이 끝난 작업을 열 때 한 번 */
export async function getJob(id: string): Promise<RefineJob | null> {
  return withShared(async (db) => {
    const { rows } = await db.query<Row>(`SELECT ${COLS}, items FROM ai_refine_jobs WHERE id = $2`, [String(STALE_MS), id]);
    return rows[0] ? toJob(rows[0]) : null;
  });
}

/** 도는 작업은 지우지 않는다(결과를 받을 행이 없어진다). 멈춘 것으로 보이는 running 은 지운다 */
export async function deleteJob(id: string): Promise<boolean> {
  return withShared(async (db) => {
    const r = await db.query(`DELETE FROM ai_refine_jobs WHERE id = $2 AND (status <> 'running' OR ${STALE_CASE})`, [String(STALE_MS), id]);
    return (r.rowCount ?? 0) > 0;
  });
}

/* ─────────────────────────── 시작 · 실행 ─────────────────────────── */

/**
 * 행을 만들고 백그라운드로 돌린다. 이 회사에 도는 작업이 있으면 null(409 로 바꾼다).
 * 끝난 · 멈춘 행은 지우고 시작한다 — 회사당 한 행.
 */
export async function startJob(workspaceId: number, targets: RefineTarget[], structureOnly: boolean, token: string, userId: string): Promise<RefineJob | null> {
  const job = await withShared(async (db) => {
    await db.query(`DELETE FROM ai_refine_jobs WHERE workspace_id = $2 AND (status <> 'running' OR ${STALE_CASE})`, [String(STALE_MS), workspaceId]);
    const { rows } = await db
      .query<Row>(
        `INSERT INTO ai_refine_jobs (workspace_id, created_by, status, structure_only, targets)
         VALUES ($1, $2, 'running', $3, $4) RETURNING id, workspace_id, status, structure_only, targets, done, current, done_ids, items, error, updated_at`,
        [workspaceId, userId, structureOnly, JSON.stringify(targets)],
      )
      .catch((e: unknown) => {
        if (typeof e === "object" && e !== null && (e as { code?: string }).code === "23505") return { rows: [] as Row[] };
        throw e;
      });
    return rows[0] ? toJob(rows[0]) : null;
  });
  if (job) void run(job, token);
  return job;
}

async function run(job: RefineJob, token: string): Promise<void> {
  const running = new Set<string>();
  const results: RefineItem[] = [];
  const exp = tokenExpiry(token);
  let next = 0;
  let done = 0;
  /** 행이 사라졌거나 다른 상태로 바뀌었으면(멈춘 것으로 보고 새 작업을 시작함) 남은 개념을 돌리지 않는다 */
  let stopped: string | null = null;

  const progress = async (item?: RefineItem, doneId?: number) => {
    const r = await withShared((db) =>
      db.query(
        `UPDATE ai_refine_jobs
            SET done = $2, current = $3, done_ids = CASE WHEN $4::int IS NULL THEN done_ids ELSE done_ids || to_jsonb($4::int) END,
                items = CASE WHEN $5::jsonb IS NULL THEN items ELSE items || $5::jsonb END, updated_at = now()
          WHERE id = $1 AND status = 'running'`,
        [job.id, done, JSON.stringify([...running]), doneId ?? null, item ? JSON.stringify([item]) : null],
      ),
    ).catch((e) => {
      console.error("[ai-refine-job] 진행을 적지 못했어요", e);
      return null;
    });
    if (r && (r.rowCount ?? 0) === 0) stopped = "이 작업은 다른 곳에서 끝났어요";
  };
  const finish = (status: "done" | "failed", error: string | null) =>
    withShared((db) =>
      db.query(
        `UPDATE ai_refine_jobs SET status = $2, error = $3, current = '[]', finished_at = now(), updated_at = now()
          WHERE id = $1 AND status = 'running'`,
        [job.id, status, error],
      ),
    ).catch((e) => console.error("[ai-refine-job] 마무리를 적지 못했어요", e));

  const worker = async () => {
    while (!stopped && next < job.targets.length) {
      if (exp !== null && exp - Date.now() < TOKEN_MARGIN_MS) {
        stopped = TOKEN_ERROR;
        break;
      }
      const t = job.targets[next++];
      running.add(t.name);
      await progress();
      const raw = await refineOne(job.workspaceId, t.rowId, job.structureOnly, token);
      const item: RefineItem = { ...raw, conceptId: raw.conceptId || t.conceptId, name: raw.name || t.name };
      results.push(item);
      running.delete(t.name);
      done += 1;
      await progress(item, t.rowId);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(PARALLEL, job.targets.length) }, worker));
    if (stopped) {
      await finish("failed", stopped);
      return;
    }
    const first = results.find((i) => !i.ok);
    if (results.length > 0 && results.every((i) => !i.ok)) {
      // 전부 같은 이유로 실패했다(관리자 아님 · BE 다운) — 「완료」 가 아니라 실패다
      await finish("failed", first && !first.ok ? first.error : "제안을 받지 못했어요");
      return;
    }
    await finish("done", null);
  } catch (e) {
    console.error("[ai-refine-job] 작업 실패", job.id, e);
    await finish("failed", e instanceof Error ? e.message.slice(0, 200) : "작업이 중단됐어요");
  }
}
