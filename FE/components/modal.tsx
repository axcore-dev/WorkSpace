"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { IconX } from "@/components/icons";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

/** Tab 이 도는 범위 — 비활성 컨트롤과 `tabindex="-1"` 은 뺀다 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 재사용 다이얼로그 — 상세/커넥터/초대 팝업 등에 공통 사용.
 *
 * 키 처리는 document 가 아니라 다이얼로그 패널에서 한다 — 안에 든 콤보박스(`MultiPicker`)가 목록을 닫는 ESC 를
 * 자기 자리에서 멈출 수 있어야 한다. document 리스너였을 때는 ESC 한 번에 목록과 모달이 같이 닫혀
 * 「작성 중인 발주서를 버릴까요?」 가 떴다. 열리면 포커스가 안으로 들어오고(`autoFocus` 필드가 있으면 그것,
 * 없으면 패널), Tab 은 패널 안에서 돌고, 닫히면 열었던 요소로 돌아간다.
 */
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
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // 열릴 때 열기 전 포커스를 기억하고 안으로 들여온다. 닫힐 때 그 자리로 돌려 준다 — 행을 눌러 연 팝업을
  // 닫으면 그 행에 포커스가 남아 키보드로 다음 행으로 갈 수 있다
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  }, [open]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const panel = panelRef.current;
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const current = document.activeElement;
    if (e.shiftKey && (current === first || current === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && current === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`relative flex max-h-[88vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl focus:outline-none`}
      >
        {(title || desc) && (
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-base font-bold text-slate-900">
                  {title}
                </h2>
              )}
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
        {footer && <div className="border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
