"use client";

import { InlineField } from "@/components/settings/account/inline-field";
import { ProfilePhoto } from "@/components/settings/account/profile-photo";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { updateAccountName, type AccountMeDto } from "@/lib/account-api";
import { useWorkspaceMe } from "@/lib/workspace-me";

/**
 * 계정 › 프로필.
 *
 * **사진·이름·부서·직책·메일은 한 덩어리다** — "내가 누구인가"라는 한 가지 사실이라
 * 다섯 줄로 쪼개면 다섯 개 설정처럼 보인다. 헤더로 묶는다.
 *
 * **여기서 고칠 수 있는 것은 이름 하나다.**
 * - 부서·직책은 회사가 정한다. 권한 관리(`/settings/company/roles`)에서 소유자가 준 값을 그대로 읽는다 —
 *   사람이 직접 적으면 "팀장"이라 써 두고 실제 권한은 일반 사용자인 상태가 생긴다.
 * - 이메일은 로그인 아이디다. 바꾸려면 소유 확인을 다시 받아야 해서 계정 보안 쪽에서 다룬다.
 * - 사번·기본 사업장은 뺐다. 저장할 곳(컬럼)도 경로도 없어서 고쳐도 새로고침하면 되돌아갔다.
 *
 * 저장은 낙관적이지 않다 — 서버 응답으로 갈아 끼운다. 이름은 한 번 저장하면 다른 사람 목록에도
 * 그대로 나가는 값이라, 실패했는데 화면에만 바뀌어 있으면 서로 다른 이름으로 부르게 된다.
 */
export function ProfileSection({
  me,
  onChanged,
  onSaved,
}: {
  me: AccountMeDto;
  onChanged: (next: AccountMeDto) => void;
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const { me: workspace } = useWorkspaceMe();

  function saveName(next: string) {
    if (next === me.name) return;
    updateAccountName(next).then(
      (updated) => {
        onChanged(updated);
        onSaved("이름을 바꿨어요");
      },
      (e: unknown) =>
        onSaved(e instanceof Error && e.message ? e.message : "저장하지 못했어요", "error"),
    );
  }

  const department = workspace?.member.departmentName ?? null;
  const role = workspace?.member.roleName ?? null;

  return (
    <>
      {/* ── 아이덴티티 헤더 ── */}
      <div className="flex items-center gap-4 pb-1">
        <ProfilePhoto me={me} onChanged={onChanged} onSaved={onSaved} />
        <div className="min-w-0">
          <InlineField
            variant="text"
            label="이름"
            value={me.name}
            onSave={saveName}
            className="text-[19px] font-bold tracking-tight text-slate-900"
          />
          {/* 회사를 고르기 전에는 부서·직책을 알 수 없다 — 그때는 줄을 그리지 않는다 */}
          {(department || role) && (
            <p className="mt-0.5 flex flex-wrap items-center text-[13px] text-slate-500">
              {department && <span>{department}</span>}
              {department && role && (
                <span aria-hidden className="mx-1 text-slate-300">
                  ·
                </span>
              )}
              {role && <span>{role}</span>}
            </p>
          )}
          <p className="mt-1 truncate font-mono text-xs text-slate-400">{me.email}</p>
        </div>
      </div>

      <SettingsSection
        title="프로필"
        aside={<span className="text-xs text-slate-400">부서·직책은 권한 관리에서 정해요</span>}
      >
        <SettingsRows>
          <SettingsRow>
            <ActionRow name="부서" value={department ?? "회사를 고르면 보여요"} />
          </SettingsRow>
          <SettingsRow>
            <ActionRow name="직책" value={role ?? "회사를 고르면 보여요"} />
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>
    </>
  );
}
