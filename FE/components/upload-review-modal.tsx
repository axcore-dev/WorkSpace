"use client";

import { useRef, useState } from "react";
import { IconUpload } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Badge, Button, WizardSteps } from "@/components/ui";
import type { Cell, Tone } from "@/data/types";

export type UploadRowStatus = { status: "update" | "create" | "error"; reason?: string };

const STATUS_LABEL: Record<UploadRowStatus["status"], { text: string; tone: Tone }> = {
  update: { text: "갱신", tone: "slate" },
  create: { text: "신규", tone: "green" },
  error: { text: "오류", tone: "red" },
};

/**
 * 엑셀 업로드 — 파일 선택 → 정제 결과 확인·수정 → 승인(FR-IV-06, HITL).
 *
 * `parse` 를 주면 실제 파일을 읽고(`lib/sheet.ts`), 없으면 데모 2행을 만든다(공용 `ModuleView` 의 옛 동작).
 * `classify` 를 주면 행마다 갱신 · 신규 · 오류를 붙인다 — 값을 고치면 다시 분류되고, **오류 행은 승인에서 빠진다**(부분 성공).
 */
export function UploadReviewModal({
  open,
  title,
  columns,
  parse,
  classify,
  onApprove,
  onClose,
}: {
  open: boolean;
  title: string;
  /** 데모 파싱 · 안내용 열 이름. 실제 파일을 읽으면 파일의 머리글을 쓴다 */
  columns: string[];
  parse?: (file: File) => Promise<{ columns: string[]; rows: string[][] }>;
  classify?: (columns: string[], rows: string[][]) => UploadRowStatus[];
  onApprove: (rows: Cell[][], columns: string[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [cols, setCols] = useState<string[]>(columns);
  const [rows, setRows] = useState<string[][]>([]);
  const [readError, setReadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFile(file: File) {
    setReadError("");
    setFileName(file.name);
    if (parse) {
      try {
        const sheet = await parse(file);
        setCols(sheet.columns);
        setRows(sheet.rows);
      } catch (e) {
        setReadError(e instanceof Error ? e.message : "파일을 읽지 못했어요");
        return;
      }
    } else {
      // 데모: 정제 결과 2행을 생성한다. 실제로는 서버 파싱 결과가 들어온다.
      setCols(columns);
      setRows([
        columns.map((c, j) => (j === 0 ? "(신규) 업로드 항목 1" : `${c} 값`)),
        columns.map((c, j) => (j === 0 ? "(신규) 업로드 항목 2" : `${c} 값`)),
      ]);
    }
    setStep(2);
  }

  function close() {
    setStep(1);
    setFileName("");
    setCols(columns);
    setRows([]);
    setReadError("");
    onClose();
  }

  const statuses = classify && step === 2 ? classify(cols, rows) : null;
  const count = (s: UploadRowStatus["status"]) => statuses?.filter((x) => x.status === s).length ?? 0;
  const valid = statuses ? rows.filter((_, i) => statuses[i]?.status !== "error") : rows;

  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title={`${title} 엑셀 업로드`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {fileName && step === 2 && (statuses ? `${fileName} · 갱신 ${count("update")} · 신규 ${count("create")}${count("error") ? ` · 오류 ${count("error")} (제외)` : ""}` : `${fileName} · ${rows.length}건`)}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>
              닫기
            </Button>
            <Button
              disabled={step !== 2 || valid.length === 0}
              onClick={() => {
                onApprove(valid.map((r) => r as Cell[]), cols);
                close();
              }}
            >
              승인하고 반영
            </Button>
          </div>
        </div>
      }
    >
      <WizardSteps steps={["파일 선택", "정제 결과 확인", "승인"]} current={step} />
      {step === 1 ? (
        <div className="p-5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            <IconUpload size={22} />
            <span className="text-sm font-medium">엑셀 파일을 선택하세요</span>
            <span className="text-xs">.xlsx · .csv{parse ? ` · 첫 행은 머리글(${columns.join(" · ")})` : ""}</span>
          </button>
          {readError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {readError}
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-500">아래 내용이 반영돼요. 값을 눌러 고칠 수 있어요{statuses ? " — 고치면 다시 분류돼요" : ""}.</p>
          <div className="thin-scroll overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  {statuses && (
                    <th scope="col" className="px-3 py-2.5">
                      구분
                    </th>
                  )}
                  {cols.map((c, j) => (
                    <th key={`${c}-${j}`} scope="col" className="px-3 py-2.5">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => {
                  const st = statuses?.[i];
                  return (
                    <tr key={i} className={st?.status === "error" ? "bg-red-50/40" : ""}>
                      {st && (
                        <td className="whitespace-nowrap px-3 py-1.5 align-top">
                          <Badge tone={STATUS_LABEL[st.status].tone}>{STATUS_LABEL[st.status].text}</Badge>
                          {st.reason && <p className="mt-0.5 max-w-[200px] text-xs text-red-600">{st.reason}</p>}
                        </td>
                      )}
                      {r.map((v, j) => (
                        <td key={j} className="px-2 py-1.5 align-top">
                          <input
                            aria-label={`${i + 1}행 ${cols[j]}`}
                            value={v}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((row, ri) =>
                                  ri === i ? row.map((cv, ci) => (ci === j ? e.target.value : cv)) : row,
                                ),
                              )
                            }
                            className="w-full min-w-[96px] rounded-md border border-transparent px-2 py-1.5 text-sm text-slate-700 transition-colors hover:border-slate-200 focus:border-slate-400 focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
