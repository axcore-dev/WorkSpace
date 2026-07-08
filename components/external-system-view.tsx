import { IconExternalLink, IconLock } from "@/components/icons";
import type { EXTERNAL_SYSTEMS } from "@/data/org";

type ExternalSystem = (typeof EXTERNAL_SYSTEMS)[number];

/** 외부 시스템 임시 미리보기 — 이미지 대체 / IFrame 임베드 / 임베드 차단 시 로그인 안내 목업 */
export function ExternalSystemView({ system }: { system: ExternalSystem }) {
  const openUrl =
    system.embed.kind === "iframe" ? system.embed.src : system.embed.kind === "login" ? system.embed.href : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">{system.name}</h1>
          <p className="mt-0.5 truncate text-sm text-slate-500">{system.system} · 외부 시스템 연동</p>
        </div>
        {openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 transition-colors duration-200 hover:bg-slate-50"
          >
            <IconExternalLink size={15} />새 탭에서 열기
          </a>
        )}
      </header>

      <div className="min-h-0 flex-1 bg-slate-50">
        {system.embed.kind === "image" && (
          <div className="thin-scroll h-full overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={system.embed.src} alt={`${system.system} 화면`} className="mx-auto w-[90%] select-none" draggable={false} />
          </div>
        )}
        {system.embed.kind === "iframe" && (
          <iframe src={system.embed.src} title={`${system.system} 임베드`} className="h-full w-full border-0 bg-white" />
        )}
        {system.embed.kind === "login" && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <IconLock size={22} className="text-slate-300" />
            <a
              href={system.embed.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-700"
            >
              연동(로그인)이 필요해요
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
