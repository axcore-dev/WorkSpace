/**
 * 운영자 콘솔 표 — `ui.tsx`의 `DataTable`은 셀이 `string | number | badge`뿐이라
 * 링크·버튼이 들어가는 관리자 표에는 쓸 수 없다.
 *
 * 고객 화면보다 한 단계 조밀하다(13px, 셀 패딩 축소). 운영자는 한 화면에서 많은 행을
 * 훑어야 하고, 콘솔 폭이 상한 없이 넓어서 행 높이가 크면 스크롤만 길어진다.
 * 카드·폼·제목은 고객 화면과 같은 크기를 쓴다 — 표만 조인다.
 */

export const TR = "transition-colors hover:bg-slate-50/70";
export const TD = "whitespace-nowrap px-2.5 py-2.5 text-slate-600 first:pl-1 last:pr-1";
/** 첫 열 강조 — 회사명·항목명처럼 행을 식별하는 열 */
export const TD_KEY = `${TD} font-medium text-slate-900`;
/** 줄바꿈이 필요한 열 (주소 등) */
export const TD_WRAP = "px-2.5 py-2.5 text-slate-600 first:pl-1 last:pr-1";

export function AdminTable({
  columns,
  minWidth = 720,
  children,
}: {
  columns: string[];
  /** 이 폭 아래로는 가로 스크롤 (본문이 아니라 표만 스크롤한다) */
  minWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="thin-scroll -mx-1 overflow-x-auto px-1">
      <table className="w-full text-left text-[13px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col}
                scope="col"
                className="whitespace-nowrap px-2.5 py-2 text-[11px] font-medium text-slate-400 first:pl-1 last:pr-1"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

/** 라벨 = 값 형태의 정의 표 (사업자 정보·담당자 카드) */
export function DefinitionList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="w-28 shrink-0 text-slate-400">{label}</dt>
          <dd className="min-w-0 flex-1 break-words text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
