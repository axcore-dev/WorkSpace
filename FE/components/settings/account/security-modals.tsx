"use client";

/**
 * 계정 보안이 여는 모달들. 전부 서버에 붙어 있다.
 *
 * **BE에 실제로 있는 것과 없는 것**
 * - 있음: `POST /api/auth/password`(현재 비밀번호를 묻는다) · `mfa/methods` · `mfa/email` ·
 *   `mfa/email/confirm` · `DELETE mfa/email`(비밀번호를 다시 묻는다) · `email/verify-request` ·
 *   `GET /api/auth/identities` · `DELETE /api/auth/identities/{provider}`(마지막 로그인 수단이면 409) ·
 *   `POST /api/auth/identities/{provider}`(연동 추가 — 다른 사용자에게 붙은 계정이면 409)
 * - 없음: 보조 이메일 추가·삭제·대표 변경 · SMS OTP · 인증 앱 TOTP · 패스키
 *
 * 없는 것은 **화면에서 뺐거나 버튼을 비활성**으로 둔다. 눌러도 아무 일이 없거나 화면에서만
 * 바뀌는 자리를 남기지 않는다 — 저장된 줄 알았는데 새로고침하면 되돌아가는 게 가장 나쁘다.
 *
 * **비밀번호 변경과 2단계 해제는 모든 세션을 끊는다.** 서버가 그렇게 만들어져 있다(유출이
 * 의심돼 바꾸는 상황에서 어느 세션이 내 것인지 사용자가 확신할 수 없다). 그래서 두 흐름은
 * 끝에서 로그아웃하고 로그인 화면으로 보낸다 — 안 그러면 다음 요청이 401 로 튕기며 화면이
 * 고장 난 것처럼 보인다.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import {
  IconCheckCircle,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLock,
  IconMail,
  IconRefresh,
  IconShield,
  IconSmartphone,
  IconX,
} from "@/components/icons";
import { Badge, Button, FIELD, FIELD_ERROR } from "@/components/ui";
import { endSession } from "@/components/use-logout";
import { PROVIDER_LABELS, SocialLoginNotConfiguredError, startSocialLogin } from "@/lib/auth";
import {
  changePassword,
  confirmEmailMfa,
  disableEmailMfa,
  requestPasswordSetup,
  resendVerificationEmail,
  startEmailMfa,
  unlinkSocialIdentity,
  type SocialIdentityDto,
} from "@/lib/account-api";

/**
 * 비밀번호 입력 칸들이 테두리 하나를 나눠 쓰므로 칸에는 테두리를 주지 않는다.
 * `FIELD`를 쓰면 상자가 세 개 겹친다.
 */
const PW_CELL =
  "block w-full bg-transparent px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-500";

/** 서버 코드 수명과 같다 (`MfaService`). 화면은 남은 시간만 보여 준다 */
const OTP_TTL_SEC = 180;

const message = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

/**
 * 비밀번호 변경 팝업 — Assisted Password Confirmation:
 * 규칙 충족 여부와 확인 입력 일치를 실시간으로 보여준다.
 *
 * **현재 비밀번호를 묻는다** (`POST /api/auth/password`). 로그인된 상태에서 이 확인을 빼면
 * 세션이나 메일이 탈취됐을 때 그대로 계정을 잃는다.
 *
 * 「비밀번호를 잊었어요」 흐름은 여기 없다. 잊은 사람은 로그아웃 뒤 로그인 화면의 재설정으로
 * 간다 — 같은 BE 엔드포인트(`password/reset-request` + `/reset`)를 그쪽이 이미 쓴다.
 *
 * **검증은 전부 BE 소관이다.** 여기서는 입력 형식만 본다 — 서버의 정규식과 같은 규칙이고,
 * 자체 해시·검증 로직을 만들지 않는다 (루트 CLAUDE.md AI 보안 지침).
 */
