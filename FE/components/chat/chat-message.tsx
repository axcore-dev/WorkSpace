"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AgentTrace, StreamingText } from "@/components/chat/agent-trace";
import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconFile,
  IconPencil,
  IconRefresh,
  IconThumbsDown,
  IconThumbsUp,
} from "@/components/icons";
import { Button } from "@/components/ui";
import type { ChatMessage } from "@/data/chat";

const ICON_BTN =
  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-40";

/** 복사 버튼 — 성공하면 1.2초 동안 체크 아이콘으로 바뀐다 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})}
      aria-label={copied ? "복사됨" : "복사"}
      title="복사"
      className={ICON_BTN}
    >
      {copied ? <IconCheck size={14} className="text-slate-700" /> : <IconCopy size={14} />}
    </button>
  );
}

/**
 * 사용자 말풍선 — hover 시 왼쪽에 복사·편집 아이콘이 뜬다.
 * 편집은 말풍선 자리에서 바로 하고, 보내면 그 뒤 답변이 다시 생성된다.
 */
export function UserMessage({
  msg,
  disabled,
  onEdit,
}: {
  msg: ChatMessage;
  /** 답변 생성 중에는 편집을 막는다 */
  disabled: boolean;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  function save() {
    const t = draft.trim();
    setEditing(false);
    if (t && t !== msg.text) onEdit(t);
  }

  if (editing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[80%] rounded-2xl border border-slate-300 bg-white p-2 shadow-sm">
          <label htmlFor="chat-edit" className="sr-only">
            메시지 편집
          </label>
          <textarea
            id="chat-edit"
            ref={ref}
            value={draft}
            rows={Math.min(6, draft.split("\n").length)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                save();
              }
            }}
            className="thin-scroll block w-full resize-none bg-transparent px-2 pt-1.5 text-sm leading-relaxed text-slate-900 focus:outline-none"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              취소
            </Button>
            <Button size="sm" onClick={save} disabled={!draft.trim()}>
              보내기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-fade group flex items-end justify-end gap-1">
      <div
        role="group"
        aria-label="메시지 동작"
        className="flex opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
      >
        <CopyButton text={msg.text} />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setDraft(msg.text);
            setEditing(true);
          }}
          aria-label="편집"
          title="편집"
          className={ICON_BTN}
        >
          <IconPencil size={14} />
        </button>
      </div>
      <div className="max-w-[80%] rounded-2xl bg-slate-200/70 px-4 py-2.5 text-sm leading-relaxed text-slate-800">
        {msg.attachment && (
          <p className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs">
            <IconFile size={13} /> {msg.attachment}
          </p>
        )}
        <span className="whitespace-pre-line">{msg.text}</span>
      </div>
    </div>
  );
}

/** 답변에 딸린 출처 문서 수 — 인용 스니펫과 조회 소스를 합쳐 중복 없이 센다 */
export function sourceCount(msg: ChatMessage) {
  return new Set([...(msg.sources?.map((s) => s.doc) ?? []), ...(msg.process?.sources ?? [])]).size;
}

/**
 * AI 답변 — 말풍선 없이 트레이스·본문·동작 바가 세로로 붙는다.
 * 동작 바(복사·다시 시도·평가·출처)는 마지막 답변엔 항상, 이전 답변엔 hover 시 보인다.
 */
export function AiMessage({
  msg,
  last,
  streaming,
  disabled,
  onStreamDone,
  onRetry,
  onRate,
  onOpenSources,
  children,
}: {
  msg: ChatMessage;
  last: boolean;
  /** 새로 도착한 답변 — 타자 효과로 흐른다 */
  streaming: boolean;
  /** 다른 답변 생성 중에는 다시 시도를 막는다 */
  disabled: boolean;
  onStreamDone: () => void;
  onRetry: () => void;
  onRate: (r: "up" | "down") => void;
  onOpenSources: () => void;
  /** 본문 뒤에 붙는 카드(발주서 제안 등) */
  children?: React.ReactNode;
}) {
  const trace = msg.process?.trace ?? msg.process?.steps.map((text) => ({ text })) ?? [];
  const srcN = sourceCount(msg);
  const rateCls = (r: "up" | "down") => `${ICON_BTN} ${msg.rating === r ? "bg-slate-100 text-slate-900" : ""}`;

  return (
    <div className="group min-w-0 max-w-[85%]">
      {msg.process && <AgentTrace rows={trace} thoughts={msg.reasoning} durationMs={msg.durationMs} />}
      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
        {streaming ? <StreamingText text={msg.text} onDone={onStreamDone} /> : msg.text}
        {!streaming && children}
      </div>
      {!streaming && msg.cta && (
        <Link
          href={msg.cta.href}
          className="agent-fade mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
        >
          {msg.cta.label} <IconArrowRight size={13} />
        </Link>
      )}
      {!streaming && (
        <div
          role="group"
          aria-label="답변 동작"
          className={`agent-fade mt-1.5 -ml-1.5 flex items-center gap-0.5 ${
            last ? "" : "opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100"
          }`}
        >
          <CopyButton text={msg.text} />
          <button
            type="button"
            disabled={disabled}
            onClick={onRetry}
            aria-label="다시 시도"
            title="다시 시도"
            className={ICON_BTN}
          >
            <IconRefresh size={14} />
          </button>
          <button
            type="button"
            onClick={() => onRate("up")}
            aria-pressed={msg.rating === "up"}
            aria-label="좋은 답변"
            title="좋은 답변"
            className={rateCls("up")}
          >
            <IconThumbsUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onRate("down")}
            aria-pressed={msg.rating === "down"}
            aria-label="아쉬운 답변"
            title="아쉬운 답변"
            className={rateCls("down")}
          >
            <IconThumbsDown size={14} />
          </button>
          {srcN > 0 && (
            <button
              type="button"
              onClick={onOpenSources}
              className="ml-1 flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              <IconFile size={13} />
              출처 {srcN}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
