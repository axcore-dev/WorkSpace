"use client";

/**
 * 계정 보안이 여는 모달들.
 *
 * `PasswordModal`·`OtpEnrollModal`은 옛 `account-settings.tsx`에서 그대로 옮겨 왔다 —
 * 비밀번호 규칙 검증과 OTP 타이머를 새로 쓰지 않았다.
 *
 * **BE에 실제로 있는 것과 없는 것** (`docs/be/account-api-postman-test.md`):
 * - 있음: `POST /api/auth/password`(현재 비밀번호를 묻는다) · `password/reset-request`·`/reset`
 *   (메일 흐름) · `mfa/methods`·`mfa/email`·`/confirm`·`DELETE mfa/email` · `email/verify-request`
 * - 없음: SMS OTP · TOTP · 패스키 · 추가 이메일 · 소셜 연동 해제
 *
 * 이번 범위는 화면까지다. 전부 더미로 두고 BE에 없는 것은 **버튼을 비활성**으로 둔다.
 */

import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { IconCheck, IconCheckCircle, IconEye, IconEyeOff, IconKey, IconLock, IconMail, IconRefresh, IconShield, IconSmartphone, IconX } from "@/components/icons";
import { Badge, Button, FIELD, FIELD_ERROR } from "@/components/ui";
import { PROVIDER_LABELS } from "@/lib/auth";
import { isEmailShape } from "@/data/invite";
import { ACCOUNT_EMAILS, DEMO_USER, SOCIAL_LOGINS } from "@/data/org";

/**
 * 비밀번호 입력 세 칸이 테두리 하나를 나눠 쓰므로 칸에는 테두리를 주지 않는다.
 * `FIELD`를 쓰면 상자가 세 개 겹친다.
 */
const PW_CELL =
  "block w-full bg-transparent px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-500";

export type TfaId = "email" | "sms" | "totp";

/** `sentTo` — 발송 대상 뒤에 붙는 조사. 이메일 주소·번호에 조사를 직접 붙이면 어긋난다 */
export const TFA_METHODS: { id: TfaId; name: string; desc: string; sentTo?: string }[] = [
  { id: "email", name: "이메일 OTP", desc: "로그인 시 이메일로 6자리 코드 발송", sentTo: "주소로" },
  { id: "sms", name: "SMS OTP", desc: "휴대전화 문자로 인증 코드 발송", sentTo: "번호로" },
  { id: "totp", name: "Google Authenticator", desc: "인증 앱 기반 TOTP" },
];

/** 수단마다 아이콘 하나 — 세 줄이 글자만이면 어느 게 앱이고 어느 게 문자인지 안 읽힌다 */
const METHOD_ICON: Record<TfaId, typeof IconMail> = {
  email: IconMail,
  sms: IconSmartphone,
  totp: IconRefresh,
};

/** 데모 검증 코드 — BE 연동 시 서버가 발송·검증한다 (코드는 서버에만 존재해야 한다) */
const DEMO_OTP = "123456";
const OTP_TTL_SEC = 180;

export type TfaState = Record<TfaId, boolean>;

/**
 * 이메일 OTP는 유일한 복구 수단이라 **가장 먼저 등록해야** 한다.
 * 이메일을 끄면 나머지 수단도 함께 꺼진다 — 계정이 잠기는 조합을 만들지 않는다.
 */
export function applyTfa(tfa: TfaState, id: TfaId, on: boolean): TfaState {
  if (id === "email" && !on) return { email: false, sms: false, totp: false };
  return { ...tfa, [id]: on };
}

/**
 * 비밀번호 변경 팝업 — Assisted Password Confirmation:
 * 규칙 충족 여부와 확인 입력 일치를 실시간으로 보여준다.
 *
 * **현재 비밀번호를 묻는다** (`POST /api/auth/password`). 로그인된 상태에서 이 확인을 빼면
 * 세션이나 메일이 탈취됐을 때 그대로 계정을 잃는다.
 *
 * 예전에는 「비밀번호를 잊었어요」로 메일 코드를 받는 두 번째 흐름이 있었는데 뺐다
 * (수정요청 v12). 잊은 사람은 로그아웃 뒤 로그인 화면의 재설정으로 간다 — 같은 BE
 * 엔드포인트(`password/reset-request` + `/reset`)를 그쪽이 이미 쓴다.
 *
 * 입력 세 칸은 테두리를 공유한다. 칸마다 상자를 그리면 "신원 확인"과 "새 비밀번호"가
 * 같은 무게로 보여서, 세 칸이 한 덩어리라는 게 안 읽힌다.
 *
 * **검증은 전부 BE 소관이다.** 여기서는 입력 형식만 본다 — 자체 해시·검증 로직을 만들지
 * 않는다 (루트 CLAUDE.md AI 보안 지침).
 */
