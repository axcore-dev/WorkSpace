"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { Button, FIELD, Toggle } from "@/components/ui";
import { IconCheckCircle, IconShield } from "@/components/icons";
import { MODULES } from "@/data/modules";

const ROLES = ["일반 사용자", "생산 관리자", "품질 관리자", "설비 관리자", "구매 담당", "공장장"];
const DEPTS = ["생산본부", "품질관리팀", "설비보전팀", "경영지원본부", "구매자재팀", "영업본부", "고객지원팀"];

/**
 * 구성원 초대 팝업 (RBAC).
 * - 관리자: 모든 기능을 부여 가능.
 * - 팀장: 관리자에게 위임받은 기능 범위 내에서만 부여 가능(데모에서 관점 전환으로 시연).
 */
export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [asTeamLead, setAsTeamLead] = useState(false);
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState(DEPTS[0]);
  const [role, setRole] = useState(ROLES[0]);
  const [granted, setGranted] = useState<string[]>(["management", "inventory", "sales"]);
  const [sent, setSent] = useState(false);

  // 팀장이 위임받은(부여 가능한) 기능 범위 — 데모: 3개
  const delegatable = new Set(["management", "inventory", "sales"]);

  function close() {
    setSent(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="구성원 초대"
      desc="이메일로 초대하고 사용할 수 있는 기능을 지정합니다."
      footer={
        !sent && (
          <div className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
              <Toggle size="sm" checked={asTeamLead} onChange={setAsTeamLead} label="팀장 관점 미리보기" />
              팀장 관점 미리보기
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>
                취소
              </Button>
              <Button onClick={() => setSent(true)} disabled={!email}>
                초대 보내기
              </Button>
            </div>
          </div>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <IconCheckCircle size={40} className="text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-slate-900">초대를 보냈습니다</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {email || "구성원"} 님에게 초대 메일을 발송했습니다.
            <br />
            수락 시 지정한 기능으로 워크스페이스에 참여합니다.
          </p>
          <Button className="mt-5" onClick={close}>
            확인
          </Button>
        </div>
      ) : (
        <div className="space-y-5 p-5">
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
            <IconShield size={14} className="mt-0.5 shrink-0 text-slate-400" />
            {asTeamLead
              ? "팀장 계정입니다. 관리자에게 위임받은 기능(경영지원·재고·물류·영업관리) 범위 내에서만 부여할 수 있어요."
              : "관리자 계정입니다. 모든 기능을 부여할 수 있어요. 초대는 관리자·팀장만 가능합니다."}
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label htmlFor="inv-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@democompany.co.kr"
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="inv-dept" className="mb-1.5 block text-sm font-medium text-slate-700">
                부서
              </label>
              <select id="inv-dept" value={dept} onChange={(e) => setDept(e.target.value)} className={`${FIELD} cursor-pointer`}>
                {DEPTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="inv-role" className="mb-1.5 block text-sm font-medium text-slate-700">
                역할
              </label>
              <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value)} className={`${FIELD} cursor-pointer`}>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">활성화할 기능 (동작 권한)</p>
            <p className="mt-0.5 text-xs text-slate-400">이 구성원이 사용할 수 있는 기능을 선택하세요.</p>
            <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {MODULES.map((mod) => {
                const allowed = !asTeamLead || delegatable.has(mod.slug);
                const on = granted.includes(mod.slug) && allowed;
                return (
                  <li key={mod.slug} className="flex items-center justify-between gap-2">
                    <span className={`text-sm ${allowed ? "text-slate-700" : "text-slate-300"}`}>
                      {mod.name}
                      {!allowed && <span className="ml-1.5 text-[11px] text-slate-300">위임 범위 밖</span>}
                    </span>
                    <Toggle
                      size="sm"
                      disabled={!allowed}
                      checked={on}
                      onChange={(v) =>
                        setGranted((prev) => (v ? [...prev, mod.slug] : prev.filter((x) => x !== mod.slug)))
                      }
                      label={`${mod.name} 기능 부여`}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
