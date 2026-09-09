"use client";

/**
 * 턴 엔진 — 전송 · 편집 · 다시 시도 · 평가 · 제안 승인 · 도구 승인이 모두 여기로 모인다.
 *
 * `useChat` 은 **진행 중인 턴 하나만** 든다. 답변이 끝나면 대화 저장소(`use-conversations.ts`)로 옮기고 다음
 * 턴 시작에 비운다. 히스토리를 훅에 쌓아 두지 않는 이유: transport 가 마지막 사용자 메시지만 보내고
 * 히스토리는 서버가 자기 저장본에서 읽는다(클라이언트가 이전 턴을 위조할 수 없게).
 *
 * 화면에 그릴 "작업 중" 모양(`pending`)은 `useChat` 의 파트에서 그때그때 파생한다 — 별도 state 에 또 쌓으면
 * 두 벌이 어긋난다.
 */
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { rateMessage } from "@/lib/ai/conversations";
import { createChatTransport, type TurnContext } from "@/lib/ai/transport";
import { toChatMessage, turnOf, type AxpUIMessage } from "@/lib/ai/ui-messages";
import { ApiRequestError } from "@/lib/api";
import type { TraceStep } from "@/data/chat";
import type { Notebooks } from "./use-conversations";

/**
 * 한 턴의 내용 — 질문 · 제안 승인 · 도구 승인. 다시 시도는 같은 턴을 그대로 다시 보낸다.
 * 소스·스킬까지 턴에 담는 이유: 전송 직후 스킬 칩을 비우므로, 담아 두지 않으면 재시도가 스킬 없이 나간다.
 */
export type Turn = { message: string } & Omit<TurnContext, "conversationId">;

/** 실패 한 건 — 대화 영역에 문구와 다시 시도로 뜬다. 턴 실패는 그 대화에서만, 나머지는 어디서나 보인다 */
export type Failure = { text: string } & (
  | {
      kind: "turn";
      noteId: string;
      turn: Turn;
      /** 성공 뒤에 해야 할 일 — 제안 승인처럼 답변만으로 끝나지 않는 턴이 쓴다 */
      after?: () => void;
    }
  | { kind: "notice"; files: File[] }
);

/** 답변 생성 중 상태 — 한 번에 한 대화만 */
export interface Pending {
  noteId: string;
  rows: TraceStep[];
  /** 헤더에 흐르는 추론 문구 */
  label: string;
  /** 지금까지 받은 본문 조각 — 답변이 굳기 전에 그대로 보여준다 */
  draft: string;
}

const FIRST_LABEL = "질문의 의도를 파악하고 있어요";

export interface AiChat {
  pending: Pending | null;
  /** 방금 답변이 붙은 대화 id — 그 답변의 트레이스가 펼친 상태로 마운트해 접히는 전환을 재생한다 */
  justArrived: string | null;
  /** 한 턴을 그대로 다시 보낸다 — 실패 문구의 '다시 시도' */
  respond: (nid: string, turn: Turn, after?: () => void) => void;
  /** 질문 전송. 대화가 없으면 만든다. 나갔으면 true — 화면이 스킬 칩을 비운다 */
  send: (text: string) => Promise<boolean>;
  editUser: (noteId: string, idx: number, text: string) => void;
  retry: (noteId: string, aiIdx: number) => void;
  rate: (noteId: string, idx: number, r: "up" | "down") => void;
  resolveOcr: (noteId: string, idx: number, approved: boolean) => void;
  decideApproval: (noteId: string, idx: number, approvalId: string, approved: boolean) => void;
}

