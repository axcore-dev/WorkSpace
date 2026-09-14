"use client";

import { useRef, useState } from "react";
import { IconCheck, IconDownload, IconFile } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui";
import { downloadXlsx } from "@/lib/download";
import { formatQty } from "@/lib/format";
import { ITEM_SHEET_COLUMNS, parseItemRows, type ImportRow } from "@/lib/inventory-state";
import { parseSheet } from "@/lib/sheet";
import { useInventory } from "./inventory-provider";

type Picked = { name: string; size: number } & ({ state: "reading" } | { state: "read"; rows: ImportRow[] } | { state: "error"; message: string });

const sizeText = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/**
 * 품목 한 번에 등록하기 — 한 장짜리 팝업(단계 표시 없음). 양식 받기 → 파일 올리기(찾기 · 끌어 놓기) → 같은 자리에서 읽고
 * 「새 품목 · 바뀌는 품목 · 빠지는 행」과 빠지는 이유(행 번호 + 이유)를 보인 뒤 등록.
 *
 * 오류 행은 빼고 나머지만 등록한다(부분 성공) — 버튼의 숫자(「15개 등록하기」)가 그 사실을 말해서 따로 설명하지 않는다.
 * 올린 표의 칸은 여기서 고치지 않는다 — 엑셀에서 고쳐 다시 올린다. 코드 기준 매칭 · 거래처 이름 매칭 규칙은 `parseItemRows`.
 */
export function ItemImportModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch, notify } = useInventory();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function read(file: File) {
    setPicked({ name: file.name, size: file.size, state: "reading" });
    try {
      const sheet = await parseSheet(file);
      setPicked({ name: file.name, size: file.size, state: "read", rows: parseItemRows([sheet.columns, ...sheet.rows], state) });
    } catch (e) {
      setPicked({ name: file.name, size: file.size, state: "error", message: e instanceof Error ? e.message : "파일을 읽지 못했어요" });
    }
  }

  const rows = picked?.state === "read" ? picked.rows : [];
  const creates = rows.filter((r) => r.status === "create").length;
  const updates = rows.filter((r) => r.status === "update").length;
  const errors = rows.filter((r) => r.status === "error");
  const valid = creates + updates;

  function register() {
    const items = rows.flatMap((r) => (r.item ? [r.item] : []));
    void dispatch({ type: "importItems", items }).then((ok) => {
      if (!ok) return;
      notify([creates > 0 ? `품목 ${formatQty(creates)}개를 등록했어요` : "", updates > 0 ? `${formatQty(updates)}개를 바꿨어요` : ""].filter(Boolean).join(" · "));
      onClose();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="품목 한 번에 등록하기"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={picked?.state === "reading"}>
            {picked ? "다른 파일 올리기" : "파일 찾기"}
          </Button>
          <Button onClick={register} disabled={valid === 0}>
            {valid > 0 ? `${formatQty(valid)}개 등록하기` : "등록하기"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <div className="space-y-2">
          <p className="break-keep text-sm text-slate-600">엑셀 양식에 품목 정보를 모두 적은 뒤 파일을 올리면 품목을 한 번에 등록할 수 있어요.</p>
          <button
            type="button"
            onClick={() => void downloadXlsx("품목 등록 양식.xlsx", [ITEM_SHEET_COLUMNS])}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary-700 underline underline-offset-4 transition-colors duration-150 hover:text-primary-800"
          >
            <IconDownload size={15} />
            품목 등록 양식 다운받기
          </button>
        </div>

        {/* 끌어 놓기 자리 — 파일이 없으면 누르면 찾기, 있으면 파일 줄 + 결과 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void read(f);
          }}
          className={`min-h-36 rounded-xl border border-dashed p-3 transition-colors duration-150 ${dragging ? "border-slate-500 bg-slate-100" : "border-slate-300 bg-slate-50"}`}
        >
          {!picked ? (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-full min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-700">
              <span className="text-sm font-medium">파일을 여기로 끌어 놓거나 눌러서 고르세요</span>
              <span className="text-xs">.xlsx · .csv</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700" aria-hidden>
                  <IconFile size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900">{picked.name}</span>
                  <span className="block text-xs text-slate-500">
                    {sizeText(picked.size)}
                    {picked.state === "read" && ` · ${formatQty(rows.length)}행`}
                  </span>
                </span>
                {picked.state === "reading" ? (
                  <span className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-600" role="status">
                    <span className="spinner" aria-hidden />
                    읽는 중
                  </span>
                ) : picked.state === "read" ? (
                  <IconCheck size={18} className="text-emerald-700" aria-label="읽음" />
                ) : null}
              </div>

              {picked.state === "error" && (
                <p className="px-1 text-sm text-red-600" role="alert">
                  {picked.message}
                </p>
              )}

              {picked.state === "read" && (
                <div className="space-y-2 px-1">
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>
                      새 품목 <b className="font-semibold text-slate-900">{formatQty(creates)}</b>
                    </span>
                    <span>
                      바뀌는 품목 <b className="font-semibold text-slate-900">{formatQty(updates)}</b>
                    </span>
                    {errors.length > 0 && (
                      <span className="text-red-600">
                        빠지는 행 <b className="font-semibold">{formatQty(errors.length)}</b>
                      </span>
                    )}
                  </p>
                  {errors.length > 0 && (
                    <ul className="thin-scroll max-h-32 space-y-1 overflow-y-auto text-[13px]">
                      {errors.map((r) => (
                        <li key={r.row} className="grid grid-cols-[3.5rem_1fr] gap-2 text-slate-600">
                          <span className="font-medium text-red-600">{r.row}행</span>
                          <span>{r.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void read(f);
            e.target.value = "";
          }}
        />
      </div>
    </Modal>
  );
}
