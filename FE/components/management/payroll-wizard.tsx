"use client";

import { useState } from "react";
import { IconCheckCircle } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Button, DataTable, WizardSteps } from "@/components/ui";
import type { PayrollRun } from "@/data/pages/management";
import { formatWon, payrollLines } from "@/lib/management-state";
import type { Cell } from "@/data/types";
import { useManagement } from "./management-provider";

const STEPS = ["대상 확정", "산출 확인", "전표 만들기"];

/**
 * 급여 처리 3단계 — 명세 3.1.2 "원클릭 급상여 처리 → 전표 작성".
 * 금액 편집은 하지 않는다(산출 결과를 확인하는 단계). 마지막 단계에서 onCreate()가 전표를 만들고,
 * 본문은 성공 상태로 바뀐다(발주서 작성과 같은 패턴). 열릴 때마다 key로 리마운트해 1단계부터 시작한다.
 *
 * 전표 번호는 보이지 않는다 — 번호는 서버가 정하고, 만들어진 번호는 회계 관리와 회차 화면에 나온다.
 */
export function PayrollWizard({ open, run, onClose, onCreate }: { open: boolean; run: PayrollRun; onClose: () => void; onCreate: () => void }) {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);

  const { state } = useManagement();
  const teams = state.org.divisions.flatMap((d) => d.teams.map((t) => [t.name, d.name, `${t.size}명`, t.head] as Cell[]));
  const items: Cell[][] = run.items.map((i) => [i.label, i.amount < 0 ? { badge: formatWon(i.amount), tone: "red" } : formatWon(i.amount), i.note]);
  const lines: Cell[][] = payrollLines(run).map((l) => [l.account, l.debit ? formatWon(l.debit) : "—", l.credit ? formatWon(l.credit) : "—", l.memo]);

  function create() {
    onCreate();
    setDone(true);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`${run.name} 처리`}
      desc={`대상 ${run.headcount}명 · ${run.payDate} 이체 예정`}
      footer={
        done ? (
          <div className="flex justify-end">
            <Button onClick={onClose}>확인</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              {step === 1 && `대상 ${run.headcount}명 · 기본급 ${formatWon(run.items[0].amount)}`}
              {step === 2 && `실지급액 ${formatWon(run.net)} · 전월 대비 확인했어요`}
              {step === 3 && `차변 ${formatWon(run.gross)} = 대변 ${formatWon(run.deduction + run.net)}`}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={step > 1 ? () => setStep(step - 1) : onClose}>
                {step > 1 ? "이전" : "닫기"}
              </Button>
              {step < 3 ? <Button onClick={() => setStep(step + 1)}>다음</Button> : <Button onClick={create}>전표 만들기</Button>}
            </div>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <IconCheckCircle size={40} className="text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-slate-900">전표를 만들었어요</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">회계 관리에서 검토를 기다려요 · {run.payDate} 이체 예정</p>
        </div>
      ) : (
        <>
          <WizardSteps steps={STEPS} current={step} />
          {/* 세 단계가 같은 높이를 쓴다 — 내용에 맞춰 다이얼로그가 커졌다 작아지면(673→480→414px)
              [다음] 버튼 자리가 매번 바뀌어 연속으로 누를 수 없다. 넘치는 단계는 이 안에서 스크롤한다. */}
          <div className="thin-scroll h-[58vh] overflow-y-auto">
          {step === 1 && (
            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-500">재직 명단 기준 대상이에요. 이번 달 입사자는 일할 계산으로 들어가요.</p>
              <DataTable dense data={{ columns: ["팀", "본부", "인원", "팀장"], rows: teams }} />
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-400">지급 항목</p>
                <DataTable dense data={{ columns: ["항목", "금액", "비고"], rows: items }} colAlign={["left", "right", "left"]} />
              </div>
              <dl className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">지급 총액</dt><dd className="font-medium text-slate-900">{formatWon(run.gross)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">공제 총액</dt><dd className="font-medium text-red-600">{formatWon(-run.deduction)}</dd></div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="text-slate-500">실지급액</dt><dd className="text-lg font-bold tracking-tight text-slate-900">{formatWon(run.net)}</dd></div>
              </dl>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-500">아래 분개로 전표를 만들어요. 만든 전표는 회계 관리에서 검토중으로 올라가요.</p>
              <DataTable dense data={{ columns: ["계정과목", "차변", "대변", "적요"], rows: lines }} colAlign={["left", "right", "right", "left"]} />
            </div>
          )}
          </div>
        </>
      )}
    </Modal>
  );
}