export function PasswordModal({
  open,
  onClose,
  onDone,
  hasPassword = true,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
  /**
   * 비밀번호가 없는 계정(소셜로만 가입)이면 **현재 비밀번호를 묻지 않는다.**
   * 물어봐야 댈 것이 없고, 빈 칸을 채우라고 요구하면 아무도 못 넘어간다.
   */
  hasPassword?: boolean;
}) {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  const rules = [
    { label: "영문 포함", ok: /[a-zA-Z]/.test(pw) },
    { label: "숫자 포함", ok: /\d/.test(pw) },
    { label: "특수문자 포함", ok: /[^a-zA-Z0-9]/.test(pw) },
    { label: "8~16자리", ok: pw.length >= 8 && pw.length <= 16 },
  ];
  const valid = rules.every((r) => r.ok);
  const match = pw2.length > 0 && pw === pw2;
  const canSubmit = (!hasPassword || !!cur) && valid && match;

  const verb = hasPassword ? "변경" : "추가";

  function close() {
    setCur("");
    setPw("");
    setPw2("");
    setShow(false);
    setDone(false);
    onClose();
  }

  function submit() {
    setDone(true);
    onDone(hasPassword ? "비밀번호를 바꿨어요" : "비밀번호를 추가했어요");
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={`비밀번호 ${verb}`}
      footer={
        !done && (
          <div className="flex justify-end gap-2">
            {/* 헤더 (x)가 이미 닫기다. 여기 남기는 건 「취소」 — 쓰다 만 입력을 버린다는 뜻이라
                단순히 닫는 것과 다르다 */}
            <Button variant="secondary" onClick={close}>
              취소
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={submit}
              title={canSubmit ? undefined : `모든 조건을 충족하면 ${verb}할 수 있어요`}
            >
              <IconKey size={15} />
              비밀번호 {verb}
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <IconCheckCircle size={40} className="text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            비밀번호를 {verb}했어요
          </p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            다음 로그인부터 새 비밀번호를 사용해 주세요. 모든 기기에서 다시 로그인해야 합니다.
          </p>
          <Button className="mt-5" onClick={close}>
            확인
          </Button>
        </div>
      ) : (
        <div className="p-5">
          {/* 세 칸이 테두리 하나를 나눠 쓴다 — 사이는 옅은 실선만 (수정요청 v12).
              라벨은 placeholder로 대신하고 스크린리더용 label을 따로 둔다. */}
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-300 focus-within:border-slate-400">
            {hasPassword && (
              <div>
                <label htmlFor="pwm-cur" className="sr-only">
                  현재 비밀번호
                </label>
                <input
                  id="pwm-cur"
                  type="password"
                  autoComplete="current-password"
                  placeholder="현재 비밀번호"
                  value={cur}
                  onChange={(e) => setCur(e.target.value)}
                  className={PW_CELL}
                />
              </div>
            )}

            <div className="relative">
              <label htmlFor="pwm-new" className="sr-only">
                새 비밀번호
              </label>
              <input
                id="pwm-new"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="새 비밀번호"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className={`${PW_CELL} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "비밀번호 숨기기" : "비밀번호 표시"}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>

            <div>
              <label htmlFor="pwm-new2" className="sr-only">
                새 비밀번호 확인
              </label>
              <input
                id="pwm-new2"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="새 비밀번호 확인"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                aria-describedby="pwm-match"
                className={PW_CELL}
              />
            </div>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            영문, 숫자, 특수문자를 포함하여 8~16자리 입력해 주세요.
          </p>

          {pw.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {rules.map((r) => (
                <li
                  key={r.label}
                  className={`inline-flex items-center gap-1 text-xs ${r.ok ? "text-emerald-600" : "text-slate-400"}`}
                >
                  {r.ok ? <IconCheck size={12} /> : <IconX size={12} />}
                  {r.label}
                </li>
              ))}
            </ul>
          )}

          {pw2.length > 0 && (
            <p
              id="pwm-match"
              className={`mt-2 inline-flex items-center gap-1 text-xs ${match ? "text-emerald-600" : "text-red-600"}`}
            >
              {match ? <IconCheck size={12} /> : <IconX size={12} />}
              {match ? "새 비밀번호와 일치해요" : "새 비밀번호와 일치하지 않아요"}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * 2단계 인증 등록 팝업 — 발송된 6자리를 확인해야 수단이 켜진다.
 * 부모가 `key={method.id}`로 마운트하므로 열릴 때마다 타이머·입력이 초기화된다.
 */
export function OtpEnrollModal({
  method,
  target,
  onClose,
  onVerified,
}: {
  method: (typeof TFA_METHODS)[number];
  target: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [left, setLeft] = useState(OTP_TTL_SEC);
  const [resent, setResent] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [done]);

  const expired = left === 0;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  function verify() {
    if (expired) {
      setError("코드가 만료됐어요. 코드를 다시 받아 주세요.");
      return;
    }
    if (code !== DEMO_OTP) {
      setError("코드가 일치하지 않아요. 다시 입력하거나 코드를 다시 받아 주세요.");
      return;
    }
    setError("");
    setDone(true);
  }

  function resend() {
    setResent(true);
    setLeft(OTP_TTL_SEC);
    setCode("");
    setError("");
    setTimeout(() => setResent(false), 2200);
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`${method.name} 등록`}
      footer={
        !done && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button disabled={code.length !== 6} onClick={verify} title={code.length === 6 ? undefined : "6자리를 모두 입력해 주세요"}>
              <IconShield size={15} />
              확인하고 등록
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <IconCheckCircle size={40} className="text-emerald-600" />
          {/* 이름 뒤에 조사를 붙이지 않는다 — 수단 이름이 바뀌면 조사가 어긋난다 */}
          <p className="mt-3 text-sm font-semibold text-slate-900">{method.name} 등록을 마쳤어요</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            다음 로그인부터 2단계 인증을 거칩니다.
          </p>
          <Button className="mt-5" onClick={onVerified}>
            확인
          </Button>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <p className="flex items-start gap-2.5 text-sm leading-[1.6] text-slate-600">
            {method.sentTo ? (
              <IconMail size={16} className="mt-0.5 shrink-0 text-slate-400" />
            ) : (
              <IconKey size={16} className="mt-0.5 shrink-0 text-slate-400" />
            )}
            <span>
              {method.sentTo ? (
                <>
                  <span className="font-semibold text-slate-900">{target}</span> {method.sentTo} 6자리
                  코드를 보냈어요. 아래에 입력하면 등록이 끝납니다.
                </>
              ) : (
                "인증 앱에 표시된 6자리 코드를 입력하면 등록이 끝납니다."
              )}
            </span>
          </p>

          <div>
            <label htmlFor="otp-code" className="mb-1.5 block text-sm font-medium text-slate-700">
              인증 코드 6자리
            </label>
            <input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "otp-error" : "otp-hint"}
              className={`${error ? FIELD_ERROR : FIELD} text-center text-lg font-semibold tracking-[0.4em] tabular-nums`}
            />
            {error ? (
              <p id="otp-error" className="mt-1.5 text-xs text-red-600">
                {error}
              </p>
            ) : (
              <p id="otp-hint" className="mt-1.5 text-xs text-slate-400">
                데모 코드는 {DEMO_OTP} 입니다.
              </p>
            )}
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3"
            role="status"
            aria-live="polite"
          >
            <span className="text-xs text-slate-600">
              {expired ? (
                "코드가 만료됐어요."
              ) : (
                <>
                  <span className="font-medium tabular-nums text-slate-900">
                    {mm}:{ss}
                  </span>{" "}
                  후 만료
                </>
              )}
            </span>
            <button
              type="button"
              disabled={resent}
              onClick={resend}
              className="cursor-pointer text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {resent ? "코드를 다시 보냈어요" : "코드 다시 받기"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
/**
 * 계정 › 이메일 관리.
 *
 * **목록 + 행별 동작이다.** 초대 팝업의 칩과 다른 모양인 이유: 초대는 주소를 **여러 개 모아
 * 한 번에 보내는** 일이라 칩이 맞고, 여기는 주소마다 상태(Primary·확인 대기)와 할 수 있는
 * 일(Primary로 올리기·지우기)이 달라서 한 줄씩 필요하다.
 *
 * **Primary는 지울 수 없다.** 로그인과 복구 메일이 가는 주소다. 바꾸려면 다른 주소를
 * Primary로 올리고 나서 지운다 — 그래서 두 동작이 한 줄에 같이 있다.
 *
 * **확인하지 않은 주소는 Primary로 못 올린다.** 복구 메일이 닿지 않는 주소가 되기 때문이다.
 *
 * 회사 메일이 아닌 주소를 막지 않는다. 초대와 달리 여기는 자기 계정이라 개인 주소를
 * 보조로 등록하는 게 정상이다.
 *
 * **BE 연동 seam**: 추가·삭제·Primary 변경 API가 아직 없다
 * (`docs/be/account-api-postman-test.md`에는 대표 이메일 재인증
 * `POST /api/auth/email/verify-request`만 있다). 지금은 화면 state라 새로고침하면 돌아간다.
 */
export function EmailModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string, tone?: "ink" | "error") => void;
}) {
  const [list, setList] = useState(ACCOUNT_EMAILS);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function add() {
    const v = draft.trim().toLowerCase();
    if (!isEmailShape(v)) {
      setError("주소 형식이 아니에요");
      return;
    }
    if (list.some((e) => e.address.toLowerCase() === v)) {
      setError("이미 등록된 주소예요");
      return;
    }
    setList((prev) => [...prev, { address: v, primary: false, verified: false }]);
    setDraft("");
    setError("");
    setAdding(false);
    onDone(`${v}로 확인 메일을 보냈어요`);
  }

  function remove(address: string) {
    setList((prev) => prev.filter((e) => e.address !== address));
    onDone(`${address}를 지웠어요`);
  }

  function makePrimary(address: string) {
    setList((prev) => prev.map((e) => ({ ...e, primary: e.address === address })));
    onDone(`${address}를 Primary로 바꿨어요`);
  }

  function close() {
    setAdding(false);
    setDraft("");
    setError("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      title="이메일 관리"
      footer={
        !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            <IconMail size={14} />
            이메일 추가
          </Button>
        )
      }
    >
      <ul className="divide-y divide-slate-100 p-5">
        {list.map((e) => (
          <li key={e.address} className="flex items-center gap-3 py-3 first:pt-0">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[13px] text-slate-900">
                {e.address}
                {e.primary && <Badge tone="slate">Primary</Badge>}
                {!e.verified && <Badge tone="amber">확인 대기</Badge>}
              </p>
            </div>

            {/* Primary는 지울 수 없다 — 다른 주소를 올리고 나서 지운다 */}
            {e.primary ? (
              <span className="shrink-0 text-xs text-slate-400">로그인에 쓰는 주소</span>
            ) : (
              <span className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  // 확인하지 않은 주소를 Primary로 두면 복구 메일이 닿지 않는다
                  disabled={!e.verified}
                  title={e.verified ? undefined : "확인이 끝나면 올릴 수 있어요"}
                  onClick={() => makePrimary(e.address)}
                >
                  Primary로
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(e.address)}>
                  삭제
                </Button>
              </span>
            )}
          </li>
        ))}

        {/* 추가는 목록의 마지막 줄로 열린다 — 팝업 안에 팝업을 띄우지 않는다 */}
        {adding && (
          <li className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                className={`${error ? FIELD_ERROR : FIELD} min-w-[200px] flex-1 py-1.5 text-[13px]`}
                value={draft}
                placeholder="name@democompany.co.kr"
                aria-label="더할 이메일"
                aria-invalid={!!error}
                onChange={(ev) => {
                  setDraft(ev.target.value);
                  setError("");
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    ev.preventDefault();
                    add();
                  }
                  if (ev.key === "Escape") {
                    ev.preventDefault();
                    setAdding(false);
                    setError("");
                  }
                }}
              />
              <Button variant="secondary" size="sm" disabled={!draft.trim()} onClick={add}>
                더하기
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                취소
              </Button>
            </div>
            <p className={`mt-1.5 text-xs ${error ? "text-red-600" : "text-slate-400"}`}>
              {error || "더한 주소로 확인 메일이 가요. 회사 메일이 아니어도 괜찮아요."}
            </p>
          </li>
        )}
      </ul>
    </Modal>
  );
}

/**
 * 계정 › 2단계 인증.
 *
 * **BE에 있는 건 이메일 OTP 하나뿐이다** (`mfa/email`). SMS·인증 앱은 자리만 두고
 * 비활성으로 둔다 — 목록에서 지우면 앞으로 무엇이 오는지 보이지 않는다.
 *
 * 켤 때는 코드 확인을 거친다(`OtpEnrollModal`). 끄는 것은 여기서 즉시 반영하지만,
 * **BE는 해제에 비밀번호를 다시 묻는다**(`DELETE /api/auth/mfa/email`) — 연동할 때
 * 비밀번호 확인 단계를 앞에 붙여야 한다.
 */
export function TfaModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [tfa, setTfa] = useState<TfaState>({ email: false, sms: false, totp: false });
  const [enrolling, setEnrolling] = useState<TfaId | null>(null);

  /** 발송 대상 — 프로필 값을 읽는다. 예전에는 이 자리에 번호가 하드코딩돼 있었다 */
  const targets: Record<TfaId, string> = {
    email: DEMO_USER.email,
    sms: DEMO_USER.phone,
    totp: "인증 앱",
  };

  /** BE에 있는 수단만 켤 수 있다 */
  const available: Record<TfaId, boolean> = { email: true, sms: false, totp: false };

  const pending = TFA_METHODS.find((m) => m.id === enrolling);

  function toggle(id: TfaId, next: boolean) {
    if (next) {
      setEnrolling(id);
      return;
    }
    setTfa((t) => applyTfa(t, id, false));
    // BE 연동 seam: 해제는 비밀번호 재확인을 먼저 받아야 한다
    onDone(`${TFA_METHODS.find((m) => m.id === id)?.name ?? "2단계 인증"}을 껐어요`);
  }

  return (
    <>
      {/* 제목·설명을 `Modal`의 헤더가 아니라 본문 가운데에 둔다 — 아직 아무것도 안 켠
          상태에서 여는 화면이라 목록이 아니라 "무엇으로 할까"를 고르는 자리다.
          `Modal`에 title을 주지 않으면 헤더 줄이 사라지므로 (x)만 따로 얹는다. */}
      <Modal open={open && !pending} onClose={onClose} size="sm">
        <div className="relative px-6 pb-6 pt-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <IconX size={18} />
          </button>

          <div className="flex flex-col items-center pt-3 text-center">
            <IconLock size={26} className="text-slate-400" />
            <h2 className="mt-3 text-base font-bold text-slate-900">2단계 인증 활성화</h2>
            <p className="mt-1.5 max-w-[19rem] text-[13px] text-slate-500">
              로그인할 때 인증 코드를 한 번 더 입력해 본인을 확인해요.
            </p>
          </div>

          <ul className="mt-5 space-y-2">
            {TFA_METHODS.map((m) => {
              const usable = available[m.id];
              const Icon = METHOD_ICON[m.id];
              return (
                <li key={m.id}>
                  {/* 켜져 있으면 끄는 버튼, 아니면 등록으로 들어가는 버튼.
                      BE에 없는 수단은 opacity로 죽인다 (DESIGN.md: disabled는 노드 전체 opacity) */}
                  <button
                    type="button"
                    disabled={!usable}
                    onClick={() => toggle(m.id, !tfa[m.id])}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                      usable
                        ? "cursor-pointer border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        : "border-slate-200 opacity-45"
                    }`}
                  >
                    <Icon size={18} className="shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-slate-900">
                        {m.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {m.sentTo ? `${targets[m.id]} ${m.sentTo} 6자리 코드를 보내요` : m.desc}
                      </span>
                    </span>
                    {tfa[m.id] && (
                      <IconCheck size={16} className="shrink-0 text-emerald-600" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 text-center text-xs text-slate-400">
            지금은 이메일 코드만 쓸 수 있어요. 나머지는 준비 중이에요.
          </p>
        </div>
      </Modal>

      {pending && (
        <OtpEnrollModal
          key={pending.id}
          method={pending}
          target={targets[pending.id]}
          onClose={() => setEnrolling(null)}
          onVerified={() => {
            setTfa((t) => applyTfa(t, pending.id, true));
            setEnrolling(null);
            onDone(`${pending.name}을 켰어요`);
          }}
        />
      )}
    </>
  );
}

/**
 * 계정 › 로그인 방법 관리 — 소셜 연동 상태.
 *
 * **제공자는 `lib/auth.ts`의 `SocialProvider`가 단일 소스다** — Google·네이버 둘뿐이다.
 * Microsoft·Kakao를 넣지 않는 이유는 그 제공자가 없어서다. 눌러도 아무 일이 일어나지 않는
 * 항목을 목록에 두지 않는다.
 *
 * **연동·해제 API가 BE에 없다.** 상태만 보이고 버튼은 비활성으로 둔다. 브랜드 로고도 쓰지
 * 않는다 — `BrandIcon`은 `public/brands/<slug>`를 그리는데 `google`·`naver` 마크가 없다.
 */
export function SocialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="로그인 방법 관리"
    >
      <ul className="divide-y divide-slate-100 p-5">
        {SOCIAL_LOGINS.map((s) => (
          <li key={s.provider} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
            <IconLock size={16} className="shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-slate-900">
                {PROVIDER_LABELS[s.provider]}
              </p>
              {s.account && <p className="mt-0.5 truncate text-xs text-slate-400">{s.account}</p>}
            </div>
            {s.connected && <Badge tone="green">연동됨</Badge>}
            <Button variant="ghost" size="sm" disabled>
              {s.connected ? "해제" : "연동하기"}
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
