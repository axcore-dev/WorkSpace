"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPrimaryButton, AuthSplit } from "@/components/auth-shell";
import { Modal } from "@/components/modal";
import { Button, FIELD_LG, FIELD_LG_ERROR, maskEmail } from "@/components/ui";
import { IconLogOut, IconMoreHorizontal } from "@/components/icons";
import { CONSENT_TEXT, DEMO_USER, ORG_DIRECTORY } from "@/data/org";

const LOOKUP = [
  { id: "bizNumber", label: "사업자등록번호로 찾기", placeholder: "사업자등록번호 10자리" },
  { id: "name", label: "상호명으로 찾기", placeholder: "상호명" },
] as const;

type LookupBy = (typeof LOOKUP)[number]["id"];

const digits = (v: string) => v.replace(/\D/g, "");

/** 사업자등록번호 3-2-5 하이픈 — 입력 중에는 찍힌 자릿수만큼만 붙인다 */
function formatBizNumber(v: string) {
  const d = digits(v).slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export default function WorkspaceCreatePage() {
  const router = useRouter();
  const [by, setBy] = useState<LookupBy>("bizNumber");
  const [value, setValue] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const field = LOOKUP.find((l) => l.id === by)!;
  const query = by === "bizNumber" ? digits(value) : value.trim();
  // 사업자등록번호는 10자리를 다 채웠을 때, 상호명은 2자부터 조회한다
  const ready = by === "bizNumber" ? query.length === 10 : query.length >= 2;
  // 데모: 첫 일치 항목만 쓴다 (후보 목록 UI는 실제 사업자 조회 API를 붙일 때)
  const org = ready
    ? ORG_DIRECTORY.find((o) =>
        by === "bizNumber" ? digits(o.bizNumber) === query : o.name.includes(query),
      )
    : undefined;
  const blocked = !!org?.hasWorkspace;
  const error = ready && (!org || blocked);
  const canCreate = !!org && !blocked;

  function switchBy(next: LookupBy) {
    setBy(next);
    setValue("");
  }

  function create() {
    if (!org || blocked) return;
    localStorage.setItem(
      "axpoint-workspace",
      JSON.stringify({ id: org.bizNumber, name: org.name, role: "관리자" }),
    );
    router.push("/dashboard");
  }

  function logout() {
    localStorage.removeItem("axpoint-user");
    router.push("/login");
  }

  return (
    <AuthSplit>
      {/* 로그인 계정 + 계정 메뉴 */}
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs text-slate-500">
          로그인 계정 <span className="font-medium text-slate-700">{DEMO_USER.email}</span>
        </p>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="계정 메뉴"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600"
          >
            <IconMoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-40 mt-1.5 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={logout}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900"
              >
                <IconLogOut size={14} className="rotate-180" />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>

      <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
        워크스페이스를 생성할게요
      </h2>
      <p className="mt-2.5 text-[15px] text-slate-500">
        회사를 찾으면 사업자 정보를 확인해서 워크스페이스를 만들어요.
      </p>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <div className="flex items-center gap-5">
          {LOOKUP.map((l) => (
            <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="lookup-by"
                checked={by === l.id}
                onChange={() => switchBy(l.id)}
                className="h-4 w-4 accent-slate-800"
              />
              {l.label}
            </label>
          ))}
        </div>

        <input
          value={value}
          onChange={(e) =>
            setValue(by === "bizNumber" ? formatBizNumber(e.target.value) : e.target.value)
          }
          placeholder={field.placeholder}
          aria-label={field.label}
          aria-invalid={error}
          inputMode={by === "bizNumber" ? "numeric" : "text"}
          className={`mt-3.5 ${error ? FIELD_LG_ERROR : FIELD_LG}`}
        />

        {blocked && org ? (
          <p className="mt-1.5 text-xs leading-relaxed text-red-600">
            회사 관리자에게 초대를 요청해주세요. 이미 워크스페이스를 만든 회사예요.
            <br />
            (관리자 이메일: {org.adminEmail ? maskEmail(org.adminEmail) : "확인 불가"})
          </p>
        ) : ready && !org ? (
          <p className="mt-1.5 text-xs text-red-600">
            {by === "bizNumber" ? "사업자등록번호" : "상호명"}를 다시 확인해주세요. 등록된 회사 정보를
            찾지 못했어요.
          </p>
        ) : null}

        {canCreate && org && (
          <dl className="mt-3.5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            {[
              { k: "상호", v: org.name },
              { k: "대표자", v: org.ceo },
              { k: "사업장", v: org.address },
            ].map((row) => (
              <div key={row.k} className="flex gap-3 text-sm">
                <dt className="w-12 shrink-0 text-slate-400">{row.k}</dt>
                <dd className="min-w-0 font-medium text-slate-900">{row.v}</dd>
              </div>
            ))}
          </dl>
        )}

        {ready && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">법인(신용)정보 수집·이용 동의</p>
            <button
              type="button"
              onClick={() => setConsentOpen(true)}
              className="cursor-pointer text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors duration-150 hover:text-slate-900"
            >
              보기
            </button>
          </div>
        )}

        <AuthPrimaryButton type="submit" disabled={!canCreate} className="mt-4">
          동의하고 생성하기
        </AuthPrimaryButton>
      </form>

      <Modal
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        size="md"
        title={CONSENT_TEXT.title}
        desc={CONSENT_TEXT.version}
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setConsentOpen(false)}>
              닫기
            </Button>
          </div>
        }
      >
        <dl className="space-y-4 p-5">
          {CONSENT_TEXT.sections.map((s) => (
            <div key={s.heading}>
              <dt className="text-sm font-semibold text-slate-900">{s.heading}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-500">{s.body}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </AuthSplit>
  );
}
