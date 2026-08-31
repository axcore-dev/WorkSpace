import Link from "next/link";

/**
 * 운영자 콘솔 상단 경로. 마지막 항목이 현재 화면이라 링크를 걸지 않는다.
 * 콘솔은 목록 → 상세 → 탭으로 들어가는 깊이가 있어서 뒤로가기 링크 하나보다 경로가 낫다.
 */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="현재 위치" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          {item.href ? (
            <Link href={item.href} className="transition-colors duration-150 hover:text-slate-700">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-500">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
