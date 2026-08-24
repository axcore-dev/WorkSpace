"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { Badge, Button, Card, DataTable, FIELD, SectionHeader } from "@/components/ui";
import { IconAlertTriangle, IconCheck, IconSearch } from "@/components/icons";
import { RECEIPTS, type ReceiptCard } from "@/data/receiving";
import type { Tone } from "@/data/types";

const sum = (c: ReceiptCard, k: "ordered" | "received") => c.lines.reduce((a, l) => a + l[k], 0);

function statusOf(c: ReceiptCard): { label: string; tone: Tone } {
  const o = sum(c, "ordered");
  const r = sum(c, "received");
  if (r === 0) return { label: "입고 대기", tone: "slate" };
  if (r >= o) return { label: "입고 완료", tone: "green" };
  return { label: "부분 입고", tone: "amber" };
}

/** 여러 품목이면 대표 표기 + 「외 N」 */
const brief = (vals: string[]) => (vals.length > 1 ? `${vals[0]} 외 ${vals.length - 1}` : (vals[0] ?? "—"));

export function ReceivingInspection({ query }: { query?: string }) {
  const [cards, setCards] = useState<ReceiptCard[]>(RECEIPTS);
  const [q, setQ] = useState(query ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  /** 이번에 입고된 수량 — 라인 no → 값. 기입고분에 더한다 (FR-IV-09 누적 입력) */
  const [entry, setEntry] = useState<Record<string, number>>({});
  const [confirmOver, setConfirmOver] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const card = cards.find((c) => c.id === openId) ?? null;

  const visible = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return cards;
    return cards.filter((c) =>
      [c.id, c.projectCode, c.vehicle, c.supplier, c.poNo, ...c.lines.map((l) => l.item)].some((v) =>
        v.toLowerCase().includes(k),
      ),
    );
  }, [cards, q]);

  /** 잔량이 남은 건은 목록에 유지된다 (FR-IV-08) */
  const pending = visible.filter((c) => sum(c, "received") < sum(c, "ordered"));

  function open(id: string) {
    setOpenId(id);
    setEntry({});
    setConfirmOver(false);
    setSaved(null);
  }

  const over = card
    ? card.lines.filter((l) => l.received + (entry[l.no] ?? 0) > l.ordered)
    : [];
  const entered = Object.values(entry).reduce((a, b) => a + b, 0);

  function save() {
    if (!card) return;
    if (over.length > 0 && !confirmOver) {
      setConfirmOver(true);
      return;
    }
    setCards((prev) =>
      prev.map((c) =>
        c.id === card.id
          ? { ...c, lines: c.lines.map((l) => ({ ...l, received: l.received + (entry[l.no] ?? 0) })) }
          : c,
      ),
    );
    setSaved(`${entered} EA 입고 등록됨`);
    setEntry({});
    setConfirmOver(false);
  }

  return (
    <div className="space-y-4">
      <Card padding={false}>
        <div className="px-5 pt-5">
          <SectionHeader
            title="입고 대기 목록"
            action={
              <div className="relative w-56">
                <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="관리번호 · 발주처 · 품목"
                  aria-label="입고 건 검색"
                  className={`${FIELD} py-2 pl-9 text-[13px]`}
                />
              </div>
            }
          />
        </div>
        <div className="px-5 pb-5">
          <DataTable
            data={{
              columns: ["발주일자", "관리번호", "차종/품번", "사양(호칭)", "규격", "발주", "입고", "발주처", "상태"],
              rows: visible.map((c) => {
                const st = statusOf(c);
                return [
                  c.orderedOn,
                  c.projectCode,
                  c.vehicle,
                  brief(c.lines.map((l) => l.spec)),
                  brief(c.lines.map((l) => l.size.join("-"))),
                  String(sum(c, "ordered")),
                  String(sum(c, "received")),
                  c.supplier,
                  { badge: st.label, tone: st.tone },
                ];
              }),
            }}
            onRowClick={(i) => open(visible[i].id)}
          />
          {q && (
            <p className="mt-3 text-xs text-slate-400">
              &lsquo;{q}&rsquo; 필터 적용 중 · {visible.length}건 (잔량 있는 건 {pending.length})
            </p>
          )}
        </div>
      </Card>

      {/* ── Step.2 검수 상세 ─────────────────────────── */}
      <Modal
        open={!!card}
        onClose={() => setOpenId(null)}
        size="xl"
        title={card ? `${card.projectCode} · ${card.supplier}` : ""}
        footer={
          card && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                {saved ?? (entered > 0 ? `이번 입고 ${entered} EA` : "입고 수량을 입력하세요")}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOpenId(null)}>
                  닫기
                </Button>
                <Button onClick={save} disabled={entered === 0}>
                  {confirmOver ? "초과 입고 확인하고 등록" : "입고 등록"}
                </Button>
              </div>
            </div>
          )
        }
      >
        {card && (
          <div className="space-y-4 p-5">
            <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-slate-200 px-4 py-3 sm:grid-cols-2">
              <Row k="관리번호" v={card.projectCode} />
              <Row k="차종/품번" v={card.vehicle} />
              <Row k="근거 도면" v={`${card.drawing} ${card.rev}`} />
              <Row
                k="발주 / 입고 / 잔량"
                v={`${sum(card, "ordered")} / ${sum(card, "received")} / ${sum(card, "ordered") - sum(card, "received")}`}
              />
            </dl>

            {confirmOver && (
              <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                발주 수량을 초과하는 라인이 {over.length}건 있습니다 ({over.map((l) => l.item).join(", ")}). 확인 후
                등록하려면 다시 누르세요.
              </p>
            )}
            {saved && (
              <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <IconCheck size={16} className="mt-0.5 shrink-0" />
                {saved} — 검사 합격분은 입출고 이력에 자동 반영됩니다.
              </p>
            )}

            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                    {["번호", "품명", "사양(호칭)", "규격", "발주", "기입고", "이번 입고", "잔량", "외관", "합/부", "검사자", "문제점·조치사항"].map(
                      (h) => (
                        <th key={h} scope="col" className="whitespace-nowrap px-2.5 py-2.5">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {card.lines.map((l) => {
                    const add = entry[l.no] ?? 0;
                    const rest = l.ordered - (l.received + add);
                    return (
                      <tr key={l.no}>
                        <td className="px-2.5 py-2.5 font-medium text-slate-900">{l.no}</td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-700">{l.item}</td>
                        <td className="px-2.5 py-2.5 text-slate-600">{l.spec}</td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-600">
                          {l.size.map((part, i) => (
                            <span key={i}>
                              {i > 0 && <span className="mx-1 text-slate-300">/</span>}
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{part}</span>
                            </span>
                          ))}
                        </td>
                        <td className="px-2.5 py-2.5 text-slate-600">{l.ordered}</td>
                        <td className="px-2.5 py-2.5 text-slate-600">{l.received}</td>
                        <td className="px-2.5 py-2.5">
                          <input
                            type="number"
                            min={0}
                            aria-label={`${l.item} 이번 입고 수량`}
                            value={add || ""}
                            placeholder="0"
                            onChange={(e) =>
                              setEntry({ ...entry, [l.no]: Math.max(0, Number(e.target.value) || 0) })
                            }
                            className={`${FIELD} h-8 w-20 px-2 py-0 text-right`}
                          />
                        </td>
                        <td className={`px-2.5 py-2.5 font-medium ${rest < 0 ? "text-red-600" : rest === 0 ? "text-emerald-600" : "text-slate-600"}`}>
                          {rest}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-300">(수기)</td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-300">(수기)</td>
                        <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-600">{card.inspector}</td>
                        <td className="px-2.5 py-2.5 text-xs text-slate-500">{l.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone={statusOf(card).tone}>{statusOf(card).label}</Badge>
              <span className="text-xs text-slate-400">
                아이템 기준 소요 대비 입고 — {card.projectCode} · {sum(card, "received")} / {sum(card, "ordered")} EA
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-28 shrink-0 text-sm text-slate-400">{k}</dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-800">{v}</dd>
    </div>
  );
}
