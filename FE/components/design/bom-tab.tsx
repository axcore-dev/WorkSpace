"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { Badge, Button, Card, EmptyState, FIELD } from "@/components/ui";
import { IconChevronDown, IconChevronRight, IconSearch } from "@/components/icons";
import type { Tone } from "@/data/types";
import { bomTree, liveLatest, type BomTreeLine } from "@/lib/design-state";
import { matchesQuery } from "@/lib/search";
import { useDesign } from "./design-provider";

/**
 * BOM 관리 — 도면에서 추출된 부품이 품목 마스터의 어느 품목인지 맺는 자리.
 *
 * 원본 도면(지금 리비전)마다 한 묶음으로 트리를 그린다: 자기 BOM 줄, 그 아래 「현장 제작」 = 이 도면을 근거로 한 파생
 * 도면(가공도)의 BOM 줄. 미매핑 줄은 빨간 표시 하나 — 발주서 작성이 그 도면을 막는다(재고·물류 `validateDraft`).
 * 줄을 누르면 품목 마스터에서 하나를 고른다. 품목 마스터는 재고·물류 것이다 — 그쪽 권한이 없으면 후보가 비어
 * 모달이 그 사실을 말한다. 검색(필터) · 내보내기는 탭 줄 오른쪽(`design-module.tsx`)에 있다.
 */
