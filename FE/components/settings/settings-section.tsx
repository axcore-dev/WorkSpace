/**
 * 설정 화면의 구분선 섹션 — 카드를 쓰지 않는다 (DESIGN.md 「공용 컴포넌트」 `SettingsSection`).
 *
 * 섹션 제목 + 그 아래 실선, 행 사이 옅은 실선. 설정은 값을 읽고 고치는 목록이라 상자를
 * 겹치면 좌우 패딩이 매 섹션 들어가 담기는 행이 줄고, 왼쪽 이름과 오른쪽 버튼이 섹션마다
 * 다른 x좌표에서 시작한다.
 *
 * **간격·구분선 값은 이 파일 한 곳에만 있다.** 설정 화면이 클래스 문자열을 직접 쓰지 않게
 * 하려는 것이다 — 한 화면에서만 다르게 하고 싶어지면 그 화면에서 감싸고, 이 원시요소를
 * 바꾸지 않는다.
 *
 * `"use client"`를 붙이지 않는다 — 표현만 하는 컴포넌트라 서버에서 렌더해도 된다.
 */

export function SettingsSection({
  title,
  aside,
  children,
  className = "",
}: {
  title: React.ReactNode;
  /** 제목 오른쪽 — 개수, 채널 열 머리 등 */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2.5">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function SettingsRows({
  children,
  tight = false,
}: {
  children: React.ReactNode;
  /** 값만 나열하는 행 — 패딩을 한 단계 줄인다 */
  tight?: boolean;
}) {
  // 행은 「이름 — 값 — 버튼」이라 넓히면 이름과 버튼이 화면 양 끝으로 벌어져 눈이 가로로 멀리 이동한다.
  // 페이지 폭은 다섯 화면이 같은 값을 쓰고(`settings-shell`), 폭 제한은 그게 필요한 행이 진다.
  return <ul className={`max-w-3xl ${tight ? "[&>li]:py-2.5" : "[&>li]:py-3.5"}`}>{children}</ul>;
}

export function SettingsRow({ children }: { children: React.ReactNode }) {
  return <li className="border-b border-slate-100 last:border-b-0">{children}</li>;
}

/** 왼쪽 이름(+값), 오른쪽 동작 */
export function ActionRow({
  name,
  value,
  children,
}: {
  name: React.ReactNode;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-slate-900">{name}</p>
        {value && <p className="mt-0.5 text-xs text-slate-400">{value}</p>}
      </div>
      {children}
    </div>
  );
}

/** 왼쪽 라벨, 오른쪽 입력 */
export function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <label
        htmlFor={htmlFor}
        className="w-[132px] shrink-0 text-[13.5px] font-medium text-slate-600"
      >
        {label}
      </label>
      <div className="min-w-0 flex-1 md:max-w-[340px]">{children}</div>
    </div>
  );
}

/** 섹션 맨 아래 버튼 줄 */
export function SectionActions({
  children,
  spread = false,
}: {
  children: React.ReactNode;
  /** 양쪽으로 벌린다 (왼쪽 위험 동작 · 오른쪽 저장) */
  spread?: boolean;
}) {
  return (
    <div className={`flex items-center pt-4 ${spread ? "justify-between" : "justify-end"}`}>
      {children}
    </div>
  );
}
