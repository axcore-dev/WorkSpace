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
import { Button } from "@/components/ui";
import { PROVIDER_LABELS } from "@/lib/auth";
import { ACCOUNT_EMAILS, SOCIAL_LOGINS } from "@/data/org";

/** 마지막 비밀번호 변경일 — BE 연동 seam: 계정 API가 준다 */
const PASSWORD_CHANGED_AT = "2026-06-12";

type Which = "email" | "password" | "tfa" | "social" | null;

/**
 * 계정 › 계정 보안.
 *
 * 목록을 펼치지 않고 **한 행 + 관리 버튼**으로 접고 자세한 건 모달에서 다룬다.
 * 값(이메일 주소·변경일·`사용 안 함`)은 남기고 설명 문구는 두지 않는다 — 값을 지우면
 * 버튼을 눌러봐야 상태를 알게 된다.
 *
 * **패스키는 BE에 없다** (WebAuthn 엔드포인트가 없다). 행만 두고 버튼을 비활성으로 둔다 —
 * 브라우저 API를 부르지 않는다. BE 검증 없이 부르면 등록된 것처럼 보이고 로그인은 안 되는
 * 상태가 된다.
 */
export function SecuritySection({ onSaved }: { onSaved: (message: string) => void }) {
  const [open, setOpen] = useState<Which>(null);

  const primary = ACCOUNT_EMAILS.find((e) => e.primary)?.address ?? "";
  const connected = SOCIAL_LOGINS.filter((s) => s.connected);
  const socialValue =
    connected.length === 0
      ? "연동 없음"
      : `${connected.map((s) => PROVIDER_LABELS[s.provider]).join(" · ")} 연동됨`;

  return (
    <SettingsSection title="계정 보안">
      <SettingsRows>
        <SettingsRow>
          <ActionRow name="이메일" value={<span className="font-mono">{primary}</span>}>
            <Button variant="secondary" size="sm" onClick={() => setOpen("email")}>
              이메일 관리
            </Button>
          </ActionRow>
        </SettingsRow>

        <SettingsRow>
          <ActionRow name="비밀번호" value={`${PASSWORD_CHANGED_AT}에 바꿨어요`}>
            <Button variant="secondary" size="sm" onClick={() => setOpen("password")}>
              비밀번호 변경
            </Button>
          </ActionRow>
        </SettingsRow>

        <SettingsRow>
          <ActionRow name="2단계 인증" value="사용 안 함">
            <Button variant="secondary" size="sm" onClick={() => setOpen("tfa")}>
              인증 방법 추가
            </Button>
          </ActionRow>
        </SettingsRow>

        <SettingsRow>
          <ActionRow name="패스키" value="등록한 기기 없음">
            {/* BE에 WebAuthn이 없다 — 자리만 잡는다 */}
            <Button variant="secondary" size="sm" disabled>
              패스키 추가
            </Button>
          </ActionRow>
        </SettingsRow>

        <SettingsRow>
          <ActionRow name="소셜 로그인" value={socialValue}>
            <Button variant="secondary" size="sm" onClick={() => setOpen("social")}>
              로그인 방법 관리
            </Button>
          </ActionRow>
        </SettingsRow>
      </SettingsRows>

      <EmailModal open={open === "email"} onClose={() => setOpen(null)} />
      <PasswordModal open={open === "password"} onClose={() => setOpen(null)} onDone={onSaved} />
      <TfaModal open={open === "tfa"} onClose={() => setOpen(null)} onDone={onSaved} />
      <SocialModal open={open === "social"} onClose={() => setOpen(null)} />
    </SettingsSection>
  );
}
