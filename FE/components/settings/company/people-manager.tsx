"use client";

import { useCallback, useEffect, useState } from "react";
import { InviteModal } from "@/components/settings/invite-modal";
import { InviteLinks } from "@/components/settings/company/invite-links";
import { MemberTable } from "@/components/settings/company/member-table";
import { PendingInvites } from "@/components/settings/company/pending-invites";
import { IconLink, IconMail, IconUsers } from "@/components/icons";
import { Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { ApiRequestError } from "@/lib/api";
import {
  getDepartments,
  getInvitations,
  getInviteLinks,
  getMembers,
  getRoles,
  type DepartmentDto,
  type InviteLinkDto,
  type MemberDto,
  type PendingInvitationDto,
  type RoleDto,
} from "@/lib/workspace-api";
import { useWorkspaceMe } from "@/lib/workspace-me";

type TabId = "members" | "pending" | "links";

/** 세 탭이 함께 보는 데이터. 한 번 받아 내려 주고, 바뀌면 `reload` 로 다시 받는다 */
export type PeopleData = {
  members: MemberDto[];
  pending: PendingInvitationDto[];
  links: InviteLinkDto[];
  depts: DepartmentDto[];
  roles: RoleDto[];
};

const EMPTY: PeopleData = { members: [], pending: [], links: [], depts: [], roles: [] };

/**
 * 회사 › 초대 관리 — 인라인 탭 3개.
 *
 * 구성원·초대 중·초대 링크를 세 라우트로 쪼개지 않는다. 셋 다 "누가 있고 누가 들어오는
 * 중인가"라서 오가며 보고, 라우트로 나누면 왕복마다 화면이 갈린다
 * (DESIGN.md 「페이지 안 탭」).
 *
 * **원본은 서버다** (`/api/workspace/members` · `/invitations` · `/invite-links`, 부서·직급도 함께). 여기서 한 번 받아
 * 세 탭에 내려 준다 — 탭 머리의 숫자가 셋을 다 알아야 하고, 초대 팝업도 구성원·초대 중 주소를 봐야 하기 때문이다.
 * 탭이 무엇을 바꾸면 `onChanged` 로 전부 다시 받는다. 목록이 작아서 부분 갱신은 이르다.
 *
 * 탭 상태는 `useState`다. URL 쿼리(`?tab=pending`)로 딥링크를 만들 수도 있지만 지금은
 * 링크를 주고받을 상황이 아니다.
 * ponytail: 링크 공유가 필요해지면 `useSearchParams`로 올린다.
 */
export function PeopleManager() {
  const [tab, setTab] = useState<TabId>("members");
  const [toast, showToast] = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [data, setData] = useState<PeopleData>(EMPTY);
  const { me } = useWorkspaceMe();

  const reload = useCallback(async () => {
    try {
      const [members, pending, links, depts, roles] = await Promise.all([
        getMembers(),
        getInvitations().catch(() => [] as PendingInvitationDto[]), // 초대 권한이 없으면 403 — 구성원 탭은 그대로 보인다
        getInviteLinks().catch(() => [] as InviteLinkDto[]),
        getDepartments(),
        getRoles(),
      ]);
      setData({ members, pending, links, depts, roles });
    } catch (e) {
      showToast(e instanceof ApiRequestError ? e.body.message : "구성원 목록을 불러오지 못했어요", "error");
    }
  }, [showToast]);

  useEffect(() => {
    // 마운트 뒤 한 번 받는다
    async function load() {
      await reload();
    }
    void load();
  }, [reload]);

  const TABS: { id: TabId; label: string; icon: typeof IconUsers; count: number }[] = [
    { id: "members", label: "구성원", icon: IconUsers, count: data.members.length },
    { id: "pending", label: "초대 중인 구성원", icon: IconMail, count: data.pending.length },
    { id: "links", label: "초대 링크", icon: IconLink, count: data.links.filter((l) => l.active).length },
  ];

  return (
    <>
      {/* 탭 3개는 390px에서도 줄바꿈으로 들어간다 — 스크롤을 두지 않는다.
          가로 스크롤은 스크롤바가 밑줄과 겹쳐 활성 탭 표시를 가린다. */}
      <div
        role="tablist"
        aria-label="초대 관리"
        className="mt-4 flex flex-wrap gap-1 border-b border-slate-200"
      >
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls="people-panel"
              onClick={() => setTab(t.id)}
              className={`-mb-px inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                on
                  ? "border-slate-900 font-semibold text-slate-900"
                  : "border-transparent font-medium text-slate-500 hover:text-slate-700"
              }`}
            >
              <t.icon size={15} className={on ? "text-slate-600" : "text-slate-400"} />
              {t.label}
              <span className="font-normal text-slate-400">({t.count})</span>
            </button>
          );
        })}
      </div>

      {/* 탭 하나만 DOM에 둔다 — 목록은 부모가 들고 있어서 패널을 바꿔도 다시 받지 않는다.
          `aria-labelledby`가 활성 탭을 따라간다. */}
      <div id="people-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "members" && (
          <MemberTable
            data={data}
            me={me}
            onSaved={showToast}
            onInvite={() => setInviteOpen(true)}
            onChanged={reload}
          />
        )}
        {tab === "pending" && (
          <PendingInvites
            pending={data.pending}
            canManage={!!me?.member.owner}
            onSaved={showToast}
            onInvite={() => setInviteOpen(true)}
            onChanged={reload}
          />
        )}
        {tab === "links" && <InviteLinks data={data} me={me} onSaved={showToast} onChanged={reload} />}
      </div>

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        data={data}
        me={me}
        onSent={() => void reload()}
      />
      <Toast toast={toast} />
    </>
  );
}
