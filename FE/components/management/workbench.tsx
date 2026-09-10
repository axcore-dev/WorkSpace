"use client";

import { useState, type ReactNode } from "react";
import { IconAlertTriangle, IconCheckCircle, IconChevronDown, IconChevronRight, IconSearch } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Badge, Button, Card, FIELD_SM } from "@/components/ui";
import type { Tone } from "@/data/types";

/**
 * 경영지원 작업대 골격 — 좌 320 마스터(찾기 → 목록) | 우 디테일(헤더 → 배너 → 타일 → 표 → 연결).
 * 인사·급여·회계 셋이 같은 조각을 조합한다. 다른 모듈로 일반화하지 않는다(두 번째 모듈이 필요해질 때).
 * lg 미만: 마스터 Card 대신 「선택 바」 한 줄이 서고, 누르면 Modal sm 에 같은 목록이 열린다.
 */
export function Workbench({
  pickerTitle,
  pickerLabel,
  pickerBadge,
  renderMaster,
  children,
}: {
  /** 모바일 목록 모달 제목 (예: 「회차 고르기」) */
  pickerTitle: string;
  /** 선택 바 문구 (예: 「보고 있는 회차 · 2026년 7월 정기급여」) */
  pickerLabel: string;
  pickerBadge?: ReactNode;
  /** 마스터를 두 자리(데스크톱 카드 / 모바일 모달)에 그린다 — 행을 고르면 close()를 부른다 */
  renderMaster: (close: () => void) => ReactNode;
  children: ReactNode;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const close = () => setPickerOpen(false);
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* 칸을 늘리지 않고(`self-start`) 스크롤을 따라온다 — 늘리면 카드 아래가 그대로 빈 공백이 되고
          (급여 탭에서 320×351px), 디테일을 내려 읽는 동안 목록이 화면 밖으로 사라진다 */}
      <div className="hidden lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:self-start">{renderMaster(close)}</div>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setPickerOpen(true)}
        className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm font-medium text-slate-900 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 lg:hidden"
      >
        <span className="min-w-0 truncate">{pickerLabel}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
          {pickerBadge}
          <IconChevronDown size={14} />
        </span>
      </button>
      <Modal open={pickerOpen} onClose={close} size="sm" title={pickerTitle}>
        {renderMaster(close)}
      </Modal>
      <section className="min-w-0 space-y-5">{children}</section>
    </div>
  );
}

export interface MasterItem {
  id: string;
  name: string;
  meta?: string;
  badge?: { text: string; tone: Tone };
  /** 트리 들여쓰기 단계 (0·1·2) */
  indent?: 0 | 1 | 2;
  /** 접기/펼치기 가능한 행 (본부) */
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}
export interface MasterGroup {
  label?: string;
  items: MasterItem[];
}

const INDENT = ["pl-3", "pl-7", "pl-11"] as const;

