"use client";

import { useEffect } from "react";
import { IconX } from "@/components/icons";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

/** 재사용 다이얼로그 — 상세/커넥터/초대 팝업 등에 공통 사용 */
export function Modal({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  size = "md",
  headerAccessory,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  desc?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof SIZES;
  headerAccessory?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        className={`relative flex max-h-[88vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
      >
        {(title || desc) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
              {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerAccessory}
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <IconX size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="thin-scroll flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-slate-100 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
