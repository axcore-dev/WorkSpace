"use client";

/**
 * 회사 화면의 표 — 초대 관리 세 탭이 같은 모양을 쓴다.
 *
 * `ui.tsx`의 `DataTable`을 쓰지 않는 이유: 그쪽은 셀이 `string | number | badge`뿐이라
 * 직급 select·복사 버튼·로그아웃 버튼이 들어가지 않는다. 여기서는 셀을 그대로 받는다.
 *
 * `components/settings/company/`에 두는 이유: 지금 쓰는 곳이 이 폴더뿐이다. 계정 › 기기
 * 표도 비슷하지만 그쪽은 행 안에 두 줄(이름 + `이 기기`)이 들어가서 열 정의로는 안 접힌다 —
 * 세 번째 화면이 생기면 그때 `ui.tsx`로 올린다.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "데이터가 없습니다",
  minWidth = 620,
}: {
  columns: {
    /** 열 이름. 빈 문자열이면 머리글을 숨긴다 — 동작 열처럼 읽을 값이 아닌 열 */
    label: string;
    cell: (row: T) => React.ReactNode;
    /** 오른쪽으로 붙인다 — 동작 열 */
    right?: boolean;
    /**
     * 열 너비를 못 박는다 (`180px`·`22%` 등).
     *
     * **셀 안에서 편집이 열리는 표에는 반드시 준다.** 값(글자)이 드롭다운으로 바뀌면 폭이
     * 달라져서 브라우저가 열 너비를 다시 계산하고, 그 순간 다른 열까지 밀린다 —
     * 누른 버튼이 옆으로 도망간다.
     */
    width?: string;
  }[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  minWidth?: number;
}) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-[13.5px] text-slate-400">{empty}</p>;
  }

  // 너비를 정한 열이 있으면 `table-fixed`로 고정한다 — 안 그러면 브라우저가 내용에 맞춰
  // 다시 계산해서 못 박은 값이 무시된다
  const fixed = columns.some((c) => c.width);

  return (
    <div className="thin-scroll relative mt-1 overflow-x-auto">
      <table
        className={`w-full text-left text-sm ${fixed ? "table-fixed" : ""}`}
        style={{ minWidth }}
      >
        <thead>
          <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={`py-2.5 ${i === 0 ? "pr-3" : "px-3"} ${
                  c.right ? "text-right" : ""
                } ${i === columns.length - 1 ? "pl-3 pr-0" : ""}`}
              >
                {c.label || <span className="sr-only">동작</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors hover:bg-slate-50/70">
              {columns.map((c, i) => (
                <td
                  key={i}
                  className={`py-3 ${i === 0 ? "pr-3" : "px-3"} ${
                    c.right ? "text-right" : ""
                  } ${i === columns.length - 1 ? "pl-3 pr-0" : ""}`}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
