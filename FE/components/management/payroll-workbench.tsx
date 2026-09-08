"use client";

import { useState } from "react";
import { IconChevronDown, IconDownload } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Badge, Button, Card, DataTable, FIELD, SectionHeader } from "@/components/ui";
import type { Cell } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { ddayLabel, daysBetween, formatWon, nextVoucherNo, payrollTone, weekdayKo } from "@/lib/management-state";
import { useManagement } from "./management-provider";
import { PayrollWizard } from "./payroll-wizard";
import { Banner, ConfirmModal, EntityHeader, Kv, KvGrid, MasterList, MenuModal, Tiles, Workbench } from "./workbench";

type Dialog = null | "wizard" | "paid" | "menu" | "delete" | "create";

export function PayrollWorkbench({ onOpenTab }: { onOpenTab: (tabId: string) => void }) {
  const { state, dispatch, notify, today, user, pending, select, selected } = useManagement();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);

  const runs = state.runs;
  const run = runs.find((r) => r.id === selected("payroll")) ?? runs[0];
  const q = query.trim().toLowerCase();
  const visible = runs.filter((r) => !q || r.name.toLowerCase().includes(q) || r.voucherNo?.toLowerCase().includes(q));
  const years = [...new Set(visible.map((r) => r.payDate.slice(0, 4)))];

  if (!run) return <Card className="text-center text-sm text-slate-500">급여 회차가 없어요. 「회차 만들기」로 시작해요.</Card>;

  const voucher = run.voucherNo ? state.vouchers.find((v) => v.no === run.voucherNo) : undefined;
  const prev = runs.find((r) => r.id !== run.id && r.status === "지급 완료");
  const dday = ddayLabel(run.payDate, today);
  const daysLeft = daysBetween(today, run.payDate);
  const items: Cell[][] = run.items.map((i) => [i.label, i.amount < 0 ? { badge: formatWon(i.amount), tone: "red" } : formatWon(i.amount), i.note]);

  function exportCsv() {
    downloadCsv(`경영지원_${run.name}_지급항목.csv`, [["항목", "금액", "비고"], ...run.items.map((i) => [i.label, String(i.amount), i.note] as Cell[])]);
    notify(`${run.name} 지급 항목을 내보냈어요`);
  }
  function openVoucher() {
    if (!voucher) return;
    select("accounting", voucher.no);
    onOpenTab("accounting");
  }

  const primary =
    run.status === "처리 대기" ? (
      <Button onClick={() => setDialog("wizard")}>급여 처리 시작하기</Button>
    ) : run.status === "전표 생성" ? (
      <Button onClick={() => setDialog("paid")}>지급 완료 처리하기</Button>
    ) : run.status === "전표 반려" ? (
      <Button onClick={() => dispatch({ type: "recalc", runId: run.id })}>다시 계산하기</Button>
    ) : null;

  return (
    <>
      <Workbench
        pickerTitle="회차 고르기"
        pickerLabel={`보고 있는 회차 · ${run.name}`}
        pickerBadge={<Badge tone={payrollTone(run.status)}>{run.status}</Badge>}
        renderMaster={(close) => (
          <MasterList
            create={{ label: "회차 만들기", onClick: () => setDialog("create") }}
            search={{ placeholder: "회차 · 전표번호로 찾기", value: query, onChange: setQuery }}
            groups={years.map((y) => ({
              label: `${y}년`,
              items: visible
                .filter((r) => r.payDate.startsWith(y))
                .map((r) => ({ id: r.id, name: r.name.replace(`${y}년 `, ""), meta: `${r.headcount}명 · ${formatWon(r.gross)}`, badge: { text: r.status, tone: payrollTone(r.status) } })),
            }))}
            selectedId={run.id}
            onSelect={(id) => {
              select("payroll", id);
              close();
            }}
            footer={`${runs.length}회차 · 처리 대기 ${pending.payroll}건`}
            emptyText="찾는 회차가 없어요. 다른 이름이나 전표번호로 찾아볼까요?"
          />
        )}
      >
        <EntityHeader
          title={run.name}
          status={{ label: run.status, tone: payrollTone(run.status) }}
          meta={
            <>
              지급 대상 {run.headcount}명 · 지급 예정일 {run.payDate} ({weekdayKo(run.payDate)})
              {run.status !== "지급 완료" && (
                <>
                  {" · "}
                  <span className="font-semibold text-amber-600">{dday}</span>
                </>
              )}
            </>
          }
          actions={
            <>
              <Button variant="secondary" size="sm" className="h-8" onClick={() => setDialog("menu")}>
                처리 <IconChevronDown size={14} />
              </Button>
              <Button variant="secondary" size="sm" className="h-8" onClick={exportCsv}>
                <IconDownload size={14} /> 내보내기
              </Button>
              {primary}
            </>
          }
        />

        {run.status === "처리 대기" && (
          <Banner tone="amber">
            지급 예정일 {Number(run.payDate.slice(5, 7))}월 {Number(run.payDate.slice(8, 10))}일까지 {daysLeft}일 남았어요 · 전표는 아직 만들지 않았어요
          </Banner>
        )}
        {run.status === "전표 생성" && (
          <Banner tone="slate">
            전표 {run.voucherNo}를 만들었어요 · 회계 관리에서 {voucher?.status === "승인" ? "승인됐어요" : "검토를 기다려요"} · {run.payDate} ({weekdayKo(run.payDate)}) 이체 예정
          </Banner>
        )}
        {run.status === "전표 반려" && (
          <Banner tone="amber">
            전표 {run.voucherNo}가 반려됐어요{voucher?.rejectReason ? ` · 사유: ${voucher.rejectReason}` : ""} · 다시 계산한 뒤 처리해요
          </Banner>
        )}

        <Tiles
          items={[
            { label: "지급 총액", value: formatWon(run.gross), sub: run.items.filter((i) => i.amount > 0).map((i) => i.label).join(" · ") },
            { label: "공제 총액", value: formatWon(run.deduction), sub: run.items.filter((i) => i.amount < 0).map((i) => i.label).join(" · "), tone: "red" },
            { label: "실지급액", value: formatWon(run.net), sub: prev ? `전월 ${formatWon(prev.net)}` : undefined },
          ]}
        />

        <Card>
          <SectionHeader title="지급 항목" desc="재직 명단과 지난달 근태 기준으로 계산했어요" />
          <DataTable dense data={{ columns: ["항목", "금액", "비고"], rows: items }} colAlign={["left", "right", "left"]} />
        </Card>

        <Card>
          <SectionHeader title="전표" />
          <KvGrid>
            <Kv label="이 회차 전표">
              {run.voucherNo ? (
                <>
                  {run.voucherNo}
                  {voucher && (
                    <>
                      {" · "}
                      <Badge tone={voucher.status === "승인" ? "green" : voucher.status === "반려" ? "red" : "amber"}>{voucher.status}</Badge>
                    </>
                  )}
                </>
              ) : (
                <span className="font-normal text-slate-400">미생성</span>
              )}
            </Kv>
            <Kv label="지난 회차 전표">{prev?.voucherNo ? `${prev.voucherNo} · 지급 완료 ${prev.paidAt}` : "—"}</Kv>
          </KvGrid>
          {voucher ? (
            <button type="button" onClick={openVoucher} className="mt-3 cursor-pointer text-xs font-semibold text-primary-700 transition-colors hover:text-primary-800">
              회계 관리에서 {voucher.no} 보기 →
            </button>
          ) : (
            <p className="mt-3 text-sm text-slate-500">급여 처리를 마치면 전표가 회계 관리에 검토중 상태로 올라가요.</p>
          )}
        </Card>
      </Workbench>

      {dialog === "wizard" && (
        <PayrollWizard
          open
          run={run}
          voucherNo={nextVoucherNo(state.vouchers, today)}
          author={user}
          today={today}
          onClose={() => setDialog(null)}
          onCreate={() => {
            dispatch({ type: "createVoucher", runId: run.id, date: today, author: user });
            notify(`${run.name.replace(/^\d{4}년 /, "")} 전표를 만들었어요`);
          }}
        />
      )}

      <ConfirmModal
        open={dialog === "paid"}
        title={`${run.name}를 지급 완료로 바꿀까요?`}
        message="바꾼 뒤에는 회차를 다시 계산할 수 없어요. 이체가 끝난 뒤에 눌러 주세요."
        cta="지급 완료로 바꾸기"
        variant="primary"
        icon="check"
        onConfirm={() => {
          dispatch({ type: "markPaid", runId: run.id, date: run.payDate });
          notify(`${run.name}를 지급 완료로 바꿨어요`);
          setDialog(null);
        }}
        onClose={() => setDialog(null)}
      />

      <MenuModal
        open={dialog === "menu"}
        title="회차 처리"
        items={[
          { label: "다시 계산하기", hint: "전표 반려 회차만", disabled: run.status !== "전표 반려", onClick: () => dispatch({ type: "recalc", runId: run.id }) },
          { label: "회차 삭제", hint: "처리 대기 회차만", danger: true, disabled: run.status !== "처리 대기", onClick: () => setDialog("delete") },
        ]}
        onClose={() => setDialog(null)}
      />

      <ConfirmModal
        open={dialog === "delete"}
        title="회차를 삭제할까요?"
        message={<><span className="font-semibold text-slate-900">{run.name}</span> 회차를 지워요. 지운 회차는 되돌릴 수 없어요.</>}
        cta="삭제하기"
        variant="danger"
        icon="warn"
        onConfirm={() => {
          dispatch({ type: "deleteRun", runId: run.id });
          notify(`${run.name} 회차를 지웠어요`);
          setDialog(null);
        }}
        onClose={() => setDialog(null)}
      />

      <CreateRunModal
        key={String(dialog === "create")}
        open={dialog === "create"}
        onClose={() => setDialog(null)}
        onCreate={(name, payDate) => {
          dispatch({ type: "createRun", name, payDate });
          notify(`${name} 회차를 만들었어요`);
        }}
      />
    </>
  );
}

function CreateRunModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, payDate: string) => void }) {
  const [name, setName] = useState("2026년 8월 정기급여");
  const [payDate, setPayDate] = useState("2026-08-25");
  const valid = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(payDate);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="회차 만들기"
      desc="금액은 최근 정기급여를 복제해요. 위저드에서 확인하고 처리해요."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>닫기</Button>
          <Button disabled={!valid} onClick={() => { onCreate(name.trim(), payDate); onClose(); }}>만들기</Button>
        </div>
      }
    >
      <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (valid) { onCreate(name.trim(), payDate); onClose(); } }}>
        <div>
          <label htmlFor="run-name" className="mb-1.5 block text-sm font-medium text-slate-700">회차 이름</label>
          <input id="run-name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="run-date" className="mb-1.5 block text-sm font-medium text-slate-700">지급 예정일</label>
          <input id="run-date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={FIELD} />
        </div>
      </form>
    </Modal>
  );
}
