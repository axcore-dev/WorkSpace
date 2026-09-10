"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import {
  EmailModal,
  PasswordModal,
  SocialModal,
  TfaModal,
} from "@/components/settings/account/security-modals";
import { IconCheck } from "@/components/icons";
import { Badge, Button } from "@/components/ui";
import { PROVIDER_LABELS } from "@/lib/auth";
import {
  getMfaMethods,
  getSocialIdentities,
  type AccountMeDto,
  type MfaMethodDto,
  type SocialIdentityDto,
} from "@/lib/account-api";

type Which = "email" | "password" | "tfa" | "social" | null;

/**
 * 조회 한 건의 상태. **실패를 빈 목록으로 바꾸지 않는다** — 계정 보안 화면에서 「없음」은 곧 "안전하다"로
 * 읽히는데, 조회 실패는 그 반대일 수 있다(2단계가 켜져 있는데 「켜기」로 보이는 식). 그래서 오류를 따로 두고
 * 그 행만 「불러오지 못했어요 · 다시 시도」로 보인다.
 */
type Fetched<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error" };

async function fetched<T>(load: () => Promise<T>): Promise<Fetched<T>> {
  try {
    return { status: "ready", data: await load() };
  } catch {
    return { status: "error" };
  }
}

/**
 * 설정을 마친 항목 앞에 붙는 체크.
 *
 * 「확인됨」·「사용 중」 같은 말을 배지로 달지 않는다 — 다섯 줄에 배지가 다섯 개면 무엇이
 * 남았는지가 안 보인다. 체크 하나면 켜졌다는 뜻이 그대로 읽힌다.
 *
 * 안 켠 항목은 **빈 자리로 남긴다.** 자리를 없애면 이름 열이 줄마다 어긋난다.
 */
function Done({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex w-4 shrink-0 justify-center" aria-hidden={!on}>
      {on && <IconCheck size={14} className="text-emerald-600" />}
      {on && <span className="sr-only">{label} 설정됨</span>}
    </span>
  );
}

/**
 * 계정 › 계정 보안.
 *
 * 목록을 펼치지 않고 **한 행 + 관리 버튼**으로 접고 자세한 건 모달에서 다룬다.
 *
 * **안 해 둔 것만 눈에 띄게 한다.** 켜 둔 항목은 체크만 달고 조용히 있고, 권장하는데 안 켠
 * 항목만 「권장」을 붙인다. 경고를 다섯 개 띄우면 다섯 개 다 안 읽힌다.
 * 색 띠·알약 배지는 쓰지 않는다 (DESIGN.md 「배경 채움·알약 배지 금지」).
 *
 * **비밀번호가 없는 계정이 있다.** 소셜로만 가입한 경우다(`me.hasPassword`) — 그때 비밀번호
 * 행은 「추가」가 되고 **2단계 인증은 켤 수 없다.** 서버가 2단계를 끌 때 비밀번호를 다시 묻는데,
 * 없는 비밀번호는 확인할 수 없어서 켜 두면 영영 못 끄는 상태가 된다.
 *
 * **패스키는 BE에 없다** (WebAuthn 엔드포인트가 없다). 행만 두고 버튼을 비활성으로 둔다 —
 * 브라우저 API를 부르지 않는다. BE 검증 없이 부르면 등록된 것처럼 보이고 로그인은 안 되는
 * 상태가 된다.
 */
