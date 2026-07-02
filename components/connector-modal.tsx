"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { BrandIcon } from "@/components/brand-icons";
import { IconCheck, IconChevronDown, IconPlus, IconSearch } from "@/components/icons";
import { CONNECTOR_LIB, SKILL_LIB } from "@/data/chat";

const TABS = ["앱", "사용자 정의 API", "사용자 정의 MCP", "프로젝트"];

/** 커넥터 추가 팝업 (Manus형) — 브랜드 로고 포함 */
export function ConnectorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState("앱");
  const [q, setQ] = useState("");
  const [connected, setConnected] = useState<string[]>(
    CONNECTOR_LIB.filter((c) => c.connected).map((c) => c.slug),
  );

  const list = CONNECTOR_LIB.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal open={open} onClose={onClose} size="xl" title="커넥터">
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
              const on = connected.includes(c.slug);
              return (
                <li
                  key={c.slug}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 transition-colors hover:border-slate-300"
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
                    onClick={() =>
                      setConnected((prev) => (on ? prev.filter((x) => x !== c.slug) : [...prev, c.slug]))
                    }
                    aria-label={on ? `${c.name} 연결 해제` : `${c.name} 추가`}
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
  );
}

/** 스킬 추가 팝업 */
export function SkillModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [added, setAdded] = useState<string[]>([]);
  return (
    <Modal open={open} onClose={onClose} size="md" title="스킬" desc="대화에서 사용할 스킬을 추가합니다.">
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
