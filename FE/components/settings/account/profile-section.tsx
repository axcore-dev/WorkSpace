"use client";

import { useState } from "react";
import {
  FieldRow,
  SectionActions,
  SettingsRow,
  SettingsRows,
  SettingsSection,
} from "@/components/settings/settings-section";
import { Button, FIELD } from "@/components/ui";
import { DEMO_USER, DEPARTMENTS, SITES, TIMEZONES } from "@/data/org";

/** select도 `FIELD`와 같은 모양을 쓴다 — ui.tsx에 select 변형이 따로 없다 */
const SELECT = FIELD;

/**
 * 계정 › 프로필.
 *
 * **BE 연동 seam**: 프로필 PATCH API가 아직 없다 (`docs/be/account-api-postman-test.md`에
 * 계정 API 15개가 있지만 프로필 수정은 그중에 없다). 생기면 `onSubmit`에서 부르고,
 * 실패할 때 `onSaved` 대신 에러 토스트를 띄우도록 콜백을 하나 더 받는다.
 *
 * 설명 문구를 두지 않는다 — 계정 페이지 전체 규칙이다.
 */
export function ProfileSection({ onSaved }: { onSaved: (message: string) => void }) {
  const [form, setForm] = useState({
    name: DEMO_USER.name,
    empNo: DEMO_USER.empNo,
    dept: DEMO_USER.dept,
    title: DEMO_USER.title,
    site: DEMO_USER.site,
    timezone: DEMO_USER.timezone,
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSaved("프로필을 저장했어요");
      }}
    >
      <SettingsSection title="프로필">
        <SettingsRows>
          <SettingsRow>
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xl font-bold text-white"
              >
                {DEMO_USER.initials}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm">
                  사진 변경
                </Button>
                <Button type="button" variant="ghost" size="sm">
                  기본 이미지로
                </Button>
              </div>
            </div>
          </SettingsRow>

          <SettingsRow>
            <FieldRow label="이름" htmlFor="pf-name">
              <input
                id="pf-name"
                className={FIELD}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </FieldRow>
          </SettingsRow>

          <SettingsRow>
            <FieldRow label="사번" htmlFor="pf-empno">
              <input
                id="pf-empno"
                className={FIELD}
                value={form.empNo}
                onChange={(e) => set("empNo", e.target.value)}
              />
            </FieldRow>
          </SettingsRow>

          <SettingsRow>
            <FieldRow label="부서" htmlFor="pf-dept">
              <select
                id="pf-dept"
                className={SELECT}
                value={form.dept}
                onChange={(e) => set("dept", e.target.value)}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </FieldRow>
          </SettingsRow>

          <SettingsRow>
            <FieldRow label="직책" htmlFor="pf-title">
              <input
                id="pf-title"
                className={FIELD}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </FieldRow>
          </SettingsRow>

          <SettingsRow>
            <FieldRow label="기본 사업장" htmlFor="pf-site">
              <select
                id="pf-site"
                className={SELECT}
                value={form.site}
                onChange={(e) => set("site", e.target.value)}
              >
                {SITES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FieldRow>
          </SettingsRow>

          <SettingsRow>
            <FieldRow label="시간대" htmlFor="pf-tz">
              <select
                id="pf-tz"
                className={SELECT}
                value={form.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              >
                {TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FieldRow>
          </SettingsRow>
        </SettingsRows>

        <SectionActions>
          <Button type="submit">저장하기</Button>
        </SectionActions>
      </SettingsSection>
    </form>
  );
}
