/**
 * 오류 본문 읽기 검증. 실행: cd FE && npm test
 *
 * 지키려는 것: **오류 응답이 JSON 이 아니어도 상태 코드가 살아남는다.** 매핑 없는 경로에 Spring 이
 * 돌려주는 오류 페이지와 nginx 의 502 페이지가 HTML 이라, 여기서 터지면 화면은 「아직 없는 API(404)」와
 * 「서버가 죽었다」를 구분하지 못한다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { apiRequestError, readBody } from "./api.ts";

const res = (status: number, body: string, type = "text/html") =>
  new Response(body, { status, headers: { "Content-Type": type } });

test("오류 본문이 HTML 이면 본문만 버리고 상태 코드는 남긴다", async () => {
  const parsed = await readBody(res(404, "<html><body>Whitelabel Error Page</body></html>"));
  assert.equal(parsed, null);

  const err = apiRequestError(404, parsed);
  assert.equal(err.status, 404, "404 라는 사실이 살아 있어야 데모 폴백이 켜진다");
});

test("오류 본문이 JSON 이면 그대로 쓴다", async () => {
  const parsed = await readBody(res(403, JSON.stringify({ code: "FORBIDDEN", message: "권한이 없어요" }), "application/json"));
  const err = apiRequestError(403, parsed);
  assert.equal(err.status, 403);
  assert.equal(err.body.message, "권한이 없어요");
});

test("본문이 비면 null — 204 가 그렇다", async () => {
  assert.equal(await readBody(new Response(null, { status: 204 })), null);
});

test("성공 응답이 JSON 이 아니면 감추지 않고 터뜨린다", async () => {
  await assert.rejects(() => readBody(res(200, "<html>프록시가 가로챈 응답</html>")));
});
