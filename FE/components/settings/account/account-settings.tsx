"use client";

import { ProfileSection } from "@/components/settings/account/profile-section";
import { SecuritySection } from "@/components/settings/account/security-section";
import { SessionSection } from "@/components/settings/account/session-section";
import { UserIdSection } from "@/components/settings/account/user-id-section";
import { Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";

/**
 * 계정 — 한 페이지 4섹션.
 *
 * 프로필 · 계정 보안 · 기기 · 사용자 ID.
 * 나누지 않고 스크롤로 간다 — 프로필과 보안을 두 라우트로 쪼갠 게 과했고, 다 "내 계정"이라
 * 오가며 본다.
 *
 * 알림·지원 섹션은 뺐다 (수정요청 v12). 사용자 ID는 지원 섹션과 한 파일이었어서 따로 남겼다.
 *
 * **설명 문구를 두지 않는다.** 값(이메일 주소·변경일·`사용 안 함`)은 그 행의 현재 상태라
 * 남기고, 설명체 문장은 지웠다.
 *
 * `Toast`는 **여기서 한 번만** 렌더한다. 섹션마다 두면 화면에 네 개가 겹친다 —
 * 섹션은 `onSaved` 콜백만 받는다.
 */
export function AccountSettings() {
  const [toast, showToast] = useToast();

  return (
    <>
      <ProfileSection onSaved={showToast} />
      <SecuritySection onSaved={showToast} />
      <SessionSection onSaved={showToast} />
      <UserIdSection onSaved={showToast} />
      <Toast toast={toast} />
    </>
  );
}
