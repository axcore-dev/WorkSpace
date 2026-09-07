"use client";

import { useState } from "react";
import { InlineField } from "@/components/settings/account/inline-field";
import { ProfilePhoto } from "@/components/settings/account/profile-photo";
import {
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { DEMO_USER, DEPARTMENTS, SITES } from "@/data/org";

/**
 * 계정 › 프로필.
 *
 * **사진·이름·부서·직책·메일은 한 덩어리다** — "내가 누구인가"라는 한 가지 사실이라
 * 다섯 줄로 쪼개면 다섯 개 설정처럼 보인다. 헤더로 묶고 나머지(사번·사업장)만 행으로 둔다.
 *
 * **직책은 여기서 못 고친다.** 권한 관리(`/settings/company/roles`)에서 받은 직급을 그대로
 * 쓴다 — 사람이 직접 적으면 "팀장"이라 써 두고 실제 권한은 일반 사용자인 상태가 생긴다.
 *
 * 편집은 전부 그 자리에서 한다 (`InlineField`). 팝업은 절차가 있는 것만 쓴다.
 *
 * **BE 연동 seam**: 프로필 PATCH API가 아직 없다. 생기면 `InlineField`의 `onSave`에서
 * 부르고, 실패할 때 값을 되돌리고 에러 톤으로 알린다.
 */
export function ProfileSection({
  onSaved,
}: {
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const [form, setForm] = useState({
    name: DEMO_USER.name,
    dept: DEMO_USER.dept,
    empNo: DEMO_USER.empNo,
    site: DEMO_USER.site,
  });

  function set(key: keyof typeof form, label: string) {
    return (value: string) => {
      setForm((f) => ({ ...f, [key]: value }));
      onSaved(`${label}을 바꿨어요`);
    };
  }

  return (
    <>
      {/* ── 아이덴티티 헤더 ── */}
      <div className="flex items-center gap-4 pb-1">
        <ProfilePhoto onSaved={onSaved} />
        <div className="min-w-0">
          <InlineField
            variant="text"
            label="이름"
            value={form.name}
            onSave={set("name", "이름")}
            className="text-[19px] font-bold tracking-tight text-slate-900"
          />
          {/* gap을 두지 않는다 — 편집 버튼이 `-mx-1 px-1`로 자기 여백을 갖고 있어서
              gap까지 주면 가운뎃점이 양쪽 글자에서 멀리 떨어진다 */}
          <p className="mt-0.5 flex flex-wrap items-center text-[13px] text-slate-500">
            <InlineField
              variant="text"
              label="부서"
              value={form.dept}
              options={DEPARTMENTS}
              onSave={set("dept", "부서")}
            />
            <span aria-hidden className="mx-1 text-slate-300">
              ·
            </span>
            {/* 권한 관리에서 받은 직급. 여기서는 읽기만 한다
                (BE 연동 seam: 세션의 직급으로 바꾼다 — 지금은 더미) */}
            <span className="text-slate-500">{DEMO_USER.role}</span>
          </p>
          <p className="mt-1 truncate font-mono text-xs text-slate-400">{DEMO_USER.email}</p>
        </div>
      </div>

      <SettingsSection
        title="프로필"
        aside={<span className="text-xs text-slate-400">직책은 권한 관리에서 정해요</span>}
      >
        <SettingsRows>
          <SettingsRow>
            <InlineField label="사번" value={form.empNo} onSave={set("empNo", "사번")} />
          </SettingsRow>
          <SettingsRow>
            <InlineField
              label="기본 사업장"
              value={form.site}
              options={SITES}
              onSave={set("site", "기본 사업장")}
            />
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>
    </>
  );
}
