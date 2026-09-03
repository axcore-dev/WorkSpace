"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { BrandIcon } from "@/components/brand-icons";
import { Badge, Button } from "@/components/ui";
import {
  IconArrowUpRight,
  IconCheck,
  IconPlus,
  IconSearch,
  IconX,
} from "@/components/icons";
import { CONNECTOR_CATEGORIES, CONNECTOR_LIB, SKILL_LIB } from "@/data/chat";

type Connector = (typeof CONNECTOR_LIB)[number];

/** 커넥터 상세 팝업 — 아이콘·설명·연결 CTA와 세부사항(분류·웹사이트·상태) */
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
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            {connector.name}
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
            {connector.desc}
          </p>
          <div className="mt-5">
            {connected ? (
              <Button
                variant="secondary"
                onClick={() => onDisconnect(connector)}
              >
                연결 해제
              </Button>
            ) : (
              <Button onClick={() => onConnect(connector)}>연결하기</Button>
            )}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-slate-900">세부사항</h3>
          <dl className="mt-3 grid grid-cols-3 gap-x-6 gap-y-4 rounded-xl border border-slate-200 p-4">
            <div>
              <dt className="text-xs font-medium text-slate-400">분류</dt>
              <dd className="mt-1 text-sm text-slate-700">
                {connector.category}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">웹사이트</dt>
              <dd className="mt-1">
                <a
                  href={connector.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
                >
                  {new URL(connector.url).hostname.replace(/^www\./, "")}{" "}
                  <IconArrowUpRight size={13} />
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
 * 커넥터 팝업 — 분류별(메신저·협업 / 문서·데이터 / 메일·일정 / ERP·회계) 앱 카드.
 *
 * 연결 상태는 **부모가 갖는다** — 입력창의 앱 스택·토글이 같은 값을 봐야 하기 때문이다.
 * 여기서 따로 들고 있으면 여기서 연결한 앱이 입력창에 나타나지 않는다.
 * 데모: Google Calendar는 즉시 연결 처리되고, 나머지 앱은 해당 앱 로그인 페이지로 보내는 목업이다.
 */
export function ConnectorModal({
  open,
  onClose,
  connected,
  onConnect,
  onDisconnect,
}: {
  open: boolean;
  onClose: () => void;
  /** 연결된 앱 slug */
  connected: string[];
  onConnect: (slug: string) => void;
  onDisconnect: (slug: string) => void;
}) {
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Connector | null>(null);

  const needle = q.trim().toLowerCase();
  const list = CONNECTOR_LIB.filter(
    (c) =>
      !needle ||
      c.name.toLowerCase().includes(needle) ||
      c.slug.includes(needle) ||
      c.category.includes(needle),
  );
  const groups = CONNECTOR_CATEGORIES.map((cat) => ({
    cat,
    items: list.filter((c) => c.category === cat),
  })).filter((g) => g.items.length > 0);

  function isConnected(c: Connector) {
    return connected.includes(c.slug);
  }

  /** 연결 — 데모: 즉시 연결 처리. OAuth 등 실연동은 BE 이관 후 BE API를 거친다 */
  function connect(c: Connector) {
    if (c.slug === "googlecalendar") {
      onConnect(c.slug);
      return;
    }
    if (c.loginUrl) window.open(c.loginUrl, "_blank", "noopener,noreferrer");
  }

  function disconnect(c: Connector) {
    onDisconnect(c.slug);
  }

  if (!open) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={detail ? () => setDetail(null) : onClose}
        size="xl"
        title="커넥터"
        desc={`연결한 앱은 AI가 답변 근거로 조회하고, 확인을 거쳐 알림·등록 같은 작업을 실행해요. ${connected.length}개 연결됨`}
      >
        <div className="thin-scroll overflow-y-auto px-5 pb-5 pt-4">
          {/* 검색 */}
          <div className="relative">
            <IconSearch
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="커넥터 검색"
              aria-label="커넥터 검색"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-400 focus:bg-white focus:outline-2 focus:outline-slate-300/60"
            />
          </div>

          {groups.length === 0 && (
            <p className="py-14 text-center text-sm text-slate-400">
              &lsquo;{q}&rsquo;에 맞는 커넥터가 없어요.
            </p>
          )}
          {groups.map(({ cat, items }) => (
            <section key={cat} aria-label={cat} className="mt-5">
              <h3 className="text-xs font-semibold text-slate-400">{cat}</h3>
              <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
                {items.map((c) => {
                  const on = isConnected(c);
                  return (
                    <li
                      key={c.slug}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition-colors hover:border-slate-300"
                    >
                      <button
                        type="button"
                        onClick={() => setDetail(c)}
                        aria-label={`${c.name} 상세 보기`}
                        className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white">
                          <BrandIcon slug={c.slug} size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {c.name}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-slate-500">
                            {c.desc}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => (on ? disconnect(c) : connect(c))}
                        aria-label={
                          on ? `${c.name} 연결 해제` : `${c.name} 연결`
                        }
                        title={
                          on
                            ? "연결 해제"
                            : "연결 (해당 앱 로그인 페이지로 이동)"
                        }
                        className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                          on
                            ? "bg-slate-800 text-white hover:bg-slate-700"
                            : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {on ? <IconCheck size={15} /> : <IconPlus size={15} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
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
export function SkillModal({
  open,
  onClose,
  selected,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  /** 이 턴에 물린 스킬 id */
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = SKILL_LIB.filter(
    (s) =>
      !needle ||
      s.name.toLowerCase().includes(needle) ||
      s.desc.toLowerCase().includes(needle) ||
      s.id.includes(needle),
  );

  return (
    <Modal open={open} onClose={onClose} size="md" title="스킬 사용">
      <div className="border-b border-slate-100 px-4 py-3">
        <label htmlFor="skill-search" className="sr-only">
          스킬 검색
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 focus-within:border-slate-400">
          <IconSearch size={15} className="shrink-0 text-slate-400" />
          <input
            id="skill-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="스킬 검색"
            className="w-full border-none bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>
      <ul className="divide-y divide-slate-100 p-2">
        {list.length === 0 && (
          <li className="px-3 py-8 text-center text-[15px] text-slate-400">
            찾는 스킬이 없어요.
          </li>
        )}
        {list.map((s) => {
          const on = selected.includes(s.id);
          return (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 px-3 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900">
                  {s.name}
                  {s.official && (
                    <span className="rounded border border-slate-200 px-1.5 text-[13px] font-normal text-slate-400">
                      기본 제공
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
                  {s.desc}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggle(s.id)}
                aria-pressed={on}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  on
                    ? "bg-slate-800 text-white hover:bg-slate-700"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {on ? <IconCheck size={13} /> : <IconPlus size={13} />}
                {on ? "사용 중" : "사용"}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
