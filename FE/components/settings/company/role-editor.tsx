"use client";

import { useMemo, useState } from "react";
import {
  ActionRow,
  SettingsRow,
  SettingsRows,
} from "@/components/settings/settings-section";
import {
  DeptDeleteModal,
  NameModal,
  RankDeleteModal,
} from "@/components/settings/company/dept-rank-modals";
import { ICON_MAP, IconLock, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { useModules } from "@/components/module-provider";
import { Badge, Button, Segmented, Toast, Toggle } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { josa } from "@/data/ko";
import { DATA_SCOPES, DEPARTMENTS, ROLES, USERS_ROLES } from "@/data/org";
import { MODULES } from "@/data/modules";
import {
  WORKSPACE_PERMS,
  deptDeletable,
  moveRanks,
  rankDeletable,
  renameDept,
  roleMemberCount,
} from "@/data/roles";
import type { DataScope, RoleDef } from "@/data/roles";

/** 부서에 속하지 않는 직급이 사는 자리 — 지금은 소유자 하나뿐이다 */
const NONE = "__none";

type Dialog =
  | { kind: "newDept" }
  | { kind: "renameDept"; dept: string }
  | { kind: "delDept"; dept: string }
  | { kind: "newRank"; dept: string }
  | { kind: "renameRank"; id: string }
  | { kind: "delRank"; id: string }
  | null;

/**
 * 회사 › 권한 관리 — **부서 · 직급 · 권한 세 열**.
 *
 * 「부서 만들기 → 직급 만들기 → 권한 선택」이 세 단계라 화면도 세 열이다. 왼쪽에서 고른 것이
 * 오른쪽을 정한다. 열마다 머리글·목록·만들기 버튼이 같은 자리에 있고, 이름 바꾸기와 지우기는
 * 줄에 커서를 올리면 나온다 — 늘 띄우면 아이콘이 열여덟 개가 된다.
 *
 * **권한 = 탭 접근이다.** 서브기능은 곧 모듈 화면의 탭이고(`components/module-view.tsx`의
 * 「서브기능 탭」), 권한을 준다는 건 그 탭을 볼 수 있게 한다는 뜻이다. 그래서 체크박스가
 * 아니라 토글이고 모양이 기능 관리와 같다 — 저기는 "이 회사가 어떤 탭을 쓰나",
 * 여기는 "이 직급이 그중 어떤 탭을 보나"다.
 *
 * **워크스페이스에서 꺼 둔 기능은 여기서도 잠긴다.** 아무도 못 보는 탭에 권한을 줘 봐야
 * 소용이 없고, 켜 두면 기능을 다시 켰을 때 의도치 않게 열린다.
 *
 * **삭제는 매달린 것을 먼저 묻는다** — 규칙은 `data/roles.ts`에 있고 테스트가 지킨다.
 *
 * **이 화면은 보안 경계가 아니다.** 실제 접근 차단은 BE 세션의 직급 검사에서 한다.
 *
 * **BE 연동 seam**: 부서·직급 CRUD와 권한 저장이 모두 API를 부른다. 지금은 화면 state다 —
 * 새로고침하면 돌아간다.
 */
export function RoleEditor() {
  const [toast, showToast] = useToast();
  const [depts, setDepts] = useState<string[]>([...DEPARTMENTS]);
  const [roles, setRoles] = useState<RoleDef[]>(ROLES);
  const [saved, setSaved] = useState<RoleDef[]>(ROLES);
  const [selDept, setSelDept] = useState<string>(DEPARTMENTS[1] ?? DEPARTMENTS[0]);
  const [selRank, setSelRank] = useState<string | null>(
    ROLES.find((r) => r.dept === (DEPARTMENTS[1] ?? DEPARTMENTS[0]))?.id ?? null,
  );
  const [dialog, setDialog] = useState<Dialog>(null);

  const { state } = useModules();

  const totalTabs = useMemo(
    () => MODULES.reduce((n, m) => n + m.subfunctions.length, 0),
    [],
  );

  /** 고른 부서의 직급. 「전사」는 부서가 없는 직급(소유자)을 보여준다 */
  const rankList = roles.filter((r) => (selDept === NONE ? r.dept === null : r.dept === selDept));
  const role = roles.find((r) => r.id === selRank) ?? null;
  const locked = !!role?.system;
  const dirty =
    JSON.stringify(role) !== JSON.stringify(saved.find((r) => r.id === role?.id)) ||
    JSON.stringify(depts) !== JSON.stringify([...DEPARTMENTS]);

  const onTabs = role
    ? MODULES.reduce(
        (n, m) => n + m.subfunctions.filter((s) => role.perms.includes(s.id)).length,
        0,
      )
    : 0;

  function pickDept(d: string) {
    setSelDept(d);
    const first = roles.find((r) => (d === NONE ? r.dept === null : r.dept === d));
    setSelRank(first?.id ?? null);
  }

  function patch(next: Partial<RoleDef>) {
    if (!role) return;
    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, ...next } : r)));
  }

  function togglePerm(id: string, on: boolean) {
    if (!role) return;
    patch({ perms: on ? [...role.perms, id] : role.perms.filter((p) => p !== id) });
  }

  /**
   * 기능 하나를 통째로 — 하위 탭을 다 켜거나 다 끈다.
   * 역방향(하위를 다 끄면 기능도 꺼짐)은 따로 저장하지 않고 파생한다 — 상태가 한 벌로 남는다.
   */
  function toggleModule(slug: string, on: boolean) {
    if (!role) return;
    const ids = MODULES.find((m) => m.slug === slug)?.subfunctions.map((s) => s.id) ?? [];
    const rest = role.perms.filter((p) => !ids.includes(p));
    patch({ perms: on ? [...rest, ...ids] : rest });
  }

  /* ── 부서 ── */
  function addDept(name: string) {
    setDepts((prev) => [...prev, name]);
    setSelDept(name);
    setSelRank(null);
    setDialog(null);
    showToast(`${name} 부서를 만들었어요. 이제 직급을 만들어 주세요`);
  }

  function doRenameDept(from: string, to: string) {
    setDepts((prev) => prev.map((d) => (d === from ? to : d)));
    // 그 부서를 쓰던 직급이 따라온다 — 안 따라오면 없어진 이름을 가리킨다
    setRoles((prev) => renameDept(prev, from, to));
    setSaved((prev) => renameDept(prev, from, to));
    if (selDept === from) setSelDept(to);
    setDialog(null);
    showToast(`부서 이름을 ${to}${josa(to, "로/으로")} 바꿨어요`);
  }

  function doDeleteDept(dept: string, moveTo: string | null) {
    if (moveTo) {
      setRoles((prev) => moveRanks(prev, dept, moveTo));
      setSaved((prev) => moveRanks(prev, dept, moveTo));
    }
    const rest = depts.filter((d) => d !== dept);
    setDepts(rest);
    setSelDept(rest[0] ?? NONE);
    setSelRank(null);
    setDialog(null);
    showToast(
      moveTo
        ? `${dept} 부서를 지우고 직급을 ${moveTo}${josa(moveTo, "로/으로")} 옮겼어요`
        : `${dept} 부서를 지웠어요`,
    );
  }

  /* ── 직급 ── */
  function addRank(dept: string, name: string) {
    const next: RoleDef = {
      id: `role-${Date.now()}`,
      name,
      system: false,
      dept,
      // 권한 없이 시작한다 — 새 직급이 뭘 볼 수 있는지는 만든 사람이 정한다
      perms: [],
      scope: "own",
      showAmounts: false,
      canDelegateInvite: false,
    };
    setRoles((prev) => [...prev, next]);
    setSaved((prev) => [...prev, next]);
    setSelRank(next.id);
    setDialog(null);
    showToast(`${name} 직급을 만들었어요. 이제 볼 수 있는 탭을 골라 주세요`);
  }

  function doRenameRank(id: string, to: string) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, name: to } : r)));
    setSaved((prev) => prev.map((r) => (r.id === id ? { ...r, name: to } : r)));
    setDialog(null);
    showToast(`직급 이름을 ${to}${josa(to, "로/으로")} 바꿨어요`);
  }

  function doDeleteRank(id: string, moveTo: string | null) {
    const gone = roles.find((r) => r.id === id);
    if (!gone) return;
    const rest = roles.filter((r) => r.id !== id);
    setRoles(rest);
    setSaved(rest);
    setSelRank(rest.find((r) => r.dept === gone.dept)?.id ?? null);
    setDialog(null);
    showToast(
      moveTo
        ? `${gone.name} 직급을 지우고 구성원을 ${moveTo}${josa(moveTo, "로/으로")} 옮겼어요`
        : `${gone.name} 직급을 지웠어요`,
    );
  }

  function save() {
    setSaved(roles);
    showToast(
      `${role?.name} 권한을 저장했어요 · ${roleMemberCount(role?.name ?? "", USERS_ROLES)}명에게 적용됐어요`,
    );
  }

  return (
    <>
      {/* **테두리를 두르지 않는다.** 상자에 담으면 페이지 위에 위젯을 얹은 것처럼 동떨어져
          보인다. 열 사이 세로 실선과 여백만으로 나눈다 — 설정 화면이 쓰는
          「제목 + 실선」 언어 그대로다.

          좁은 화면에서는 세 열이 위아래로 쌓인다. 순서가 그대로라 부서 → 직급 → 권한을
          아래로 훑으면 된다. */}
      {/* `lg:min-h-0`이 있어야 열이 남은 높이 안에서 줄어든다 — 없으면 flex 아이템의 최소
          높이가 내용 높이라 목록이 길어질 때 화면 밖으로 밀린다 */}
      <div className="mt-5 grid lg:min-h-0 lg:flex-1 lg:grid-cols-[252px_252px_minmax(0,1fr)]">
        {/* ── 1. 부서 ── */}
        <div className="thin-scroll min-w-0 border-b border-slate-100 pb-5 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:pb-4 lg:pr-5">
          <ColHead title="부서" aside={`${depts.length}개`} />
          <ul className="mb-1.5 border-b border-slate-100 pb-1.5">
            <Row
              on={selDept === NONE}
              label="전사"
              aside="부서 없음"
              onPick={() => pickDept(NONE)}
            />
          </ul>
          <ul>
            {depts.map((d) => (
              <Row
                key={d}
                on={selDept === d}
                label={d}
                aside={String(roles.filter((r) => r.dept === d).length)}
                onPick={() => pickDept(d)}
                onRename={() => setDialog({ kind: "renameDept", dept: d })}
                onDelete={() => setDialog({ kind: "delDept", dept: d })}
              />
            ))}
          </ul>
          {/* 만들기는 목록의 다음 줄이다 — 열 맨 아래에 못 박으면 목록과 멀어진다 */}
          <AddLine label="부서 만들기" onClick={() => setDialog({ kind: "newDept" })} />
        </div>

        {/* ── 2. 직급 ── */}
        <div className="thin-scroll mt-5 min-w-0 border-b border-slate-100 pb-5 lg:mt-0 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5 lg:pb-4">
          <ColHead
            title="직급"
            aside={selDept === NONE ? "부서 없음" : `${rankList.length}개`}
          />
          {rankList.length === 0 ? (
            <p className="px-1 py-3 text-xs leading-relaxed text-slate-400">
              직급이 없어요.
              <br />
              아래에서 먼저 만들어 주세요.
            </p>
          ) : (
            <ul>
              {rankList.map((r) => (
                <Row
                  key={r.id}
                  on={selRank === r.id}
                  label={r.name}
                  aside={r.system ? "시스템" : `${roleMemberCount(r.name, USERS_ROLES)}명`}
                  onPick={() => setSelRank(r.id)}
                  onRename={r.system ? undefined : () => setDialog({ kind: "renameRank", id: r.id })}
                  onDelete={
                    rankDeletable(r, roles).ok
                      ? () => setDialog({ kind: "delRank", id: r.id })
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
          <AddLine
            label="직급 만들기"
            // 「전사」에는 직급을 만들 수 없다 — 소유자 하나로 고정이다
            disabled={selDept === NONE}
            onClick={() => setDialog({ kind: "newRank", dept: selDept })}
          />
        </div>

        {/* ── 3. 권한 ── */}
        <div className="mt-5 flex min-w-0 flex-col lg:mt-0 lg:min-h-0 lg:pl-5">
          <ColHead title="권한 선택" aside={role ? `탭 ${onTabs}/${totalTabs}` : ""} />

          {!role ? (
            <p className="py-16 text-center text-xs leading-relaxed text-slate-400">
              직급을 고르면
              <br />
              권한을 정할 수 있어요.
            </p>
          ) : (
            <>
              <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 pt-1">
                  <h3 className="text-[15px] font-bold text-slate-900">{role.name}</h3>
                  {role.system && <Badge tone="slate">시스템 직급</Badge>}
                  <span className="text-xs text-slate-400">
                    {selDept === NONE ? "전사" : selDept} ·{" "}
                    {roleMemberCount(role.name, USERS_ROLES)}명
                  </span>
                </div>

                {locked && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
                    <IconLock size={14} className="mt-0.5 shrink-0" />
                    시스템 직급의 설정은 편집할 수 없어요.
                  </p>
                )}

                {/* 높이를 고정하지 않는다 — 남은 공간을 다 쓰고, 넘치면 이 안에서만 스크롤한다.
                    아래 저장 버튼이 늘 화면에 남는 게 이 구조의 목적이다 */}
                <div className="thin-scroll mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
                  {/* 회사 단위 권한 — 탭이 아니라 회사 자체를 다루는 것들이라 따로 둔다 */}
                  <p className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    회사
                  </p>
                  <SettingsRows tight>
                    {WORKSPACE_PERMS.map((p) => (
                      <SettingsRow key={p.id}>
                        <ActionRow name={p.name}>
                          <Toggle
                            checked={role.perms.includes(p.id)}
                            onChange={(v) => togglePerm(p.id, v)}
                            label={p.name}
                            disabled={locked}
                          />
                        </ActionRow>
                      </SettingsRow>
                    ))}
                  </SettingsRows>

                  <p className="pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    기능 탭
                  </p>
                  <SettingsRows>
                    {MODULES.map((mod) => {
                      const subs = mod.subfunctions;
                      const on = subs.filter((s) => role.perms.includes(s.id)).length;
                      const wsOff = !state[mod.slug]?.enabled;
                      const Icon = ICON_MAP[mod.icon];
                      return (
                        <SettingsRow key={mod.slug}>
                          <div className={wsOff ? "opacity-45" : ""}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex min-w-0 items-center gap-2.5">
                                <Icon size={16} className="shrink-0 text-slate-400" />
                                <span className="text-[13.5px] font-semibold text-slate-900">
                                  {mod.name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {on}/{subs.length}
                                </span>
                                {wsOff && <Badge tone="slate">워크스페이스에서 꺼짐</Badge>}
                              </span>
                              <Toggle
                                size="sm"
                                checked={on > 0}
                                onChange={(v) => toggleModule(mod.slug, v)}
                                label={`${mod.name} 전체`}
                                disabled={locked || wsOff}
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 pl-[26px]">
                              {subs.map((sub) => (
                                <span key={sub.id} className="inline-flex items-center gap-1.5">
                                  <Toggle
                                    size="sm"
                                    checked={role.perms.includes(sub.id)}
                                    onChange={(v) => togglePerm(sub.id, v)}
                                    label={`${mod.name} > ${sub.name}`}
                                    disabled={locked || wsOff}
                                  />
                                  <span
                                    className={`text-[13px] ${
                                      role.perms.includes(sub.id)
                                        ? "text-slate-600"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {sub.name}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </SettingsRow>
                      );
                    })}
                  </SettingsRows>

                  <div className="mt-4 border-t border-slate-200 pt-2">
                    <SettingsRows tight>
                      <SettingsRow>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-slate-900">
                              데이터 접근 범위
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-400">
                              전체 = 워크스페이스 전부 · 부서 = 소속 부서 · 본인 = 자기가 만든 것
                            </span>
                          </span>
                          <Segmented<DataScope>
                            options={DATA_SCOPES}
                            value={role.scope}
                            onChange={(v) => patch({ scope: v })}
                            label="데이터 접근 범위"
                            disabled={locked}
                          />
                        </div>
                      </SettingsRow>
                      <SettingsRow>
                        <ActionRow name="금액 정보 보기" value="단가·원가·매출 열">
                          <Toggle
                            checked={role.showAmounts}
                            onChange={(v) => patch({ showAmounts: v })}
                            label="금액 정보 보기"
                            disabled={locked}
                          />
                        </ActionRow>
                      </SettingsRow>
                      <SettingsRow>
                        <ActionRow name="구성원 초대 위임" value="자기 권한 안에서만 초대 가능">
                          <Toggle
                            checked={role.canDelegateInvite}
                            onChange={(v) => patch({ canDelegateInvite: v })}
                            label="구성원 초대 위임"
                            disabled={locked}
                          />
                        </ActionRow>
                      </SettingsRow>
                    </SettingsRows>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                <Button variant="secondary" disabled={!dirty} onClick={() => setRoles(saved)}>
                  되돌리기
                </Button>
                <Button disabled={locked || !dirty} onClick={save}>
                  저장하기
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 팝업 ── */}
      {dialog?.kind === "newDept" && (
        <NameModal
          title="부서 만들기"
          label="부서 이름"
          placeholder="예: 생산기술팀"
          hint="직급이 없는 빈 부서로 시작해요. 이어서 직급을 만들어 주세요."
          taken={depts}
          onClose={() => setDialog(null)}
          onSubmit={addDept}
        />
      )}
      {dialog?.kind === "renameDept" && (
        <NameModal
          title="부서 이름 바꾸기"
          label="부서 이름"
          initial={dialog.dept}
          hint="이 부서를 쓰는 직급이 함께 따라와요."
          taken={depts}
          onClose={() => setDialog(null)}
          onSubmit={(to) => doRenameDept(dialog.dept, to)}
        />
      )}
      {dialog?.kind === "delDept" && (
        <DeptDeleteModal
          dept={dialog.dept}
          ranks={roles.filter((r) => r.dept === dialog.dept).map((r) => r.name)}
          blocked={!deptDeletable(dialog.dept, roles).ok}
          others={depts.filter((d) => d !== dialog.dept)}
          onClose={() => setDialog(null)}
          onDelete={(moveTo) => doDeleteDept(dialog.dept, moveTo)}
        />
      )}
      {dialog?.kind === "newRank" && (
        <NameModal
          title="직급 만들기"
          label="직급 이름"
          placeholder="예: 생산 계획 담당"
          hint={`${dialog.dept} · 권한 없이 시작해요.`}
          taken={roles.map((r) => r.name)}
          onClose={() => setDialog(null)}
          onSubmit={(name) => addRank(dialog.dept, name)}
        />
      )}
      {dialog?.kind === "renameRank" && (
        <NameModal
          title="직급 이름 바꾸기"
          label="직급 이름"
          initial={roles.find((r) => r.id === dialog.id)?.name ?? ""}
          taken={roles.map((r) => r.name)}
          onClose={() => setDialog(null)}
          onSubmit={(to) => doRenameRank(dialog.id, to)}
        />
      )}
      {dialog?.kind === "delRank" && (
        <RankDeleteModal
          rank={roles.find((r) => r.id === dialog.id)?.name ?? ""}
          members={roleMemberCount(roles.find((r) => r.id === dialog.id)?.name ?? "", USERS_ROLES)}
          others={roles
            .filter((r) => r.id !== dialog.id && !r.system)
            .map((r) => ({ name: r.name, label: `${r.name} (${r.dept ?? "전사"})` }))}
          onClose={() => setDialog(null)}
          onDelete={(moveTo) => doDeleteRank(dialog.id, moveTo)}
        />
      )}

      <Toast toast={toast} />
    </>
  );
}

/**
 * 열 머리글 — 상자의 헤더가 아니라 **페이지의 소제목**이다.
 *
 * 회색 띠를 두르지 않고 아래 실선 한 줄만 긋는다. `SettingsSection`의 제목과 같은 모양이라
 * 계정·기능 관리 화면과 한 벌로 읽힌다.
 */
function ColHead({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
      <span className="text-[13px] font-bold text-slate-900">{title}</span>
      {aside && <span className="text-[11px] text-slate-400">{aside}</span>}
    </div>
  );
}

/**
 * 만들기 — 목록의 마지막 줄.
 *
 * 테두리 있는 버튼을 열 맨 아래에 못 박으면 목록과 멀어지고, 열이 짧을 때 가운데가 비어
 * 보인다. 목록 줄과 같은 모양·같은 자리라 「다음 줄에 하나 더」로 읽힌다.
 */
function AddLine({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="-mx-2 mt-0.5 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[12.5px] font-medium text-slate-400 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
    >
      <IconPlus size={13} className="shrink-0" />
      {label}
    </button>
  );
}

/**
 * 목록 한 줄 — 고르기 + (호버 시) 이름 바꾸기·지우기.
 *
 * 손잡이를 늘 띄우지 않는다. 부서가 여섯이면 아이콘이 열여덟 개가 되어 목록이 공구함처럼
 * 보인다. 키보드로도 닿아야 하므로 `focus-within`으로도 나타난다.
 */
function Row({
  on,
  label,
  aside,
  onPick,
  onRename,
  onDelete,
}: {
  on: boolean;
  label: string;
  aside?: string;
  onPick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  return (
    <li
      className={`group flex items-center rounded-lg ${
        on ? "bg-slate-100" : "hover:bg-slate-50"
      }`}
    >
      <button
        type="button"
        aria-current={on ? "true" : undefined}
        onClick={onPick}
        className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
          on ? "font-semibold text-slate-900" : "font-medium text-slate-600"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {aside && <span className="shrink-0 text-[11px] font-normal text-slate-400">{aside}</span>}
      </button>

      {(onRename || onDelete) && (
        <span className="flex shrink-0 gap-0.5 pr-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {onRename && (
            <IconButton label={`${label} 이름 바꾸기`} onClick={onRename}>
              <IconPencil size={12} />
            </IconButton>
          )}
          {onDelete && (
            <IconButton label={`${label} 지우기`} onClick={onDelete} danger>
              <IconTrash size={12} />
            </IconButton>
          )}
        </span>
      )}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors duration-150 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400 ${
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-slate-200 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
