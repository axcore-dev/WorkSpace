"use client";

import { ProfileSection } from "@/components/settings/account/profile-section";
import { SecuritySection } from "@/components/settings/account/security-section";
import { SessionSection } from "@/components/settings/account/session-section";
import { UserIdFooter } from "@/components/settings/account/user-id-section";
import { Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { setAccountMe, useAccountMe } from "@/lib/account-me";

/**
 * 계정 — 아이덴티티 헤더 + 3섹션 + 꼬리말.
 *
 * 프로필 · 계정 보안 · 기기, 그리고 맨 아래 사용자 ID 한 줄.
 * 나누지 않고 스크롤로 간다 — 프로필과 보안을 두 라우트로 쪼갠 게 과했고, 다 "내 계정"이라
 * 오가며 본다.
 *
 * **내 계정은 스토어에서 온다**(`lib/account-me.ts`). 사이드바 프로필도 같은 값을 보므로, 여기서
 * 이름이나 사진을 바꾸면 그쪽도 함께 바뀐다. 바꾼 결과는 서버 응답을 그대로 `setAccountMe` 로
 * 올린다 — 다시 받지 않는다.
 *
 * 세션 목록과 2단계 수단은 이 화면에서만 쓰므로 그 섹션이 각자 받는다.
 *
 * `Toast`는 **여기서 한 번만** 렌더한다. 섹션마다 두면 화면에 네 개가 겹친다.
 */
export function AccountSettings() {
  const [toast, showToast] = useToast();
  const { me, status } = useAccountMe();

  if (status === "error") {
    return (
      <p className="mt-6 text-sm text-slate-500">
        내 계정을 불러오지 못했어요. 로그인이 끊겼을 수 있어요. 새로고침해 주세요.
      </p>
    );
  }

  // 받기 전에는 아무것도 그리지 않는다 — 빈 값으로 그렸다가 채우면 이름과 이메일이 한 번 튄다
  if (!me) return null;

  return (
    <>
      <ProfileSection me={me} onChanged={setAccountMe} onSaved={showToast} />
      <SecuritySection me={me} onSaved={showToast} />
      <SessionSection onSaved={showToast} />
      <UserIdFooter userId={me.id} onSaved={showToast} />
      <Toast toast={toast} />
    </>
  );
}
