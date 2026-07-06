import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { chatCompletion, isAiConfigured, type AiChatMessage } from "@/lib/ai";
import { listUpcomingEvents, refreshAccessToken, type GoogleCalendarEvent } from "@/lib/google";

/**
 * AI대화 백엔드 — OPENAI_API_KEY가 설정되면 실제 LLM으로 동작한다.
 * 키가 없으면 501과 함께 데모 모드임을 알려 프론트가 시나리오 응답으로 폴백한다.
 *
 * scenario 지정 시(발주서 제안 · 구글 캘린더 확인) 모델이 추론 단계(trace)와
 * 답변을 구조화 JSON으로 생성하고, 프론트는 이를 실제 추론 과정으로 재생한다.
 * calendar 시나리오는 더미 텍스트가 아니라 Google Calendar API를 실제로 호출한다
 * (연결 안 됐으면 501 대신 428 + connectUrl로 프론트가 연결 버튼을 띄우게 한다).
 *
 * 추후 확장 지점:
 *  - 스트리밍(추론 과정 실시간 표시): OpenAI stream:true + ReadableStream 반환
 *  - 대화 저장: lib/supabase.ts 연동
 */

const VALID_ROLES = new Set(["system", "user", "assistant"]);
const VALID_SCENARIOS = new Set(["purchase-order", "calendar"]);
const VALID_ICONS = new Set(["search", "data", "doc", "calendar", "mail", "app", "model"]);
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 8000;

/** 외부 입력 검증 — 형식이 어긋나면 null */
function parseMessages(body: unknown): AiChatMessage[] | null {
  if (typeof body !== "object" || body === null) return null;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;
  const out: AiChatMessage[] = [];
  for (const m of messages) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (typeof role !== "string" || !VALID_ROLES.has(role)) return null;
    if (typeof content !== "string" || content.length === 0 || content.length > MAX_CONTENT_LENGTH) return null;
    out.push({ role: role as AiChatMessage["role"], content });
  }
  return out;
}

/* ── 발주서 시나리오 컨텍스트 — 실제 OCR·재고 DB 연동 시 이 상수를 조회 결과로 교체 (캘린더는 아래에서 실제 API로 조회) ── */

const COMPANY_CONTEXT = `너는 제조기업 (주)데모컴퍼니의 ERP 'AXpoint'에 내장된 AI 어시스턴트다.
오늘은 2026-07-06(월)이다. 존댓말(~해요/~습니다)로 간결하게 답한다.`;

const PURCHASE_CONTEXT = `[업로드 발주서 OCR 텍스트]
발주서 (PO) · 문서번호 26-0702 · 발행일 2026-07-02
공급처: 대신금속 / 수신: (주)데모컴퍼니 구매자재팀
품목: 황동봉 C3604 Ø12 · 수량 800kg · 단가 9,340원/kg · 금액 7,472,000원
납기: 2026-07-11 · 결제: 월말 마감 익월 30일

[AXpoint 참고 데이터]
- 자재 마스터: MAT-BR-C36 황동봉 C3604 Ø12 · 공급처 대신금속 · 최근 단가 9,340원/kg (보합)
- 재고: 원자재 2창고 현재고 1,120kg · 가용 980kg · 30일 예측 소요 760kg
- 구매 이력: PR-2606-086 황동봉 800kg (대신금속, 7/3 입고 완료)
- 구매 담당: 오세라 팀장 (구매자재팀)`;

/** 장비관리·영업관리 등 AXpoint 자체 더미 데이터 — Google 쪽과 달리 이 ERP 데모의 정상적인 참고 데이터라 유지 */
const AXPOINT_CALENDAR_REFERENCE = `[AXpoint 참고 데이터]
- 장비관리 정비 예측: CNC-07 스핀들 베어링 마모 고장 확률 87% (72시간 내 교체 권고), PRS-02 유압 펌프 열화 64%
- 납기: SO-2606-31 플랜지 커플링 납기 7/6 임박 (프레스 2라인 일시 정지로 지연 리스크)`;

