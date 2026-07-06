"use client";

import { useEffect } from "react";
import { IconShield, IconSettings, IconUser, IconX } from "@/components/icons";
import { AccountSettings } from "@/components/settings/account-settings";
import { AdminSettings } from "@/components/settings/admin-settings";
import { WorkspaceSettings } from "@/components/settings/workspace-settings";

export type SettingsTab = "account" | "admin" | "workspace";

const TABS: { id: SettingsTab; label: string; icon: typeof IconUser }[] = [
  { id: "account", label: "계정", icon: IconUser },
  { id: "admin", label: "관리", icon: IconShield },
  { id: "workspace", label: "설정", icon: IconSettings },
];

export function SettingsModal({
  open,
  tab,
  onTab,
  onClose,
}: {
  open: boolean;
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
  onClose: () => void;
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="설정 및 관리"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">설정 및 관리</h2>
            <p className="mt-0.5 text-xs text-slate-500">계정·권한·워크스페이스 설정을 한 곳에서 관리합니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 border-b border-slate-100 px-4" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTab(t.id)}
                className={`-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3.5 py-3 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* 내용 */}
        <div className="thin-scroll flex-1 overflow-y-auto bg-slate-50 p-6">
          {tab === "account" && <AccountSettings />}
          {tab === "admin" && <AdminSettings />}
          {tab === "workspace" && <WorkspaceSettings />}
        </div>
      </div>
    </div>
  );
}
