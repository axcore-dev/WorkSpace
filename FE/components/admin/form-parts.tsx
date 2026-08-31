"use client";

import { IconPlus, IconX } from "@/components/icons";
import { Button, FIELD } from "@/components/ui";
import { formatBizNumber, type Site } from "@/data/admin";

/** 라벨 + 필수 표시 + 힌트/에러. 에러가 있으면 힌트를 대신한다 */
export function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
}

export const EMPTY_SITE: Site = { name: "", bizNumber: "", address: "", bizType: "", bizItem: "" };

/**
 * 종사업장 반복 입력 — 생성 폼과 상세의 인라인 수정이 같은 모양을 쓴다.
 * `idPrefix`로 라벨 `htmlFor`를 갈라 둔다. 한 화면에 두 벌이 뜨면 id가 겹친다.
 */
export function SiteFields({
  sites,
  onChange,
  idPrefix = "site",
}: {
  sites: Site[];
  onChange: (next: Site[]) => void;
  idPrefix?: string;
}) {
  function update(i: number, patch: Partial<Site>) {
    onChange(sites.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  return (
    <>
      {sites.length === 0 && <p className="mb-3 text-sm text-slate-400">등록된 종사업장이 없어요.</p>}

      <div className="space-y-3">
        {sites.map((site, i) => (
          <div key={i} className="rounded-lg border border-dashed border-slate-300 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">사업장 {i + 1}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(sites.filter((_, j) => j !== i))}
              >
                <IconX size={13} />
                삭제
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${idPrefix}-name-${i}`} label="사업장명">
                <input
                  id={`${idPrefix}-name-${i}`}
                  value={site.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="포항 2공장"
                  className={FIELD}
                />
              </Field>
              <Field id={`${idPrefix}-biz-${i}`} label="사업자등록번호">
                <input
                  id={`${idPrefix}-biz-${i}`}
                  inputMode="numeric"
                  value={site.bizNumber}
                  onChange={(e) => update(i, { bizNumber: formatBizNumber(e.target.value) })}
                  placeholder="000-00-00000"
                  className={`${FIELD} tabular-nums`}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field id={`${idPrefix}-addr-${i}`} label="주소">
                <input
                  id={`${idPrefix}-addr-${i}`}
                  value={site.address}
                  onChange={(e) => update(i, { address: e.target.value })}
                  placeholder="도로명 주소"
                  className={FIELD}
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id={`${idPrefix}-type-${i}`} label="업태">
                <input
                  id={`${idPrefix}-type-${i}`}
                  value={site.bizType}
                  onChange={(e) => update(i, { bizType: e.target.value })}
                  placeholder="제조업"
                  className={FIELD}
                />
              </Field>
              <Field id={`${idPrefix}-item-${i}`} label="업종">
                <input
                  id={`${idPrefix}-item-${i}`}
                  value={site.bizItem}
                  onChange={(e) => update(i, { bizItem: e.target.value })}
                  placeholder="철강 압연"
                  className={FIELD}
                />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => onChange([...sites, { ...EMPTY_SITE }])}
      >
        <IconPlus size={13} />
        종사업장 추가
      </Button>
    </>
  );
}

/** 인라인 편집 카드의 저장·취소 줄 */
export function EditActions({
  onCancel,
  onSave,
  canSave = true,
  saveLabel = "저장",
}: {
  onCancel: () => void;
  onSave: () => void;
  canSave?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
      <Button variant="secondary" size="sm" onClick={onCancel}>
        취소
      </Button>
      <Button
        size="sm"
        disabled={!canSave}
        onClick={onSave}
        title={canSave ? undefined : "필수 항목을 채우면 저장할 수 있어요"}
      >
        {saveLabel}
      </Button>
    </div>
  );
}
