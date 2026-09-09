/**
 * AI 서버 라우트의 오류 응답. BE(Spring)의 `ErrorResponse { code, message }` 와 같은 모양이라
 * 화면의 `ApiRequestError` 가 출처를 가리지 않고 처리한다.
 */
import "server-only";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ code, message }, { status });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 경로의 id 를 확인한다. 우리 id 는 전부 UUID 라 형태가 아니면 조회할 것도 없다 — DB 에 가지 않고 404 다.
 * 있는지 없는지가 아니라 **형태만** 본다. 실제 소유 여부는 각 라우트가 테넌트 안에서 다시 확인한다.
 */
export function requireUuid(id: string, notFound: string): string {
  if (!UUID_RE.test(id)) throw new HttpError(404, "NOT_FOUND", notFound);
  return id;
}

/**
 * 라우트 본문을 감싼다. `HttpError` 는 그대로 응답이 되고, 그 밖의 예외는 500 으로 뭉개되 로그에는
 * 원인을 남긴다. 스택이나 내부 메시지를 응답에 싣지 않는다.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return jsonError(e.status, e.code, e.message);
    console.error("[ai] 처리 실패", e);
    return jsonError(500, "INTERNAL_ERROR", "요청을 처리하지 못했어요");
  }
}
