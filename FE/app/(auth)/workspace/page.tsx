"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPrimaryButton, AuthSplit } from "@/components/auth-shell";
import { Modal } from "@/components/modal";
import { Button, FIELD_LG, FIELD_LG_ERROR, maskEmail } from "@/components/ui";
import { IconChevronLeft, IconLogOut, IconMoreHorizontal } from "@/components/icons";
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

/**
 * 사업자등록번호 체크섬 — 국세청 검증식(가중치 1,3,7,1,3,7,1,3,5 + 9번째 자리×5의 십의 자리).
 * 형식만 맞는 임의의 10자리를 걸러낸다. 실제 사업자 존재·상태 확인은 BE에서 국세청 조회로 한다.
 */
function isValidBizNumber(d: string) {
  if (!/^\d{10}$/.test(d)) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * weights[i];
  sum += Math.floor((Number(d[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}

export default function WorkspaceCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<"lookup" | "confirm">("lookup");

  // 조회 단계
  const [by, setBy] = useState<LookupBy>("bizNumber");
  const [value, setValue] = useState("");

  // 생성 단계 — 조회 결과로 프리필하고, 세 값 모두 필수·수정 가능하다
  const [bizNumber, setBizNumber] = useState("");
  const [company, setCompany] = useState("");
  const [ceo, setCeo] = useState("");
  /** 조회로 찾은 회사인지 (false면 사용자가 직접 입력하는 첫 생성) */
  const [fromDirectory, setFromDirectory] = useState(false);

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

  // ── 조회 ──
  const field = LOOKUP.find((l) => l.id === by)!;
  const query = by === "bizNumber" ? digits(value) : value.trim();
  // 사업자등록번호는 10자리를 다 채웠을 때, 상호명은 2자부터 조회한다
  const ready = by === "bizNumber" ? query.length === 10 : query.length >= 2;
  const badChecksum = by === "bizNumber" && ready && !isValidBizNumber(query);
  // 데모: 첫 일치 항목만 쓴다 (후보 목록 UI는 실제 사업자 조회 API를 붙일 때)
  const org =
    ready && !badChecksum
      ? ORG_DIRECTORY.find((o) =>
          by === "bizNumber" ? digits(o.bizNumber) === query : o.name.includes(query),
        )
      : undefined;
  const blocked = !!org?.hasWorkspace;
  const unknown = ready && !badChecksum && !org;
  const canProceed = ready && !badChecksum && !blocked;

  function switchBy(next: LookupBy) {
    setBy(next);
    setValue("");
  }

  /** 조회 결과를 생성 단계로 넘긴다 — 못 찾은 회사는 로그인 계정 이름을 대표자 기본값으로 둔다 */
  function goConfirm() {
    if (!canProceed) return;
    setBizNumber(by === "bizNumber" ? formatBizNumber(value) : (org?.bizNumber ?? ""));
    setCompany(org?.name ?? (by === "name" ? value.trim() : ""));
    setCeo(org?.ceo ?? DEMO_USER.name);
    setFromDirectory(!!org);
    setStep("confirm");
  }

  // ── 생성 ──
  const bizDigits = digits(bizNumber);
  const bizOk = isValidBizNumber(bizDigits);
  // 10자리를 다 채운 뒤에만 에러로 본다 — 입력 중에 빨갛게 만들지 않는다
  const bizError = bizDigits.length === 10 && !bizOk;
  const canCreate = bizOk && !!company.trim() && !!ceo.trim();

  function create() {
    if (!canCreate) return;
    localStorage.setItem(
      "axpoint-workspace",
      JSON.stringify({ id: bizDigits, name: company.trim(), role: "관리자" }),
    );
    router.push("/dashboard");
  }

  function logout() {
    localStorage.removeItem("axpoint-user");
    router.push("/login");
  }

  return (
    <AuthSplit>
      {step === "confirm" && (
        <button
          type="button"
          onClick={() => setStep("lookup")}
          aria-label="조회 화면으로 돌아가기"
          className="mb-4 -ml-1.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800"
        >
          <IconChevronLeft size={19} />
        </button>
      )}

      {/* 로그인 계정 + 계정 메뉴 */}
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-xs text-slate-500">
          로그인 계정 <span className="font-medium text-slate-700">{DEMO_USER.email}</span>
        </p>
        {step === "lookup" && (
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
        )}
      </div>

      <h2 className="mt-2.5 text-[31px] font-bold leading-[1.25] tracking-tight text-slate-900">
        워크스페이스를 생성할게요
      </h2>

      {step === "lookup" ? (
        <>
          <p className="mt-2.5 text-[15px] text-slate-500">
            회사를 찾으면 사업자 정보를 확인해서 워크스페이스를 만들어요.
          </p>

          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              goConfirm();
            }}
          >
            <div className="flex items-center gap-5">
              {LOOKUP.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                >
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
              aria-invalid={badChecksum || blocked}
              inputMode={by === "bizNumber" ? "numeric" : "text"}
              className={`mt-3.5 ${badChecksum || blocked ? FIELD_LG_ERROR : FIELD_LG}`}
            />

            {badChecksum ? (
              <p className="mt-1.5 text-xs text-red-600">
                사업자등록번호를 다시 확인해주세요. 없는 번호예요.
              </p>
            ) : blocked && org ? (
              <p className="mt-1.5 text-xs leading-relaxed text-red-600">
                회사 관리자에게 초대를 요청해주세요. 이미 워크스페이스를 만든 회사예요.
                <br />
                (관리자 이메일: {org.adminEmail ? maskEmail(org.adminEmail) : "확인 불가"})
              </p>
            ) : unknown ? (
              <p className="mt-1.5 text-xs leading-relaxed text-amber-600">
                아직 등록되지 않은 회사예요. 다음 단계에서 사업자등록증의 정보를 직접 입력하면
                만들 수 있어요.
              </p>
            ) : null}

            {org && !blocked && (
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

            <AuthPrimaryButton type="submit" disabled={!canProceed} className="mt-5">
              다음
            </AuthPrimaryButton>
          </form>
        </>
      ) : (
        <form
          className="mt-7"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          {!fromDirectory && (
            <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-amber-700">
              조회되지 않은 회사예요. 사업자등록증에 적힌 대로 입력해주세요. 생성 후 사업자등록증
              확인 절차가 진행됩니다.
            </p>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="ws-biz" className="mb-2 block text-sm font-medium text-slate-700">
                사업자등록번호 <span className="text-red-500">*</span>
              </label>
              <input
                id="ws-biz"
                value={bizNumber}
                onChange={(e) => setBizNumber(formatBizNumber(e.target.value))}
                placeholder="000-00-00000"
                inputMode="numeric"
                aria-invalid={bizError}
                className={bizError ? FIELD_LG_ERROR : FIELD_LG}
              />
              {bizError ? (
                <p className="mt-1.5 text-xs text-red-600">
                  사업자등록번호를 다시 확인해주세요. 없는 번호예요.
                </p>
              ) : (
                !bizOk && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    사업자등록번호 10자리를 입력해주세요. 워크스페이스는 사업자번호 하나당 하나예요.
                  </p>
                )
              )}
            </div>

            <div>
              <label htmlFor="ws-company" className="mb-2 block text-sm font-medium text-slate-700">
                회사 이름 (상호) <span className="text-red-500">*</span>
              </label>
              <input
                id="ws-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="(주)회사명"
                className={FIELD_LG}
              />
            </div>

            <div>
              <label htmlFor="ws-ceo" className="mb-2 block text-sm font-medium text-slate-700">
                대표자 이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="ws-ceo"
                value={ceo}
                onChange={(e) => setCeo(e.target.value)}
                placeholder="홍길동"
                className={FIELD_LG}
              />
              {!fromDirectory && (
                <p className="mt-1.5 text-xs text-slate-500">
                  로그인 계정 이름으로 채웠어요. 대표자가 다르면 고쳐주세요.
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">법인(신용)정보 수집·이용 동의</p>
            <button
              type="button"
              onClick={() => setConsentOpen(true)}
              className="cursor-pointer text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors duration-150 hover:text-slate-900"
            >
              보기
            </button>
          </div>

          <AuthPrimaryButton type="submit" disabled={!canCreate} className="mt-4">
            동의하고 생성하기
          </AuthPrimaryButton>
        </form>
      )}

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