export function PasswordModal({
  open,
  email,
  hasPassword,
  onClose,
  onDone,
}: {
  open: boolean;
  email: string;
  /**
   * 비밀번호가 없는 계정(소셜로만 가입)이면 **여기서 바로 정하지 않는다.**
   * 대조할 옛 비밀번호가 없어서, 지금 이 자리가 진짜 주인인지 확인할 방법이 access 토큰뿐이다.
   * 토큰만 훔친 쪽이 비밀번호를 심어 계정을 통째로 가져갈 수 있다. 대신 메일함을 열 수 있다는
   * 증거를 요구한다 — 재설정 링크를 보내고 그 화면에서 정하게 한다.
   */
  hasPassword: boolean;
  onClose: () => void;
  onDone: (message: string, tone?: "ink" | "error") => void;
}) {
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const rules = [
    { label: "영문 포함", ok: /[a-zA-Z]/.test(pw) },
    { label: "숫자 포함", ok: /\d/.test(pw) },
    { label: "특수문자 포함", ok: /[^a-zA-Z0-9]/.test(pw) },
    { label: "8~16자리", ok: pw.length >= 8 && pw.length <= 16 },
  ];
  const valid = rules.every((r) => r.ok);
  const match = pw2.length > 0 && pw === pw2;
  const canSubmit = !!cur && valid && match && !busy;

  function close() {
    setCur("");
    setPw("");
    setPw2("");
    setShow(false);
    setBusy(false);
    setDone(false);
    onClose();
  }

  async function submit() {
    setBusy(true);
    try {
      await changePassword(cur, pw);
      setDone(true);
    } catch (e: unknown) {
      onDone(message(e, "비밀번호를 바꾸지 못했어요"), "error");
    } finally {
      setBusy(false);
    }
  }

  /** 서버가 모든 세션을 끊었다. 남은 흔적을 지우고 로그인 화면으로 */
  async function leave() {
    await endSession();
    router.replace("/login");
  }

  /** 소셜 전용 계정: 비밀번호를 정할 링크를 메일로 보낸다 */
  async function sendSetupLink() {
    setBusy(true);
    try {
      await requestPasswordSetup(email);
      setDone(true);
    } catch (e: unknown) {
      onDone(message(e, "메일을 보내지 못했어요"), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!hasPassword) {
    return (
      <Modal open={open} onClose={close} size="sm" title="비밀번호 추가">
        {done ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <IconCheckCircle size={40} className="text-emerald-600" />
            <p className="mt-3 text-sm font-semibold text-slate-900">메일을 보냈어요</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              <span className="font-mono">{email}</span> 로 보낸 링크에서 비밀번호를 정해 주세요.
              링크는 30분 뒤에 만료돼요.
            </p>
            <Button className="mt-5" onClick={close}>
              확인
            </Button>
          </div>
        ) : (
          <div className="p-5">
            <p className="flex items-start gap-2.5 text-sm leading-[1.6] text-slate-600">
              <IconMail size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <span>
                지금은 소셜 계정으로만 로그인하고 있어요. 비밀번호를 만들면 이메일로도 로그인할 수
                있고, 2단계 인증도 켤 수 있어요.
              </span>
            </p>
            <p className="mt-3 text-xs leading-[1.7] text-slate-400">
              여기서 바로 정하지 않고 <span className="font-mono">{email}</span> 로 링크를 보내요.
              지금 로그인해 있다는 것만으로는 주인인지 확신할 수 없어서, 메일함을 열 수 있다는 것을
              한 번 확인해요. 비밀번호를 정하면 모든 기기에서 로그아웃돼요.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={busy}>
                취소
              </Button>
              <Button disabled={busy} onClick={() => void sendSetupLink()}>
                <IconMail size={15} />
                링크 보내기
              </Button>
            </div>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={done ? () => void leave() : close}
      size="sm"
      title="비밀번호 변경"
      footer={
        !done && (
          <div className="flex justify-end gap-2">
            {/* 헤더 (x)가 이미 닫기다. 여기 남기는 건 「취소」 — 쓰다 만 입력을 버린다는 뜻이라
                단순히 닫는 것과 다르다 */}
            <Button variant="secondary" onClick={close} disabled={busy}>
              취소
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={() => void submit()}
              title={canSubmit ? undefined : "모든 조건을 충족하면 변경할 수 있어요"}
            >
              <IconKey size={15} />
              비밀번호 변경
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <IconCheckCircle size={40} className="text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-slate-900">비밀번호를 바꿨어요</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            모든 기기에서 로그아웃했어요. 새 비밀번호로 다시 로그인해 주세요.
          </p>
          <Button className="mt-5" onClick={() => void leave()}>
            로그인 화면으로
          </Button>
        </div>
      ) : (
        <div className="p-5">
          {/* 세 칸이 테두리 하나를 나눠 쓴다 — 사이는 옅은 실선만.
              라벨은 placeholder로 대신하고 스크린리더용 label을 따로 둔다. */}
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-300 focus-within:border-slate-400">
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
                aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-slate-600"
              >
                {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>

            <div>
              <label htmlFor="pwm-confirm" className="sr-only">
                새 비밀번호 확인
              </label>
              <input
                id="pwm-confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="새 비밀번호 확인"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className={PW_CELL}
              />
            </div>
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {rules.map((r) => (
              <li
                key={r.label}
                className={`text-xs ${r.ok ? "text-emerald-600" : "text-slate-400"}`}
              >
                {r.ok ? "✓" : "·"} {r.label}
              </li>
            ))}
          </ul>
          {pw2.length > 0 && !match && (
            <p className="mt-2 text-xs text-red-600">확인 입력이 달라요</p>
          )}
          <p className="mt-3 text-xs text-slate-400">
            바꾸고 나면 이 기기를 포함한 모든 기기에서 로그아웃돼요.
          </p>
        </div>
      )}
    </Modal>
  );
}

/**
 * 2단계 인증 등록 팝업 — 서버가 보낸 6자리를 확인해야 켜진다.
 *
 * 코드는 서버에만 있다. 여기서 맞는지 보지 않고 `mfa/email/confirm` 에 넘겨 판정을 받는다.
 * 「코드 다시 받기」는 등록을 새로 시작하는 것이라 새 챌린지 토큰으로 갈아 끼운다.
 */
function OtpEnrollModal({
  target,
  mfaToken,
  onRetoken,
  onClose,
  onVerified,
}: {
  target: string;
  mfaToken: string;
  onRetoken: (next: string) => void;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [left, setLeft] = useState(OTP_TTL_SEC);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [done]);

  const expired = left === 0;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  async function verify() {
    if (expired) {
      setError("코드가 만료됐어요. 코드를 다시 받아 주세요.");
      return;
    }
    setBusy(true);
    try {
      await confirmEmailMfa(mfaToken, code);
      setError("");
      setDone(true);
    } catch (e: unknown) {
      setError(message(e, "코드가 일치하지 않아요. 다시 입력하거나 코드를 다시 받아 주세요."));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const next = await startEmailMfa();
      onRetoken(next.mfaToken);
      setLeft(OTP_TTL_SEC);
      setCode("");
      setError("");
    } catch (e: unknown) {
      setError(message(e, "코드를 다시 보내지 못했어요"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="이메일 OTP 등록"
      footer={
        !done && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button
              disabled={code.length !== 6 || busy}
              onClick={() => void verify()}
              title={code.length === 6 ? undefined : "6자리를 모두 입력해 주세요"}
            >
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
          <p className="mt-3 text-sm font-semibold text-slate-900">이메일 OTP 등록을 마쳤어요</p>
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
            <IconMail size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              <span className="font-semibold text-slate-900">{target}</span> 주소로 6자리 코드를
              보냈어요. 아래에 입력하면 등록이 끝납니다.
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
              aria-describedby={error ? "otp-error" : undefined}
              className={`${error ? FIELD_ERROR : FIELD} text-center text-lg font-semibold tracking-[0.4em] tabular-nums`}
            />
            {error && (
              <p id="otp-error" className="mt-1.5 text-xs text-red-600">
                {error}
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
              disabled={busy}
              onClick={() => void resend()}
              className="cursor-pointer text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              코드 다시 받기
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * 계정 › 이메일.
 *
 * **주소는 하나고, 한 번 정하면 바뀌지 않는다.** 로그인 아이디이자 복구 메일이 가는 곳이고,
 * 회사 초대와 담당자 규칙이 이 주소로 사람을 찾는다. 바꾸게 하면 그 연결이 조용히 끊긴다 —
 * 진행 중인 초대가 옛 주소 앞으로 남고, 담당자로 지정된 사람이 소유자로 올라오지 못한다.
 * 그래서 기능을 미룬 것이 아니라 **바꾸지 않기로 정했다**. 주소를 잘못 적고 가입했다면 새로 가입한다.
 *
 * 여기서 할 수 있는 일은 **확인 메일 다시 보내기** 하나다(`POST /api/auth/email/verify-request`).
 */
export function EmailModal({
  open,
  email,
  verified,
  onClose,
  onDone,
}: {
  open: boolean;
  email: string;
  verified: boolean;
  onClose: () => void;
  onDone: (message: string, tone?: "ink" | "error") => void;
}) {
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      await resendVerificationEmail();
      onDone(`${email}로 확인 메일을 보냈어요`);
      onClose();
    } catch (e: unknown) {
      onDone(message(e, "확인 메일을 보내지 못했어요"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" title="이메일">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <IconMail size={16} className="shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[13px] text-slate-900">
              {email}
              {verified ? <Badge tone="green">확인됨</Badge> : <Badge tone="amber">확인 대기</Badge>}
            </p>
            <p className="mt-1 text-xs text-slate-400">로그인과 복구 메일에 쓰는 주소예요</p>
          </div>
          {!verified && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void resend()}>
              확인 메일 보내기
            </Button>
          )}
        </div>

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-[1.7] text-slate-400">
          이 주소는 바꿀 수 없어요. 로그인 아이디이자 회사 초대가 찾아오는 주소예요.
        </p>
      </div>
    </Modal>
  );
}

/**
 * 계정 › 2단계 인증.
 *
 * **BE에 있는 건 이메일 OTP 하나뿐이다** (`mfa/email`). SMS·인증 앱은 자리만 두고
 * 비활성으로 둔다 — 목록에서 지우면 앞으로 무엇이 오는지 보이지 않는다.
 *
 * 켤 때는 서버가 보낸 코드를 확인한다. **끌 때는 비밀번호를 다시 묻는다** — 서버가 요구하고
 * (access 토큰만 쥔 쪽이 방어를 걷어내는 것을 막는다), 끄고 나면 모든 세션이 끊긴다.
 */
export function TfaModal({
  open,
  email,
  enabled,
  onClose,
  onChanged,
  onDone,
}: {
  open: boolean;
  email: string;
  enabled: boolean;
  onClose: () => void;
  /** 서버 상태가 바뀌었다 — 부모가 다시 읽는다 */
  onChanged: () => void;
  onDone: (message: string, tone?: "ink" | "error") => void;
}) {
  const router = useRouter();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);

  function close() {
    setMfaToken(null);
    setPassword("");
    setDisabling(false);
    onClose();
  }

  async function start() {
    setBusy(true);
    try {
      const challenge = await startEmailMfa();
      setMfaToken(challenge.mfaToken);
    } catch (e: unknown) {
      onDone(message(e, "코드를 보내지 못했어요"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await disableEmailMfa(password);
      onChanged();
      // 서버가 모든 세션을 끊었다. 여기 남아 있으면 다음 요청이 401 로 튕긴다
      await endSession();
      router.replace("/login");
    } catch (e: unknown) {
      onDone(message(e, "2단계 인증을 끄지 못했어요"), "error");
      setBusy(false);
    }
  }

  const methods: { id: string; name: string; desc: string; icon: typeof IconMail; usable: boolean }[] = [
    {
      id: "email",
      name: "이메일 OTP",
      desc: `${email} 주소로 6자리 코드를 보내요`,
      icon: IconMail,
      usable: true,
    },
    { id: "sms", name: "SMS OTP", desc: "휴대전화 문자로 인증 코드 발송", icon: IconSmartphone, usable: false },
    { id: "totp", name: "Google Authenticator", desc: "인증 앱 기반 TOTP", icon: IconRefresh, usable: false },
  ];

  return (
    <>
      {/* 제목·설명을 `Modal`의 헤더가 아니라 본문 가운데에 둔다 — 아직 아무것도 안 켠
          상태에서 여는 화면이라 목록이 아니라 "무엇으로 할까"를 고르는 자리다.
          `Modal`에 title을 주지 않으면 헤더 줄이 사라지므로 (x)만 따로 얹는다. */}
      <Modal open={open && !mfaToken} onClose={close} size="sm">
        <div className="relative px-6 pb-6 pt-5">
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <IconX size={18} />
          </button>

          <div className="flex flex-col items-center pt-3 text-center">
            <IconLock size={26} className="text-slate-400" />
            <h2 className="mt-3 text-base font-bold text-slate-900">
              {enabled ? "2단계 인증 사용 중" : "2단계 인증 활성화"}
            </h2>
            <p className="mt-1.5 max-w-[19rem] text-[13px] text-slate-500">
              로그인할 때 인증 코드를 한 번 더 입력해 본인을 확인해요.
            </p>
          </div>

          {enabled ? (
            <div className="mt-5">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <IconMail size={18} className="shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-slate-900">
                    이메일 OTP
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-400">{email}</span>
                </span>
                <Badge tone="green">켜짐</Badge>
              </div>

              {disabling ? (
                <div className="mt-4">
                  <label htmlFor="tfa-pw" className="mb-1.5 block text-sm font-medium text-slate-700">
                    비밀번호 확인
                  </label>
                  <input
                    id="tfa-pw"
                    type="password"
                    autoComplete="current-password"
                    className={FIELD}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    끄고 나면 모든 기기에서 로그아웃돼요.
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setDisabling(false)}>
                      취소
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!password || busy}
                      onClick={() => void disable()}
                    >
                      2단계 인증 끄기
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setDisabling(true)}>
                    2단계 인증 끄기
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <ul className="mt-5 space-y-2">
                {methods.map((m) => {
                  const Icon = m.icon;
                  return (
                    <li key={m.id}>
                      {/* BE에 없는 수단은 opacity로 죽인다 (DESIGN.md: disabled는 노드 전체 opacity) */}
                      <button
                        type="button"
                        disabled={!m.usable || busy}
                        onClick={() => void start()}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                          m.usable
                            ? "cursor-pointer border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            : "border-slate-200 opacity-45"
                        }`}
                      >
                        <Icon size={18} className="shrink-0 text-slate-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold text-slate-900">
                            {m.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-400">
                            {m.desc}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-4 text-center text-xs text-slate-400">
                지금은 이메일 코드만 쓸 수 있어요. 나머지는 준비 중이에요.
              </p>
            </>
          )}
        </div>
      </Modal>

      {mfaToken && (
        <OtpEnrollModal
          target={email}
          mfaToken={mfaToken}
          onRetoken={setMfaToken}
          onClose={() => setMfaToken(null)}
          onVerified={() => {
            setMfaToken(null);
            onChanged();
            onDone("2단계 인증을 켰어요");
            onClose();
          }}
        />
      )}
    </>
  );
}

/**
 * 계정 › 로그인 방법 관리 — 소셜 연동 상태 (`GET /api/auth/identities`) 와 해제 (`DELETE /api/auth/identities/{provider}`).
 *
 * **제공자는 `lib/auth.ts`의 `SocialProvider`가 단일 소스다** — Google·네이버 둘뿐이다.
 *
 * **마지막 로그인 수단은 해제할 수 없다.** 비밀번호가 없고 남은 연동이 이것 하나면 「해제」를 잠그고 이유를
 * 적는다 — 풀면 다시 로그인할 길이 없다. 같은 판정을 서버가 다시 하고 어긋나면 409 를 돌려준다. 화면은 안내일 뿐
 * 진짜 문은 서버다.
 *
 * 해제는 **두 번 눌러야** 된다 — 첫 클릭에 그 줄이 「해제할까요?」로 바뀌고, 다시 「해제」를 눌러야 요청이 간다.
 * 되돌리려면 그 제공자로 다시 로그인해 연결해야 해서, 한 번에 지우지 않는다.
 *
 * **연동 추가는 제공자 동의 화면을 거친다.** 「연동하기」는 `startSocialLogin(provider, "link")` 로 나가고,
 * 콜백 화면(`/oauth/callback/<provider>`)이 `POST /api/auth/identities/{provider}` 로 현재 계정에 붙인 뒤 결과를 보인다.
 * 그 제공자 계정이 다른 사용자에게 이미 붙어 있으면 서버가 409 로 막고 그 문구를 콜백 화면이 보인다.
 * 브랜드 로고도 쓰지 않는다 — `BrandIcon`은 `public/brands/<slug>`를 그리는데 `google`·`naver` 마크가 없다.
 */
export function SocialModal({
  open,
  identities,
  hasPassword,
  onClose,
  onUnlinked,
}: {
  open: boolean;
  identities: SocialIdentityDto[];
  /** 비밀번호가 있으면 소셜을 전부 끊어도 로그인할 수 있다 */
  hasPassword: boolean;
  onClose: () => void;
  /** 해제가 끝났다. 부른 쪽이 목록을 다시 받는다 */
  onUnlinked: (message: string) => void;
}) {
  const providers: SocialIdentityDto["provider"][] = ["google", "naver"];
  const [confirming, setConfirming] = useState<SocialIdentityDto["provider"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** 연동 시작이 실패한 경우(클라이언트 ID 미설정 등). 해제 오류와 자리가 달라 따로 둔다 */
  const [linkError, setLinkError] = useState("");

  // 이 연동을 풀면 로그인 수단이 하나도 남지 않는가
  const lastMethod = !hasPassword && identities.length <= 1;

  function close() {
    setConfirming(null);
    setError("");
    setLinkError("");
    onClose();
  }

  /**
   * 연동 추가 — 제공자 동의 화면으로 나간다. 돌아오는 곳은 `/oauth/callback/<provider>` 이고, 그 화면이
   * `POST /api/auth/identities/{provider}` 로 현재 계정에 붙인 뒤 결과를 보인다. 이 모달은 여기서 끝난다.
   * 그 제공자 계정이 다른 사용자에게 이미 붙어 있으면 서버가 막고 콜백 화면이 그 문구를 보인다.
   */
  function link(provider: SocialIdentityDto["provider"]) {
    setError("");
    setConfirming(null);
    try {
      startSocialLogin(provider, "link");
    } catch (e: unknown) {
      setLinkError(e instanceof SocialLoginNotConfiguredError ? `${PROVIDER_LABELS[provider]} 로그인이 아직 설정되지 않았어요` : message(e, "연동을 시작하지 못했어요"));
    }
  }

  async function unlink(provider: SocialIdentityDto["provider"]) {
    setBusy(true);
    setError("");
    try {
      await unlinkSocialIdentity(provider);
      setConfirming(null);
      onUnlinked(`${PROVIDER_LABELS[provider]} 연동을 해제했어요`);
    } catch (e: unknown) {
      setError(message(e, "연동을 해제하지 못했어요"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} size="md" title="로그인 방법 관리">
      <ul className="divide-y divide-slate-100 p-5">
        {providers.map((provider) => {
          const linked = identities.find((i) => i.provider === provider);
          const asking = confirming === provider;
          return (
            <li key={provider} className="py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <IconLock size={16} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-slate-900">
                    {PROVIDER_LABELS[provider]}
                  </p>
                  {linked?.email && (
                    <p className="mt-0.5 truncate text-xs text-slate-400">{linked.email}</p>
                  )}
                </div>
                {linked && <Badge tone="green">연동됨</Badge>}
                {!linked ? (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => link(provider)}>
                    연동하기
                  </Button>
                ) : asking ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">해제할까요?</span>
                    <Button variant="danger" size="sm" disabled={busy} onClick={() => void unlink(provider)}>
                      {busy ? "해제 중…" : "해제"}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(null)}>
                      취소
                    </Button>
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={lastMethod}
                    title={lastMethod ? "마지막 로그인 수단이라 해제할 수 없어요" : undefined}
                    onClick={() => {
                      setError("");
                      setConfirming(provider);
                    }}
                  >
                    해제
                  </Button>
                )}
              </div>
              {linked && lastMethod && (
                <p className="mt-2 pl-7 text-xs text-amber-700">
                  이 계정의 유일한 로그인 방법이에요. 해제하려면 비밀번호를 먼저 설정해 주세요.
                </p>
              )}
              {asking && error && (
                <p className="mt-2 pl-7 text-xs text-red-600" role="alert">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {linkError && (
        <p className="px-5 pb-5 text-xs text-red-600" role="alert">
          {linkError}
        </p>
      )}
    </Modal>
  );
}
