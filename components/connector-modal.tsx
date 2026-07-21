"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { BrandIcon } from "@/components/brand-icons";
import { Badge, Button } from "@/components/ui";
import { IconArrowUpRight, IconCheck, IconChevronDown, IconPlus, IconSearch, IconX } from "@/components/icons";
import { CONNECTOR_LIB, SKILL_LIB } from "@/data/chat";

const TABS = ["앱", "사용자 정의 API", "사용자 정의 MCP", "프로젝트"];

type Connector = (typeof CONNECTOR_LIB)[number];

/**
 * 커넥터 상세 팝업 (레퍼런스: 커넥터 카드 클릭 팝업 — 샘플 프롬프트 제외).
 * 아이콘·설명·연결 CTA와 세부사항만 표시한다.
 */
function ConnectorDetailModal({
  connector,
  connected,
  onClose,
  onConnect,
  onDisconnect,
}: {
  connector: Connector | null;
  connected: boolean;
  onClose: () => void;
  onConnect: (c: Connector) => void;
  onDisconnect: (c: Connector) => void;
}) {
  if (!connector) return null;
  return (
    <Modal open onClose={onClose} size="md">
      <div className="relative px-6 pb-6 pt-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <IconX size={18} />
        </button>

        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <BrandIcon slug={connector.slug} size={30} />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">{connector.name}</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{connector.desc}</p>
          <div className="mt-5">
            {connected ? (
              <Button variant="secondary" onClick={() => onDisconnect(connector)}>
                연결 해제
              </Button>
            ) : (
              <Button onClick={() => onConnect(connector)}>연결하기</Button>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-900">세부사항</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-slate-200 p-4">
            <div>
              <dt className="text-xs font-medium text-slate-400">커넥터 유형</dt>
              <dd className="mt-1 text-sm text-slate-700">앱</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">작성자</dt>
              <dd className="mt-1 text-sm text-slate-700">AXpoint</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">추가 정보</dt>
              <dd className="mt-1">
                <a
                  href={connector.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
                >
                  웹사이트 <IconArrowUpRight size={13} />
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">상태</dt>
              <dd className="mt-1">
                <Badge tone={connected ? "green" : "slate"} className="text-sm">
                  {connected ? "연결됨" : "미연결"}
                </Badge>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Modal>
  );
}

/**
 * 커넥터 추가 팝업 (Manus형) — 브랜드 로고 포함.
 * Google Calendar는 서버 OAuth 상태를 조회해 실제 연결 여부를 반영하고,
 * 나머지 앱은 '+' 클릭 시 해당 앱 로그인 페이지로 이동하는 목업이다.
 */
export function ConnectorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState("앱");
  const [q, setQ] = useState("");
  const [connected, setConnected] = useState<string[]>(
    CONNECTOR_LIB.filter((c) => c.connected).map((c) => c.slug),
  );
  const [googleConnected, setGoogleConnected] = useState(false);
  const [detail, setDetail] = useState<Connector | null>(null);

  // 열릴 때마다 Google 연동 상태를 서버에서 조회한다 (토큰 존재 여부만 응답)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/auth/google/status")
      .then((r) => r.json())
      .then((d: { connected?: boolean }) => {
        if (!cancelled) setGoogleConnected(!!d.connected);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const list = CONNECTOR_LIB.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  function isConnected(c: Connector) {
    return c.slug === "googlecalendar" ? googleConnected : connected.includes(c.slug);
  }

  /** 연결 — Google Calendar는 실제 OAuth 플로우, 나머지는 해당 앱 로그인 페이지로 이동 */
  function connect(c: Connector) {
    if (c.slug === "googlecalendar") {
      window.location.assign("/api/auth/google");
      return;
    }
    if (c.loginUrl) window.open(c.loginUrl, "_blank", "noopener,noreferrer");
  }

  function disconnect(c: Connector) {
    if (c.slug === "googlecalendar") {
      void fetch("/api/auth/google/status", { method: "DELETE" }).then(() => setGoogleConnected(false));
      return;
    }
    setConnected((prev) => prev.filter((x) => x !== c.slug));
  }

  if (!open) return null;

  return (
    <>
      <Modal open={open} onClose={detail ? () => setDetail(null) : onClose} size="xl" title="커넥터">
        <div className="px-5 pb-5 pt-4">
          {/* 검색 */}
          <div className="relative">
            <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="커넥터 검색"
              aria-label="커넥터 검색"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-400 focus:bg-white focus:outline-2 focus:outline-slate-300/60"
            />
          </div>

          {/* 탭 + 생성 */}
          <div className="mt-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex gap-1" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`-mb-px cursor-pointer border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                    tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mb-1 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              생성 <IconChevronDown size={13} />
            </button>
          </div>

          {tab === "앱" ? (
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {list.map((c) => {
                const on = isConnected(c);
                return (
                  <li
                    key={c.slug}
                    role="button"
                    tabIndex={0}
                    aria-label={`${c.name} 상세 보기`}
                    onClick={() => setDetail(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetail(c);
                      }
                    }}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition-colors hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                      <BrandIcon slug={c.slug} size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{c.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (on) disconnect(c);
                        else connect(c);
                      }}
                      aria-label={on ? `${c.name} 연결 해제` : `${c.name} 연결`}
                      title={on ? "연결 해제" : "연결 (해당 앱 로그인 페이지로 이동)"}
                      className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                        on ? "bg-slate-800 text-white hover:bg-slate-700" : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {on ? <IconCheck size={15} /> : <IconPlus size={15} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <p className="text-sm font-medium text-slate-600">{tab}</p>
              <p className="mt-1 text-xs text-slate-400">
                {tab === "프로젝트" ? "연결된 프로젝트가 없습니다." : `직접 등록한 ${tab.replace("사용자 정의 ", "")}가 없습니다.`} 우측 상단 &lsquo;생성&rsquo;에서 추가하세요.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {detail && (
        <ConnectorDetailModal
          connector={detail}
          connected={isConnected(detail)}
          onClose={() => setDetail(null)}
          onConnect={connect}
          onDisconnect={(c) => {
            disconnect(c);
            setDetail(null);
          }}
        />
      )}
    </>
  );
}

/** 스킬 추가 팝업 */
export function SkillModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [added, setAdded] = useState<string[]>([]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="스킬"
      desc="스킬은 업무 절차·양식·규칙을 AI에게 가르치는 지침 패키지입니다. 추가하면 AI가 해당 업무를 사내 규칙대로 수행해요."
    >
      <ul className="divide-y divide-slate-100 p-2">
        {SKILL_LIB.map((s) => {
          const on = added.includes(s.id);
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{s.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setAdded((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  on ? "bg-slate-800 text-white hover:bg-slate-700" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {on ? <IconCheck size={13} /> : <IconPlus size={13} />}
                {on ? "추가됨" : "추가"}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