export function BomTab({ query }: { query: string }) {
  const { state, items, dispatch, notify, can } = useDesign();
  const [pick, setPick] = useState<BomTreeLine | null>(null);
  const [pickQuery, setPickQuery] = useState("");
  const canMap = can("bom");

  const groups = bomTree(state.drawings, query);

  async function map(itemCode: string | null) {
    if (!pick) return;
    const ok = await dispatch({ type: "mapBom", code: pick.drawing.code, rev: pick.drawing.rev, index: pick.index, itemCode });
    if (ok) notify(itemCode ? `${pick.line.item} 을(를) ${itemCode} 에 맺었어요` : "매핑을 풀었어요");
    setPick(null);
  }

  const pickLine = pick?.line ?? null;
  const candidates = items
    .filter((it) => !it.discontinued)
    .filter((it) => matchesQuery(pickQuery, [it.code, it.name, it.spec, it.size, it.category]))
    .sort((a, b) => {
      // 호칭+규격이 맞는 것 → 품명이 맞는 것 → 나머지
      const score = (it: typeof a) => (pickLine && it.spec === pickLine.spec && it.size === pickLine.size ? 0 : pickLine && it.name === pickLine.item ? 1 : 2);
      return score(a) - score(b) || a.code.localeCompare(b.code);
    });

  if (liveLatest(state.drawings).length === 0) {
    return <EmptyState title="BOM 이 없어요" desc="도면 관리에서 정제 엑셀과 함께 도면을 등록하면 부품이 여기에 쌓여요." />;
  }

  const onPick = canMap ? setPick : undefined;

  return (
    <>
      <Card>
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">검색 결과가 없어요</p>
        ) : (
          <ul className="space-y-0.5">
            {groups.map((g) => {
              const shortName = g.drawing.name.replace(/\s*조립도$/, "");
              const count = g.lines.length + g.derived.length;
              return (
                <TreeNode key={g.drawing.code} name={`${g.drawing.code} · ${shortName}`} meta={`${g.drawing.rev} 기준 · 부품 ${count}종`}>
                  {g.lines.map((l) => (
                    <LineRow key={l.index} l={l} depth={1} onPick={onPick} />
                  ))}
                  {g.derived.length > 0 && (
                    <TreeNode name="현장 제작" meta={`${g.derived.length}종`} depth={1}>
                      {g.derived.map((l) => (
                        <LineRow key={`${l.drawing.code}-${l.index}`} l={l} depth={2} onPick={onPick} />
                      ))}
                    </TreeNode>
                  )}
                </TreeNode>
              );
            })}
          </ul>
        )}
        {canMap && groups.length > 0 && <p className="mt-3 text-xs text-slate-400">부품 줄을 누르면 품목 마스터에서 고를 수 있어요. 이미 맺은 줄도 다른 품목으로 바꾸거나 풀 수 있어요.</p>}
      </Card>

      <Modal
        open={pick !== null}
        onClose={() => setPick(null)}
        size="md"
        title={pickLine ? `${pickLine.item}${pickLine.spec ? ` / ${pickLine.spec}` : ""} ${pickLine.size} — 품목 마스터에서 선택` : ""}
        footer={
          <div className="flex justify-between gap-2">
            {pickLine?.itemCode ? (
              <Button variant="ghost" onClick={() => void map(null)}>
                매핑 풀기
              </Button>
            ) : (
              <span />
            )}
            <Button variant="secondary" onClick={() => setPick(null)}>
              닫기
            </Button>
          </div>
        }
      >
        <div className="space-y-3 p-5">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">품목 마스터를 읽을 권한이 없어 후보가 없어요. 재고·물류 &gt; 품목 마스터 권한이 있는 사람이 맺어 주세요.</p>
          ) : (
            <>
              <div className="relative">
                <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} placeholder="코드 · 품목명 · 사양 · 규격" aria-label="품목 검색" className={`${FIELD} py-2 pl-9 text-[13px]`} autoFocus />
              </div>
              <ul className="thin-scroll max-h-[360px] space-y-1 overflow-y-auto">
                {candidates.map((it) => {
                  const exact = pickLine && it.spec === pickLine.spec && it.size === pickLine.size;
                  return (
                    <li key={it.code}>
                      <button
                        type="button"
                        onClick={() => void map(it.code)}
                        className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                          it.code === pickLine?.itemCode ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">
                            {it.code} · {it.name}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {it.spec} {it.size} · {it.category || "분류 없음"}
                          </span>
                        </span>
                        {exact && <Badge tone="green">호칭·규격 일치</Badge>}
                      </button>
                    </li>
                  );
                })}
                {candidates.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">맞는 품목이 없어요 — 재고·물류 &gt; 품목 마스터에서 먼저 등록해 주세요</li>}
              </ul>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

/** 접히는 묶음 줄 — 공용 `ModuleView` 의 트리와 같은 생김새 */
function TreeNode({ name, meta, depth = 0, children }: { name: string; meta: string; depth?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <li>
      <div className="flex items-center gap-2 rounded-lg py-1.5 pr-2" style={{ paddingLeft: `${depth * 20}px` }}>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${name} ${open ? "접기" : "펼치기"}`}
          onClick={() => setOpen(!open)}
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </button>
        <span className="text-sm font-medium text-slate-800">{name}</span>
        <span className="text-xs text-slate-400">{meta}</span>
      </div>
      {open && <ul>{children}</ul>}
    </li>
  );
}

function LineRow({ l, depth, onPick }: { l: BomTreeLine; depth: number; onPick?: (l: BomTreeLine) => void }) {
  const { line } = l;
  const tone: Tone = "red";
  const body = (
    <>
      <span className="h-5 w-5 shrink-0 text-center text-slate-300">·</span>
      <span className="text-sm font-medium text-slate-800">
        {line.item}
        {line.spec ? ` · ${line.spec}` : ""}
      </span>
      <span className="text-xs text-slate-400">
        {line.size ? `${line.size} · ` : ""}
        {line.qty} EA
      </span>
      {!line.itemCode && <Badge tone={tone}>미매핑</Badge>}
    </>
  );
  const cls = "flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left";
  return (
    <li>
      {onPick ? (
        <button type="button" onClick={() => onPick(l)} title={line.itemCode ? `매핑 ${line.itemCode} — 눌러서 바꾸기` : "눌러서 품목 마스터와 맺기"} className={`${cls} cursor-pointer transition-colors hover:bg-slate-50`} style={{ paddingLeft: `${depth * 20}px` }}>
          {body}
        </button>
      ) : (
        <div className={cls} style={{ paddingLeft: `${depth * 20}px` }}>
          {body}
        </div>
      )}
    </li>
  );
}