const TRACE_FORMAT = `반드시 아래 형식의 JSON으로만 응답한다(다른 텍스트 금지):
{
  "trace": [ { "icon": "search|data|doc|calendar|mail|app|model", "text": "실제 수행한 추론·확인 단계 (한 문장)", "result": "선택 — 우측 결과 요약 (예: '결과 3건')" } ],
  "summary": "접힘 상태 한 줄 요약 (예: '3개의 도구 사용됨, 구매 관리 확인됨, 캘린더 조회됨')",
  "reply": "사용자에게 보여줄 최종 답변 (2~5문장)",
  "tools": ["사용한 도구 이름"],
  "sources": ["참조한 데이터 소스 이름"]
}
trace는 3~6단계로, 앱 화면 방문 단계는 icon "app"과 "경영지원 > 구매 관리 방문 — ..." 형식으로 쓴다.
Google Calendar를 조회한 단계는 icon "calendar"를 쓴다. 컨텍스트에 없는 수치를 지어내지 않는다.`;

function formatEventTime(iso: string): string {
  if (!iso) return "";
  if (iso.length === 10) return iso; // 종일 일정 (YYYY-MM-DD)
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 실 조회된 Google Calendar 이벤트로 프롬프트 컨텍스트 구성 (지어낸 값 없음) */
function buildCalendarContext(events: GoogleCalendarEvent[]): string {
  if (events.length === 0) {
    return "[Google Calendar 실시간 조회 결과 — primary 캘린더] 이번 주 예정된 일정이 없습니다.";
  }
  const lines = events.map((e) => `- ${formatEventTime(e.start)} ${e.summary}${e.location ? ` (${e.location})` : ""}`);
  return `[Google Calendar 실시간 조회 결과 — primary 캘린더]\n${lines.join("\n")}`;
}

function calendarPrompt(calendarContext: string): string {
  return `${COMPANY_CONTEXT}

사용자가 일정(Google Calendar) 확인을 요청했다. 아래는 방금 Google Calendar API로 실시간 조회한 결과다 — 이 데이터만 근거로 답하고 컨텍스트에 없는 일정을 지어내지 않는다.
이번 주 일정을 요약하고, 정비 예측·납기 리스크와 겹치는 일정이 있으면 짚어준다.

${calendarContext}

${AXPOINT_CALENDAR_REFERENCE}

${TRACE_FORMAT}
trace의 첫 단계는 반드시 icon "calendar"로 "Google Calendar API에서 이번 주 일정을 실시간 조회함" 형태로 쓰고, result에 조회된 일정 건수를 담는다.`;
}

const SCENARIO_PROMPTS: Record<string, string> = {
  "purchase-order": `${COMPANY_CONTEXT}

사용자가 발주서 문서를 업로드하며 반영을 요청했다. 아래 OCR 텍스트와 참고 데이터를 근거로
경영지원 > 구매 관리에 등록할 구매 요청을 제안한다.

${PURCHASE_CONTEXT}

${TRACE_FORMAT}
추가로 "proposal" 키를 포함한다. fields는 아래와 똑같은 구조로 — 라벨 하나당 값 하나씩 담은 **개별 객체 5개**의 배열이다.
label이나 value 안에 "|" 문자를 절대 넣지 않는다(각 필드는 값 하나만 담는다):
{
  "fields": [
    { "label": "공급처", "value": "대신금속" },
    { "label": "품목", "value": "황동봉 C3604 Ø12" },
    { "label": "수량", "value": "800kg" },
    { "label": "단가", "value": "9,340원/kg" },
    { "label": "납기", "value": "2026-07-11" }
  ]
}
reply에는 등록 여부를 묻고, 승인 시 즉시 반영됨을 안내한다. reply 안에 필드 표를 다시 나열하지 않는다(화면에 별도 카드로 이미 표시된다).`,
};

interface TraceStepOut {
  icon?: string;
  text: string;
  result?: string;
}

/** 모델 JSON 출력 검증·정제 — 형식이 어긋나면 null */
function sanitizeScenarioOutput(raw: string): {
  trace: TraceStepOut[];
  summary?: string;
  reply: string;
  tools: string[];
  sources: string[];
  proposal?: { fields: { label: string; value: string }[] };
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.reply !== "string" || !o.reply.trim() || !Array.isArray(o.trace)) return null;

  const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const strList = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 80)).slice(0, 8) : [];

  const trace: TraceStepOut[] = [];
  for (const t of o.trace.slice(0, 8)) {
    if (typeof t !== "object" || t === null) continue;
    const { icon, text, result } = t as Record<string, unknown>;
    const textStr = str(text);
    if (!textStr) continue;
    trace.push({
      icon: typeof icon === "string" && VALID_ICONS.has(icon) ? icon : undefined,
      text: textStr,
      result: str(result, 60),
    });
  }
  if (trace.length === 0) return null;

  let proposal: { fields: { label: string; value: string }[] } | undefined;
  if (typeof o.proposal === "object" && o.proposal !== null) {
    const fieldsRaw = (o.proposal as { fields?: unknown }).fields;
    if (Array.isArray(fieldsRaw)) {
      const fields = fieldsRaw
        .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
        .map((f) => ({ label: str(f.label, 40) ?? "", value: str(f.value, 120) ?? "" }))
        .filter((f) => f.label && f.value && !f.label.includes("|") && !f.value.includes("|"))
        .slice(0, 8);
      // 모델이 필드를 나누지 않고 하나로 뭉쳤을 때(파이프 결합 등)는 깨진 카드보다 답변 텍스트만 보여주는 게 낫다
      if (fields.length >= 2) proposal = { fields };
    }
  }

  return {
    trace,
    summary: str(o.summary, 120),
    reply: o.reply.slice(0, 2000),
    tools: strList(o.tools),
    sources: strList(o.sources),
    proposal,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 JSON 본문입니다." }, { status: 400 });
  }

  const messages = parseMessages(body);
  if (!messages) {
    return NextResponse.json({ error: "messages 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const scenarioRaw = (body as { scenario?: unknown }).scenario;
  if (scenarioRaw !== undefined && (typeof scenarioRaw !== "string" || !VALID_SCENARIOS.has(scenarioRaw))) {
    return NextResponse.json({ error: "scenario 값이 올바르지 않습니다." }, { status: 400 });
  }
  const scenario = scenarioRaw as string | undefined;

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다. 데모 시나리오 응답을 사용하세요.", demo: true },
      { status: 501 },
    );
  }

  try {
    if (scenario === "calendar") {
      const accessToken = await getValidGoogleAccessToken();
      if (!accessToken) {
        return NextResponse.json(
          {
            error: "google_not_connected",
            connectUrl: "/api/google/auth",
            reply: "Google Calendar가 아직 연결되지 않았어요. 아래 버튼으로 연결하면 실제 일정을 확인해드릴게요.",
          },
          { status: 428 },
        );
      }
      let events;
      try {
        events = await listUpcomingEvents(accessToken);
      } catch {
        return NextResponse.json({ error: "Google Calendar 조회에 실패했습니다." }, { status: 502 });
      }
      const raw = await chatCompletion(
        [{ role: "system", content: calendarPrompt(buildCalendarContext(events)) }, ...messages],
        { json: true },
      );
      const out = sanitizeScenarioOutput(raw);
      if (!out) {
        return NextResponse.json({ error: "AI 응답 형식이 올바르지 않습니다." }, { status: 502 });
      }
      return NextResponse.json(out);
    }
    if (scenario) {
      const raw = await chatCompletion(
        [{ role: "system", content: SCENARIO_PROMPTS[scenario] }, ...messages],
        { json: true },
      );
      const out = sanitizeScenarioOutput(raw);
      if (!out) {
        return NextResponse.json({ error: "AI 응답 형식이 올바르지 않습니다." }, { status: 502 });
      }
      return NextResponse.json(out);
    }
    const reply = await chatCompletion([
      { role: "system", content: `${COMPANY_CONTEXT}\n제조 현장 데이터를 근거로 간결하게 답한다.` },
      ...messages,
    ]);
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: "AI 응답 생성에 실패했습니다." }, { status: 502 });
  }
}

/** 쿠키의 액세스 토큰을 반환하고, 만료됐으면 리프레시 토큰으로 갱신한다. 연결 안 됐으면 null */
async function getValidGoogleAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const access = cookieStore.get("google_access_token")?.value;
  if (access) return access;

  const refresh = cookieStore.get("google_refresh_token")?.value;
  if (!refresh) return null;

  try {
    const tokens = await refreshAccessToken(refresh);
    cookieStore.set("google_access_token", tokens.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.max(60, tokens.expires_in - 60),
    });
    return tokens.access_token;
  } catch {
    return null;
  }
}