export function useAiChat(opts: {
  nb: Notebooks;
  /** 이 턴에 함께 보낼 화면 상태 */
  turnContext: { sources: string[]; skills: string[]; apps: string[] };
  setError: (f: Failure | null) => void;
}): AiChat {
  const { nb, turnContext, setError } = opts;
  /**
   * 지금 보내고 있는 턴. 스트림이 끝났을 때 어느 대화에 답변을 붙일지 알아야 해서 들고 있다.
   * ref 인 이유: 값이 바뀌었다고 다시 그릴 것이 없고, 콜백이 그 시점에 읽어야 한다.
   */
  const turnRef = useRef<{ nid: string; turn: Turn; after?: () => void } | null>(null);
  /**
   * 진행 중인 답변이 붙을 대화 id. `turnRef` 와 같은 값이지만 이쪽은 state 다 — 렌더가 이 값을 보고 작업 중
   * 표시를 그리는데 ref 는 바뀌어도 다시 그리지 않는다.
   */
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [justArrived, setJustArrived] = useState<string | null>(null);
  /**
   * 전송 계층은 마운트 때 한 번만 만든다. `useChat` 이 지연 참조해서 끊기진 않지만 매 렌더 새로 만들 이유가
   * 없다. 턴마다 달라지는 값은 `sendMessage` 의 `body` 로 넘긴다.
   */
  const [transport] = useState(createChatTransport);

  const chat = useChat<AxpUIMessage>({
    transport,
    onFinish: ({ message, isAbort, isError }) => {
      const t = turnRef.current;
      if (!t || isAbort || isError) return;
      const saved = turnOf(message);
      const ai = toChatMessage(message);
      nb.setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== t.nid) return n;
          // 방금 보낸 사용자 메시지(순번 없음)에 서버 순번을 매기고, 첫 질문이면 제목을 받는다
          const messages = n.messages.map((m, i) =>
            i === n.messages.length - 1 && m.role === "user" && m.seq === undefined && saved
              ? { ...m, seq: saved.userSeq }
              : m,
          );
          return {
            ...n,
            title: saved?.title ?? n.title,
            messages: [...messages, { ...ai, seq: saved?.assistantSeq ?? ai.seq }],
          };
        }),
      );
      setJustArrived(t.nid);
      // 접히는 전환(300ms)이 끝나면 신호를 내린다 — 대화를 다시 열 때 또 접히지 않게
      setTimeout(() => setJustArrived((n) => (n === t.nid ? null : n)), 400);
      t.after?.();
      clearTurn();
    },
    onError: (e) => {
      const t = turnRef.current;
      if (!t) return;
      // 서버가 사용자 메시지를 이미 저장했다면(data-turn 도착) 재시도는 그 자리를 덮어써야 두 번 쌓이지 않는다
      const saved = chat.messages.findLast((m) => m.role === "assistant");
      const seq = saved ? turnOf(saved)?.userSeq : undefined;
      setError({
        kind: "turn",
        noteId: t.nid,
        turn: seq ? { ...t.turn, replaceFromSeq: seq } : t.turn,
        after: t.after,
        text: e instanceof ApiRequestError ? e.message : "답변을 받지 못했어요",
      });
      clearTurn();
    },
  });

  function clearTurn() {
    turnRef.current = null;
    setPendingNoteId(null);
  }

  const busy = chat.status === "submitted" || chat.status === "streaming";
  const live = busy ? chat.messages.findLast((m) => m.role === "assistant") : undefined;
  const liveMsg = live ? toChatMessage(live) : null;
  const pending: Pending | null =
    busy && pendingNoteId !== null
      ? {
          noteId: pendingNoteId,
          rows: liveMsg?.process?.trace ?? [],
          label: liveMsg?.reasoning?.at(-1) ?? FIRST_LABEL,
          draft: liveMsg?.text ?? "",
        }
      : null;

  // 페이지를 떠나면 스트림을 끊는다. 답변이 붙지 않은 사용자 메시지는 복귀 시 '다시 시도'로 이어진다
  const stopRef = useRef(chat.stop);
  useEffect(() => {
    stopRef.current = chat.stop;
  }, [chat.stop]);
  useEffect(() => () => void stopRef.current(), []);

  /** 한 턴을 보낸다. 결과는 `onFinish`/`onError` 로 돌아온다. **직전 턴을 비우고 시작한다** */
  function respond(nid: string, turn: Turn, after?: () => void) {
    setError(null);
    chat.clearError();
    chat.setMessages([]);
    turnRef.current = { nid, turn, after };
    setPendingNoteId(nid);
    const body: TurnContext = {
      conversationId: nid,
      sources: turn.sources,
      skills: turn.skills,
      apps: turn.apps,
      replaceFromSeq: turn.replaceFromSeq,
      action: turn.action,
    };
    void chat.sendMessage({ text: turn.message }, { body });
  }

  /** 이번 턴에 실을 화면 상태 — 호출 시점 값을 쓴다 */
  const ctx = () => ({ ...turnContext });

  async function send(text: string): Promise<boolean> {
    if (pending) return false;
    let nid = nb.activeId;
    if (!nid) {
      try {
        nid = await nb.create();
      } catch (e) {
        setError({
          kind: "notice",
          files: [],
          text: e instanceof ApiRequestError ? e.message : "새 대화를 만들지 못했어요",
        });
        return false;
      }
    }
    nb.appendMessage(nid, { role: "user", text });
    respond(nid, { message: text, ...ctx() });
    return true;
  }

  /** 사용자 메시지 제자리 편집 — 그 뒤 답변을 버리고 다시 생성한다 */
  function editUser(noteId: string, idx: number, text: string) {
    const old = nb.notes.find((n) => n.id === noteId)?.messages[idx];
    if (!old || pending) return;
    nb.truncate(noteId, idx);
    nb.appendMessage(noteId, { role: "user", text });
    respond(noteId, { message: text, ...ctx(), replaceFromSeq: old.seq });
  }

  /** 답변 다시 시도 — 바로 앞 사용자 메시지로 다시 답한다 */
  function retry(noteId: string, aiIdx: number) {
    const u = nb.notes.find((n) => n.id === noteId)?.messages[aiIdx - 1];
    if (!u || u.role !== "user" || pending) return;
    nb.truncate(noteId, aiIdx - 1);
    nb.appendMessage(noteId, { role: "user", text: u.text });
    respond(noteId, { message: u.text, ...ctx(), replaceFromSeq: u.seq });
  }

  /** 응답 평가 — 같은 걸 다시 누르면 해제. 서버에 남겨 답변 품질 지표로 쓴다 */
  function rate(noteId: string, idx: number, r: "up" | "down") {
    const m = nb.notes.find((n) => n.id === noteId)?.messages[idx];
    if (!m) return;
    const next = m.rating === r ? undefined : r;
    nb.updateMessage(noteId, idx, { rating: next });
    if (m.seq) void rateMessage(noteId, m.seq, next ?? null).catch(() => undefined);
  }

  /**
   * 발주서 제안 승인/취소 — 승인은 서버에 반영을 요청하고 답이 오면 카드를 resolved 로 굳힌다(실패하면 버튼이
   * 남아 다시 누를 수 있다). 취소는 바로 굳힌다.
   */
  function resolveOcr(noteId: string, idx: number, approved: boolean) {
    const proposal = nb.notes.find((n) => n.id === noteId)?.messages[idx]?.ocrProposal;
    if (!proposal || pending) return;
    const resolve = () => nb.updateMessage(noteId, idx, { ocrProposal: { ...proposal, resolved: true } });
    if (!approved) {
      resolve();
      nb.appendMessage(noteId, { role: "ai", text: "반영을 취소했어요. 문서는 소스로만 보관돼요." });
      return;
    }
    // 성공 뒤 카드를 닫는 일을 respond 에 맡긴다 — 실패 후 '다시 시도'로 성공했을 때도 같이 닫히게
    respond(noteId, { message: "", ...ctx(), action: { type: "approve-proposal", proposal } }, resolve);
  }

  /**
   * 도구 실행 승인·거절 — 카드의 결정을 서버로 보낸다. 서버는 자기 감사 기록의 입력으로 실행하고 결과로 답한다.
   * 화면에는 결정 문구를 사용자 메시지로 남긴다(서버도 같은 문구를 저장한다).
   */
  function decideApproval(noteId: string, idx: number, approvalId: string, approved: boolean) {
    const m = nb.notes.find((n) => n.id === noteId)?.messages[idx];
    const a = m?.approvals?.find((x) => x.approvalId === approvalId);
    if (!a || a.decision || pending) return;
    nb.updateMessage(noteId, idx, {
      approvals: m!.approvals!.map((x) =>
        x.approvalId === approvalId ? { ...x, decision: approved ? "approved" : "denied" } : x,
      ),
    });
    nb.appendMessage(noteId, { role: "user", text: `${a.label} 실행을 ${approved ? "승인" : "거절"}했어요.` });
    respond(noteId, {
      message: "",
      sources: turnContext.sources,
      skills: [],
      action: { type: "tool-approval", approvalId, approved },
    });
  }

  return { pending, justArrived, respond, send, editUser, retry, rate, resolveOcr, decideApproval };
}
