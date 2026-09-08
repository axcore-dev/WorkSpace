"use client";

import Link from "next/link";
import { useState } from "react";
import { ChartFromSpec } from "@/components/charts";
import { IconDownload } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Badge, Button, Card, DataTable, FIELD, SectionHeader } from "@/components/ui";
import { MONTHLY_PL, type Voucher } from "@/data/pages/management";
import type { Cell } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { SUMMARY_ID, daysBetween, formatEok, formatWon, voucherTone } from "@/lib/management-state";
import { useManagement } from "./management-provider";
import { Banner, ConfirmModal, EntityHeader, Kv, KvGrid, MasterList, Tiles, Workbench } from "./workbench";

/** 요약 항목 — 회계 마스터 맨 위. 값은 MONTHLY_PL 마지막 달에서 파생 */
const LAST = MONTHLY_PL.labels!.length - 1;
const SALES = MONTHLY_PL.series![0].values;
const COST = MONTHLY_PL.series![1].values;
const SUMMARY = {
  month: MONTHLY_PL.labels![LAST],
  sales: SALES[LAST],
  cost: COST[LAST],
  profit: Number((SALES[LAST] - COST[LAST]).toFixed(1)),
  prevProfit: Number((SALES[LAST - 1] - COST[LAST - 1]).toFixed(1)),
};

type Dialog = null | "approve" | "reject";

