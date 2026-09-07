"use client";

import { useState } from "react";
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
import { ACCOUNT_EMAILS, ACCOUNT_SECURITY, SOCIAL_LOGINS } from "@/data/org";

type Which = "email" | "password" | "tfa" | "social" | null;

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
 * **비밀번호가 없는 계정이 있다.** 소셜로만 가입한 경우다 — 그때 비밀번호 행은 「추가」가
 * 되고 **2단계 인증은 켤 수 없다.** 2단계 인증은 켜고 끌 때 비밀번호 재확인을 받는데,
 * 없는 비밀번호는 확인할 수 없다.
 *
 * **패스키는 BE에 없다** (WebAuthn 엔드포인트가 없다). 행만 두고 버튼을 비활성으로 둔다 —
 * 브라우저 API를 부르지 않는다. BE 검증 없이 부르면 등록된 것처럼 보이고 로그인은 안 되는
 * 상태가 된다.
 */
export function SecuritySection({ onSaved }: { onSaved: (message: string) => void }) {
  const [open, setOpen] = useState<Which>(null);

  const { hasPassword, passwordChangedAt } = ACCOUNT_SECURITY;
  const primary = ACCOUNT_EMAILS.find((e) => e.primary)?.address ?? "";
  const connected = SOCIAL_LOGINS.filter((s) => s.connected);
  const socialValue =
    connected.length === 0
      ? SOCIAL_LOGINS.map((s) => PROVIDER_LABELS[s.provider]).join(" · ")
      : `${connected.map((s) => PROVIDER_LABELS[s.provider]).join(" · ")} 연동됨`;

  // 2단계 인증은 아직 아무것도 켜지 않은 상태다 (BE 연동 seam: `GET /api/auth/mfa/methods`)
  const tfaOn = false;
  const done = [true, hasPassword, tfaOn].filter(Boolean).length;

  return (
    <SettingsSection
      title="계정 보안"
      aside={
        <span className="text-xs text-slate-400">3가지 중 {done}가지 설정됨</span>
      }
    >
      <SettingsRows>
        <SettingsRow>
          <ActionRow
            name={
              <span className="flex items-center gap-1.5">
                <Done on label="이메일" />
                이메일
              </span>
            }
            value={<span className="pl-[22px] font-mono">{primary}</span>}
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
                  ? `${passwordChangedAt}에 바꿨어요`
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
                {hasPassword && !tfaOn && <Badge tone="amber">권장</Badge>}
              </span>
            }
            value={
              <span className="pl-[22px]">
                {hasPassword
                  ? "비밀번호가 새어도 로그인은 막을 수 있어요"
                  : "비밀번호를 먼저 추가해 주세요"}
              </span>
            }
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasPassword}
              onClick={() => setOpen("tfa")}
            >
              켜기
            </Button>
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
                <Done on={connected.length > 0} label="소셜 로그인" />
                소셜 로그인
              </span>
            }
            value={<span className="pl-[22px]">{socialValue}</span>}
          >
            <Button variant="ghost" size="sm" onClick={() => setOpen("social")}>
              관리
            </Button>
          </ActionRow>
        </SettingsRow>
      </SettingsRows>

      <EmailModal open={open === "email"} onClose={() => setOpen(null)} />
      <PasswordModal
        open={open === "password"}
        hasPassword={hasPassword}
        onClose={() => setOpen(null)}
        onDone={onSaved}
      />
      <TfaModal open={open === "tfa"} onClose={() => setOpen(null)} onDone={onSaved} />
      <SocialModal open={open === "social"} onClose={() => setOpen(null)} />
    </SettingsSection>
  );
}