export function SecuritySection({
  me,
  onSaved,
}: {
  me: AccountMeDto;
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const [open, setOpen] = useState<Which>(null);
  const [mfa, setMfa] = useState<Fetched<MfaMethodDto[]>>({ status: "loading" });
  const [social, setSocial] = useState<Fetched<SocialIdentityDto[]>>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    async function load() {
      const [m, s] = await Promise.all([fetched(getMfaMethods), fetched(getSocialIdentities)]);
      if (!alive) return;
      setMfa(m);
      setSocial(s);
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  /** 2단계 켜기·끄기 뒤와 「다시 시도」. 버튼 핸들러라 여기서는 loading 으로 되돌려도 된다 */
  const reloadMfa = useCallback(async () => {
    setMfa({ status: "loading" });
    setMfa(await fetched(getMfaMethods));
  }, []);
  const reloadSocial = useCallback(async () => {
    setSocial({ status: "loading" });
    setSocial(await fetched(getSocialIdentities));
  }, []);

  const { hasPassword, passwordChangedAt, email, emailVerified } = me;
  // 받기 전·실패는 둘 다 "모른다"다 — 켜졌다고도 꺼졌다고도 말하지 않는다
  const tfaOn = mfa.status === "ready" && mfa.data.some((m) => m.method === "email" && m.enabled);
  const identities = social.status === "ready" ? social.data : [];
  const socialValue =
    social.status === "error"
      ? "불러오지 못했어요"
      : social.status === "loading"
        ? "확인하는 중이에요…"
        : identities.length === 0
          ? "연동한 계정이 없어요"
          : `${identities.map((s) => PROVIDER_LABELS[s.provider]).join(" · ")} 연동됨`;

  const done = [emailVerified, hasPassword, tfaOn].filter(Boolean).length;

  return (
    <SettingsSection
      title="계정 보안"
      aside={
        <span className="text-xs text-slate-400">
          {mfa.status === "ready" ? `3가지 중 ${done}가지 설정됨` : "일부를 확인하지 못했어요"}
        </span>
      }
    >
      <SettingsRows>
        <SettingsRow>
          <ActionRow
            name={
              <span className="flex items-center gap-1.5">
                <Done on={emailVerified} label="이메일" />
                이메일
                {!emailVerified && <Badge tone="amber">확인 대기</Badge>}
              </span>
            }
            value={<span className="pl-[22px] font-mono">{email}</span>}
          >
            <Button variant="ghost" size="sm" onClick={() => setOpen("email")}>
              관리
            </Button>
          </ActionRow>
        </SettingsRow>

        <SettingsRow>
          <ActionRow
            name={
              <span className="flex items-center gap-1.5">
                <Done on={hasPassword} label="비밀번호" />
                비밀번호
              </span>
            }
            value={
              <span className="pl-[22px]">
                {hasPassword && passwordChangedAt
                  ? `${formatDate(passwordChangedAt)}에 바꿨어요`
                  : hasPassword
                    ? "비밀번호로 로그인하고 있어요"
                    : "소셜 계정으로만 로그인하고 있어요"}
              </span>
            }
          >
            <Button
              variant={hasPassword ? "secondary" : "primary"}
              size="sm"
              onClick={() => setOpen("password")}
            >
              {/* 없는 걸 「변경」이라 하면 무엇을 바꾸라는 건지 알 수 없다 */}
              {hasPassword ? "변경" : "비밀번호 추가"}
            </Button>
          </ActionRow>
        </SettingsRow>

        <SettingsRow>
          <ActionRow
            name={
              <span className="flex items-center gap-1.5">
                <Done on={tfaOn} label="2단계 인증" />
                2단계 인증
                {mfa.status === "ready" && hasPassword && !tfaOn && <Badge tone="amber">권장</Badge>}
              </span>
            }
            value={
              <span className="pl-[22px]">
                {mfa.status === "error"
                  ? "불러오지 못했어요"
                  : mfa.status === "loading"
                    ? "확인하는 중이에요…"
                    : !hasPassword
                      ? "비밀번호를 먼저 설정해 주세요"
                      : tfaOn
                        ? "로그인할 때 이메일 코드를 한 번 더 받아요"
                        : "비밀번호가 새어도 로그인은 막을 수 있어요"}
              </span>
            }
          >
            {mfa.status === "error" ? (
              <Button variant="ghost" size="sm" onClick={() => void reloadMfa()}>
                다시 시도
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasPassword || mfa.status !== "ready"}
                onClick={() => setOpen("tfa")}
              >
                {tfaOn ? "관리" : "켜기"}
              </Button>
            )}
          </ActionRow>
        </SettingsRow>

        <SettingsRow>
          <ActionRow
            name={
              <span className="flex items-center gap-1.5">
                <Done on={false} label="패스키" />
                패스키
              </span>
            }
            value={<span className="pl-[22px]">다음 업데이트에서 제공돼요</span>}
          >
            {/* BE에 WebAuthn이 없다 — 자리만 잡는다 */}
            <Button variant="secondary" size="sm" disabled>
              추가
            </Button>
          </ActionRow>
        </SettingsRow>

        <SettingsRow>
          <ActionRow
            name={
              <span className="flex items-center gap-1.5">
                <Done on={identities.length > 0} label="소셜 로그인" />
                소셜 로그인
              </span>
            }
            value={<span className="pl-[22px]">{socialValue}</span>}
          >
            {social.status === "error" ? (
              <Button variant="ghost" size="sm" onClick={() => void reloadSocial()}>
                다시 시도
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled={social.status !== "ready"} onClick={() => setOpen("social")}>
                관리
              </Button>
            )}
          </ActionRow>
        </SettingsRow>
      </SettingsRows>

      <EmailModal
        open={open === "email"}
        email={email}
        verified={emailVerified}
        onClose={() => setOpen(null)}
        onDone={onSaved}
      />
      <PasswordModal
        open={open === "password"}
        email={email}
        hasPassword={hasPassword}
        onClose={() => setOpen(null)}
        onDone={onSaved}
      />
      <TfaModal
        open={open === "tfa"}
        email={email}
        enabled={tfaOn}
        onClose={() => setOpen(null)}
        onChanged={() => void reloadMfa()}
        onDone={onSaved}
      />
      <SocialModal
        open={open === "social"}
        identities={identities}
        onClose={() => setOpen(null)}
      />
    </SettingsSection>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "언젠가";
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}