export function AccountingWorkbench({ onOpenTab }: { onOpenTab: (tabId: string) => void }) {
  const { state, dispatch, notify, today, pending, select, selected } = useManagement();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);

  const q = query.trim().toLowerCase();
  const byPending = (a: Voucher, b: Voucher) =>
    (a.status === "검토중" ? 0 : 1) - (b.status === "검토중" ? 0 : 1) || b.no.localeCompare(a.no);
  const vouchers = [...state.vouchers].sort(byPending);
  const visible = vouchers.filter(
    (v) => !q || v.no.toLowerCase().includes(q) || v.summary.toLowerCase().includes(q) || v.counterparty.toLowerCase().includes(q),
  );
  const selectedId = selected("accounting");
  const voucher = state.vouchers.find((v) => v.no === selectedId);

  const master = (close: () => void) => (
    <MasterList
      search={{ placeholder: "전표번호 · 적요 · 거래처로 찾기", value: query, onChange: setQuery }}
      groups={[
        {
          label: "지난 달",
          items: q ? [] : [{ id: SUMMARY_ID, name: `2026년 ${SUMMARY.month} 손익`, meta: `${formatEok(SUMMARY.profit * 1e8)} · 매출 ${SUMMARY.sales}억 · 매입·비용 ${SUMMARY.cost}억` }],
        },
        {
          label: "전표 · 검토중 우선",
          items: visible.map((v) => ({ id: v.no, name: v.no, meta: `${v.kind} · ${formatWon(v.amount)} · ${v.date.slice(5)}`, badge: { text: v.status, tone: voucherTone(v.status) } })),
        },
      ]}
      selectedId={selectedId}
      onSelect={(id) => {
        select("accounting", id);
        close();
      }}
      footer={`전표 ${state.vouchers.length}건 · 검토중 ${pending.accounting}건`}
      emptyText="찾는 전표가 없어요. 전표번호나 거래처로 찾아볼까요?"
    />
  );

  if (!voucher) {
    const thisMonth = state.vouchers.filter((v) => v.date.startsWith(today.slice(0, 7)));
    const rows: Cell[][] = thisMonth.map((v) => [v.no, v.date, v.kind, v.summary, formatWon(v.amount), { badge: v.status, tone: voucherTone(v.status) }]);
    return (
      <Workbench pickerTitle="전표 고르기" pickerLabel={`보고 있는 항목 · 2026년 ${SUMMARY.month} 손익`} renderMaster={master}>
        <EntityHeader title={`2026년 ${SUMMARY.month} 손익`} meta={`매출 ${SUMMARY.sales}억 · 매입·비용 ${SUMMARY.cost}억 · 전월 손익 ${formatEok(SUMMARY.prevProfit * 1e8)}`} />
        <Tiles
          items={[
            { label: "매출", value: `${SUMMARY.sales}억원` },
            { label: "매입·비용", value: `${SUMMARY.cost}억원` },
            { label: "손익", value: formatEok(SUMMARY.profit * 1e8), sub: `전월 대비 ${formatEok((SUMMARY.profit - SUMMARY.prevProfit) * 1e8)}`, tone: SUMMARY.profit >= SUMMARY.prevProfit ? "green" : "red" },
          ]}
        />
        <Card>
          <SectionHeader title={MONTHLY_PL.title} />
          <ChartFromSpec spec={MONTHLY_PL} />
        </Card>
        <Card>
          <SectionHeader title={`이번 달 전표 ${thisMonth.length}건`} />
          <DataTable dense data={{ columns: ["전표번호", "일자", "구분", "적요", "금액", "상태"], rows }} colAlign={["left", "left", "left", "left", "right", "left"]} onRowClick={(i) => select("accounting", thisMonth[i].no)} />
        </Card>
      </Workbench>
    );
  }

  const pendingDays = daysBetween(voucher.date, today);
  const lines: Cell[][] = voucher.lines.map((l) => [l.account, l.debit ? formatWon(l.debit) : "—", l.credit ? formatWon(l.credit) : "—", l.memo]);
  const debitTotal = voucher.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const run = voucher.runId ? state.runs.find((r) => r.id === voucher.runId) : undefined;

  function exportCsv() {
    downloadCsv(`경영지원_${voucher!.no}_분개.csv`, [["계정과목", "차변", "대변", "적요"], ...voucher!.lines.map((l) => [l.account, String(l.debit ?? ""), String(l.credit ?? ""), l.memo] as Cell[])]);
    notify(`${voucher!.no} 분개를 내보냈어요`);
  }

  return (
    <>
      <Workbench pickerTitle="전표 고르기" pickerLabel={`보고 있는 전표 · ${voucher.no}`} pickerBadge={<Badge tone={voucherTone(voucher.status)}>{voucher.status}</Badge>} renderMaster={master}>
        <EntityHeader
          title={voucher.no}
          status={{ label: voucher.status, tone: voucherTone(voucher.status) }}
          meta={`${voucher.date} · ${voucher.kind} · ${voucher.counterparty} · 작성 ${voucher.owner}`}
          actions={
            <>
              <Button variant="secondary" size="sm" className="h-8" onClick={exportCsv}>
                <IconDownload size={14} /> 내보내기
              </Button>
              {voucher.status === "검토중" && (
                <>
                  <Button variant="danger" size="sm" className="h-8" onClick={() => setDialog("reject")}>
                    반려하기
                  </Button>
                  <Button onClick={() => setDialog("approve")}>승인하기</Button>
                </>
              )}
            </>
          }
        />

        {voucher.status === "검토중" && (
          <Banner tone="amber">
            검토 요청 후 {pendingDays}일 지났어요 · 승인하면 {Number(voucher.date.slice(5, 7))}월 {voucher.kind} 원장에 바로 올라가요
          </Banner>
        )}
        {voucher.status === "반려" && <Banner tone="slate">반려한 전표예요{voucher.rejectReason ? ` · 사유: ${voucher.rejectReason}` : ""}</Banner>}

        <Tiles
          items={[
            { label: "금액", value: formatWon(voucher.amount), sub: voucher.summary },
            voucher.vat != null ? { label: "부가세", value: formatWon(voucher.vat), sub: voucher.kind === "매입" ? "매입세액" : "매출세액" } : { label: "공제", value: formatWon(voucher.lines.find((l) => l.account === "예수금")?.credit ?? 0), sub: "4대보험 · 소득세" },
            { label: "계정", value: voucher.account, sub: `${voucher.lines[0].debit ? "차변" : "대변"} · 상대 계정 ${voucher.lines[voucher.lines.length - 1].account}` },
          ]}
        />

        <Card>
          <SectionHeader title="분개" desc="승인하면 이 분개가 원장에 적혀요" />
          <DataTable dense data={{ columns: ["계정과목", "차변", "대변", "적요"], rows: lines }} colAlign={["left", "right", "right", "left"]} />
          <p className="mt-3 text-xs text-slate-400">차변 합계 {formatWon(debitTotal)} = 대변 합계 {formatWon(debitTotal)}</p>
        </Card>

        {voucher.purchase && (
          <Card>
            <SectionHeader title="매입 내역" />
            <KvGrid>
              <Kv label="품목">{voucher.purchase.item} ({voucher.purchase.code})</Kv>
              <Kv label="수량 · 단가">{voucher.purchase.qty.toLocaleString("ko-KR")} {voucher.purchase.unit} × {formatWon(voucher.purchase.unitPrice)}</Kv>
              <Kv label="담당">{voucher.owner}</Kv>
            </KvGrid>
            <Link href="/modules/inventory" className="mt-3 inline-block text-xs font-semibold text-primary-700 transition-colors hover:text-primary-800">
              재고·물류 &gt; 품목 마스터에서 {voucher.purchase.item} 보기 →
            </Link>
          </Card>
        )}
        {run && (
          <Card>
            <SectionHeader title="급여 회차" />
            <KvGrid>
              <Kv label="회차">{run.name}</Kv>
              <Kv label="회차 상태">{run.status}</Kv>
            </KvGrid>
            <button
              type="button"
              onClick={() => {
                select("payroll", run.id);
                onOpenTab("payroll");
              }}
              className="mt-3 cursor-pointer text-xs font-semibold text-primary-700 transition-colors hover:text-primary-800"
            >
              급여 관리에서 {run.name} 보기 →
            </button>
          </Card>
        )}
      </Workbench>

      <ConfirmModal
        open={dialog === "approve"}
        title="전표를 승인할까요?"
        message={<><span className="font-semibold text-slate-900">{voucher.no}</span> 전표를 승인해요. 승인하면 {Number(voucher.date.slice(5, 7))}월 {voucher.kind} 원장에 바로 올라가고, 검토중 목록에서 빠져요.</>}
        cta="승인하기"
        variant="primary"
        icon="check"
        onConfirm={() => {
          select("accounting", voucher.no);
          dispatch({ type: "approve", no: voucher.no });
          notify(`${voucher.no} 전표를 승인했어요`);
          setDialog(null);
        }}
        onClose={() => setDialog(null)}
      />

      <RejectModal
        key={String(dialog === "reject")}
        open={dialog === "reject"}
        voucher={voucher}
        onClose={() => setDialog(null)}
        onReject={(reason) => {
          select("accounting", voucher.no);
          dispatch({ type: "reject", no: voucher.no, reason });
          notify(`${voucher.no} 전표를 반려했어요`);
        }}
      />
    </>
  );
}

function RejectModal({ open, voucher, onClose, onReject }: { open: boolean; voucher: Voucher; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="전표를 반려할까요?"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button variant="danger" onClick={() => { onReject(reason); onClose(); }}>반려하기</Button>
        </div>
      }
    >
      <div className="space-y-3 p-5">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{voucher.no}</span> 전표를 작성자 {voucher.owner}에게 돌려보내요.
          {voucher.runId && " 급여 전표라서 그 회차는 「전표 반려」 상태로 돌아가요."}
        </p>
        <div>
          <label htmlFor="reject-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
            반려 사유 <span className="font-normal text-slate-400">(선택)</span>
          </label>
          <textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="수량이나 단가가 발주서와 다르면 어디가 다른지 적어 주세요" className={`${FIELD} resize-none`} />
        </div>
      </div>
    </Modal>
  );
}