export function MasterList({
  create,
  search,
  groups,
  selectedId,
  onSelect,
  footer,
  emptyText,
}: {
  create?: { label: string; onClick: () => void };
  search: { placeholder: string; value: string; onChange: (v: string) => void };
  groups: MasterGroup[];
  selectedId?: string;
  onSelect: (id: string) => void;
  footer: string;
  emptyText: string;
}) {
  const empty = groups.every((g) => g.items.length === 0);
  return (
    <Card padding={false} className="flex w-full flex-col">
      <div className="space-y-3 border-b border-slate-100 p-5">
        {create && (
          <Button variant="secondary" size="sm" className="h-8 w-full" onClick={create.onClick}>
            {create.label}
          </Button>
        )}
        <div className="relative">
          <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            className={`${FIELD_SM} !pl-9`}
          />
        </div>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {empty ? (
          <p className="px-3 py-8 text-center text-sm text-slate-500">{emptyText}</p>
        ) : (
          groups.map((g, gi) => (
            <div key={g.label ?? gi} className="space-y-0.5">
              {g.label && <p className="px-3 pb-1 pt-2 text-xs font-semibold text-slate-400">{g.label}</p>}
              {g.items.map((it) => {
                const on = it.id === selectedId;
                return (
                  <div key={it.id} className="flex items-center">
                    {it.expandable && (
                      <button
                        type="button"
                        aria-expanded={it.expanded}
                        aria-label={`${it.name} ${it.expanded ? "접기" : "펼치기"}`}
                        onClick={it.onToggle}
                        className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 ${
                          it.indent === 1 ? "ml-3" : ""
                        }`}
                      >
                        {it.expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-current={on || undefined}
                      onClick={() => onSelect(it.id)}
                      className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg py-2 pr-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                        it.expandable ? "pl-1" : INDENT[it.indent ?? 0]
                      } ${on ? "bg-slate-100" : "hover:bg-slate-50"}`}
                    >
                      <span className="min-w-0">
                        <span className={`block truncate text-sm ${on ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>{it.name}</span>
                        {it.meta && <span className="block truncate text-xs text-slate-400">{it.meta}</span>}
                      </span>
                      {it.badge && <Badge tone={it.badge.tone}>{it.badge.text}</Badge>}
                    </button>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">{footer}</p>
    </Card>
  );
}

/** 우 디테일 ① — 엔티티 이름 · 상태 · 메타 · 우측 액션(primary는 '다음 할 일' 하나만) */
export function EntityHeader({
  title,
  status,
  meta,
  actions,
}: {
  title: string;
  status?: { label: string; tone: Tone };
  meta: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900">
            {title}
            {status && (
              <Badge tone={status.tone} className="!text-sm">
                {status.label}
              </Badge>
            )}
          </h2>
          <p className="mt-1 text-xs text-slate-400">{meta}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </Card>
  );
}

/** 우 디테일 ② — 조건부 안내 문장. 버튼은 넣지 않는다(블루 예산) */
export function Banner({ tone, children }: { tone: "amber" | "slate"; children: ReactNode }) {
  const cls =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-slate-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  const Icon = tone === "amber" ? IconAlertTriangle : IconCheckCircle;
  return (
    <p className={`flex items-center gap-2.5 rounded-lg border px-5 py-3 text-sm ${cls}`}>
      <Icon size={16} className={`shrink-0 ${tone === "amber" ? "text-amber-600" : "text-slate-500"}`} />
      <span>{children}</span>
    </p>
  );
}

/** 우 디테일 ③ — 숫자 타일 3장 */
export function Tiles({ items }: { items: { label: string; value: string; sub?: string; tone?: Tone }[] }) {
  const toneCls: Record<Tone, string> = {
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
    slate: "text-slate-900",
    violet: "text-slate-900",
    blue: "text-slate-900",
  };
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((t) => (
        <div key={t.label} className="min-w-0 rounded-lg border border-slate-200 p-5">
          <p className="text-xs text-slate-500">{t.label}</p>
          <p className={`mt-1 truncate text-xl font-bold tracking-tight ${toneCls[t.tone ?? "slate"]}`}>{t.value}</p>
          {t.sub && <p className="mt-1 truncate text-xs text-slate-400">{t.sub}</p>}
        </div>
      ))}
    </div>
  );
}

/** 연결 Card 안의 dl 2열 */
export function KvGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-12 gap-y-3 sm:grid-cols-2">{children}</dl>;
}
export function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    // 값을 오른쪽 끝으로 밀지 않는다 — 밀면 값이 자기 라벨에서 240px, 옆 쌍 라벨에서 48px
    // 떨어져 근접성이 뒤집힌다(눈이 「값 + 옆 쌍 라벨」을 한 덩어리로 읽는다). 라벨 옆에 붙인다.
    <div className="flex items-baseline gap-2.5 border-b border-slate-100 pb-2">
      <dt className="shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

/** 확인 다이얼로그 — 왼쪽은 항상 [닫기]. 승인처럼 파괴적이지 않은 동작은 primary + 체크 아이콘 */
export function ConfirmModal({
  open,
  title,
  message,
  cta,
  variant,
  icon,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  cta: string;
  variant: "primary" | "danger";
  icon: "check" | "warn";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {cta}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3 p-5">
        {icon === "warn" ? (
          <IconAlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
        ) : (
          <IconCheckCircle size={20} className="mt-0.5 shrink-0 text-slate-500" />
        )}
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    </Modal>
  );
}

/** 처리 메뉴 — 항목 목록 모달(도면 관리의 처리 메뉴와 같은 형태) */
export function MenuModal({
  open,
  title,
  items,
  onClose,
}: {
  open: boolean;
  title: string;
  items: { label: string; hint?: string; danger?: boolean; disabled?: boolean; onClick: () => void }[];
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title={title}>
      <ul className="space-y-2 p-5">
        {items.map((it) => (
          <li key={it.label}>
            <button
              type="button"
              disabled={it.disabled}
              onClick={() => {
                onClose();
                it.onClick();
              }}
              className={`flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-lg border px-3.5 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                it.danger
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="font-medium">{it.label}</span>
              {it.hint && <span className="text-xs text-slate-400">{it.hint}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
