"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import {
  Button,
  Card,
  FIELD,
  FIELD_ERROR,
  SectionHeader,
  isPersonalEmail,
  maskEmail,
} from "@/components/ui";
import { IconCheckCircle, IconChevronLeft } from "@/components/icons";
import { CONSENT_TEXT, ORG_DIRECTORY } from "@/data/org";

const LOOKUP = [
  { id: "bizNumber", label: "사업자등록번호", aria: "사업자등록번호로 조회", placeholder: "사업자등록번호 10자리" },
  { id: "name", label: "상호명", aria: "상호명으로 조회", placeholder: "상호명" },
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

/** 라벨 + 필수 표시 + 입력 한 줄 */
function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  error = false,
  hint,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  hint?: React.ReactNode;
  inputMode?: "numeric" | "email" | "text";
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={error}
        className={error ? FIELD_ERROR : FIELD}
      />
      {hint}
    </div>
  );
}

export default function AdminWorkspaceCreatePage() {
  const [step, setStep] = useState<"lookup" | "confirm" | "done">("lookup");

  // 조회
  const [by, setBy] = useState<LookupBy>("bizNumber");
  const [value, setValue] = useState("");

  // 개설 정보 — 조회 결과로 프리필하고 전부 필수·수정 가능
  const [bizNumber, setBizNumber] = useState("");
  const [company, setCompany] = useState("");
  const [ceo, setCeo] = useState("");
  /** 고객사 담당자 — 개설 후 이 주소로 최초 관리자 초대가 나간다 */
  const [ownerEmail, setOwnerEmail] = useState("");
  const [consentSigned, setConsentSigned] = useState(false);
  const [fromDirectory, setFromDirectory] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  // ── 조회 ──
  const field = LOOKUP.find((l) => l.id === by)!;
  const query = by === "bizNumber" ? digits(value) : value.trim();
  const ready = by === "bizNumber" ? query.length === 10 : query.length >= 2;
  const badChecksum = by === "bizNumber" && ready && !isValidBizNumber(query);
  // 데모: 첫 일치 항목만 쓴다 (후보 목록 UI는 실제 사업자 조회 API를 붙일 때)
  const org =
    ready && !badChecksum
      ? ORG_DIRECTORY.find((o) =>
          by === "bizNumber" ? digits(o.bizNumber) === query : o.name.includes(query),
        )
      : undefined;
  const taken = !!org?.hasWorkspace;
  const unknown = ready && !badChecksum && !org;
  const canProceed = ready && !badChecksum && !taken;

  function switchBy(next: LookupBy) {
    setBy(next);
    setValue("");
  }

  function goConfirm() {
    if (!canProceed) return;
    setBizNumber(by === "bizNumber" ? formatBizNumber(value) : (org?.bizNumber ?? ""));
    setCompany(org?.name ?? (by === "name" ? value.trim() : ""));
    setCeo(org?.ceo ?? "");
    setFromDirectory(!!org);
    setStep("confirm");
  }

  // ── 개설 ──
  const bizDigits = digits(bizNumber);
  const bizOk = isValidBizNumber(bizDigits);
  const bizError = bizDigits.length === 10 && !bizOk;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim());
  const emailError = ownerEmail.trim().length > 0 && !emailOk;
  const canCreate = bizOk && !!company.trim() && !!ceo.trim() && emailOk && consentSigned;

  function create() {
    if (!canCreate) return;
    // 데모: BE 개설 API + 초대 메일 발송 자리
    setStep("done");
  }

  function reset() {
    setStep("lookup");
    setBy("bizNumber");
    setValue("");
    setBizNumber("");
    setCompany("");
    setCeo("");
    setOwnerEmail("");
    setConsentSigned(false);
    setFromDirectory(false);
  }

  if (step === "done") {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">워크스페이스 개설</h1>
        <Card className="mt-5">
          <div className="flex items-start gap-3">
            <IconCheckCircle size={20} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-slate-900">
                워크스페이스를 개설했어요
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                <span className="font-medium text-slate-700">{ownerEmail.trim()}</span> 주소로 최초
                관리자 초대 메일을 보냈어요. 고객사 담당자가 링크를 열면 워크스페이스로 들어갈 수
                있어요.
              </p>
            </div>
          </div>

          <dl className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            {[
              { k: "상호", v: company.trim() },
              { k: "사업자번호", v: bizNumber },
              { k: "대표자", v: ceo.trim() },
              { k: "담당자", v: ownerEmail.trim() },
            ].map((row) => (
              <div key={row.k} className="flex gap-3 text-sm">
                <dt className="w-20 shrink-0 text-slate-400">{row.k}</dt>
                <dd className="min-w-0 font-medium text-slate-900">{row.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5">
            <Button onClick={reset}>다음 의뢰 처리하기</Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">워크스페이스 개설</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        계약이 확정된 고객사의 워크스페이스를 개설하고 담당자를 최초 관리자로 초대해요.
      </p>

      {step === "lookup" ? (
        <Card className="mt-5">
          <SectionHeader title="1. 고객사 조회" desc="사업자등록번호 또는 상호명으로 찾아요." />

          <form
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
              aria-label={field.aria}
              aria-invalid={badChecksum || taken}
              inputMode={by === "bizNumber" ? "numeric" : "text"}
              className={`mt-3 ${badChecksum || taken ? FIELD_ERROR : FIELD}`}
            />

            {badChecksum ? (
              <p className="mt-1.5 text-xs text-red-600">
                사업자등록번호를 다시 확인해주세요. 없는 번호예요.
              </p>
            ) : taken && org ? (
              <p className="mt-1.5 text-xs leading-relaxed text-red-600">
                이미 워크스페이스가 있는 고객사예요. 담당 관리자
                {org.adminEmail ? ` (${maskEmail(org.adminEmail)})` : ""}에게 초대를 요청하도록
                안내해주세요.
              </p>
            ) : unknown ? (
              <p className="mt-1.5 text-xs leading-relaxed text-amber-600">
                조회되지 않는 사업자예요. 계약서·사업자등록증의 정보를 다음 단계에서 직접
                입력해주세요.
              </p>
            ) : null}

            {org && !taken && (
              <dl className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                {[
                  { k: "상호", v: org.name },
                  { k: "대표자", v: org.ceo },
                  { k: "사업장", v: org.address },
                ].map((row) => (
                  <div key={row.k} className="flex gap-3 text-sm">
                    <dt className="w-16 shrink-0 text-slate-400">{row.k}</dt>
                    <dd className="min-w-0 font-medium text-slate-900">{row.v}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-5">
              <Button type="submit" disabled={!canProceed}>
                다음
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="mt-5">
          <button
            type="button"
            onClick={() => setStep("lookup")}
            className="mb-3 -ml-1 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1 py-0.5 text-xs font-medium text-slate-500 transition-colors duration-150 hover:text-slate-800"
          >
            <IconChevronLeft size={14} />
            조회로 돌아가기
          </button>

          <SectionHeader
            title="2. 개설 정보 확인"
            desc="계약서·사업자등록증과 같은지 확인하고 개설해요."
          />

          {!fromDirectory && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-amber-700">
              조회되지 않은 사업자예요. 사업자등록증에 적힌 대로 입력해주세요.
            </p>
          )}

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <Field
              id="adm-biz"
              label="사업자등록번호"
              value={bizNumber}
              onChange={(v) => setBizNumber(formatBizNumber(v))}
              placeholder="000-00-00000"
              inputMode="numeric"
              error={bizError}
              hint={
                bizError ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    사업자등록번호를 다시 확인해주세요. 없는 번호예요.
                  </p>
                ) : (
                  !bizOk && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      사업자번호 하나당 워크스페이스는 하나예요.
                    </p>
                  )
                )
              }
            />

            <Field
              id="adm-company"
              label="회사 이름 (상호)"
              value={company}
              onChange={setCompany}
              placeholder="(주)회사명"
            />

            <Field
              id="adm-ceo"
              label="대표자 이름"
              value={ceo}
              onChange={setCeo}
              placeholder="홍길동"
            />

            <Field
              id="adm-owner"
              label="고객사 담당자 이메일 (최초 관리자)"
              value={ownerEmail}
              onChange={setOwnerEmail}
              placeholder="name@company.co.kr"
              inputMode="email"
              error={emailError}
              hint={
                emailError ? (
                  <p className="mt-1.5 text-xs text-red-600">이메일 형식으로 입력해주세요.</p>
                ) : isPersonalEmail(ownerEmail) ? (
                  <p className="mt-1.5 text-xs text-amber-600">
                    개인 메일 주소예요. 회사에서 발급한 업무용 이메일을 받아주세요.
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-500">
                    이 주소로 최초 관리자 초대 메일이 나가요.
                  </p>
                )
              }
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={consentSigned}
                    onChange={(e) => setConsentSigned(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-slate-800"
                  />
                  <span className="text-sm text-slate-600">
                    계약서로 법인(신용)정보 수집·이용 동의를 받았어요.
                    <span className="text-red-500"> *</span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setConsentOpen(true)}
                  className="shrink-0 cursor-pointer text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors duration-150 hover:text-slate-900"
                >
                  보기
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" disabled={!canCreate}>
                워크스페이스 개설하기
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                초기화
              </Button>
            </div>
          </form>
        </Card>
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
    </>
  );
}
