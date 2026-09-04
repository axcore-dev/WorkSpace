"use client";

import { useState } from "react";
import { InviteModal } from "@/components/settings/invite-modal";
import { InviteLinks } from "@/components/settings/admin/invite-links";
import { InvitePolicy } from "@/components/settings/admin/invite-policy";
import { MemberTable } from "@/components/settings/admin/member-table";
import { PendingInvites } from "@/components/settings/admin/pending-invites";
import { IconLink, IconMail, IconShield, IconUsers } from "@/components/icons";
import { Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import { INVITE_LINKS, PENDING_INVITES, USERS_ROLES } from "@/data/org";

type TabId = "members" | "pending" | "links" | "policy";

/**
 * 관리 › 초대 관리 — 인라인 탭 4개.
 *
 * 구성원·초대 중·초대 링크·초대 정책을 네 라우트로 쪼개지 않는다. 넷 다 "누가 있고 누가
 * 들어오는 중인가"라서 오가며 보고, 라우트로 나누면 왕복마다 화면이 갈린다
 * (DESIGN.md 「페이지 안 탭」).
 *
 * 탭은 `ui.tsx`에 넣지 않았다 — 쓰는 곳이 이 화면뿐이다. 두 번째 화면이 필요해지면 그때 뽑는다.
 *
 * 탭 상태는 `useState`다. URL 쿼리(`?tab=pending`)로 딥링크를 만들 수도 있지만 지금은
 * 링크를 주고받을 상황이 아니다.
 * ponytail: 링크 공유가 필요해지면 `useSearchParams`로 올린다.
 */
export function PeopleManager() {
  const [tab, setTab] = useState<TabId>("members");
  const [toast, showToast] = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);

  const TABS: { id: TabId; label: string; icon: typeof IconUsers; count?: number }[] = [
    { id: "members", label: "구성원", icon: IconUsers, count: USERS_ROLES.length },
    { id: "pending", label: "초대 중인 구성원", icon: IconMail, count: PENDING_INVITES.length },
    { id: "links", label: "초대 링크", icon: IconLink, count: INVITE_LINKS.length },
    // 정책은 개수가 의미 없어 생략한다 (DESIGN.md 「페이지 안 탭」)
    { id: "policy", label: "초대 정책", icon: IconShield },
  ];

  return (
    <>
      <div
        role="tablist"
        aria-label="초대 관리"
        className="thin-scroll mt-4 flex gap-1 overflow-x-auto border-b border-slate-200"
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
              {t.count !== undefined && (
                <span className="font-normal text-slate-400">({t.count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 탭 하나만 DOM에 둔다 — 초대 목록은 다시 읽어도 되는 값이라 패널마다 상태를
          유지할 이유가 없다. `aria-labelledby`가 활성 탭을 따라간다. */}
      <div id="people-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "members" && (
          <MemberTable onSaved={showToast} onInvite={() => setInviteOpen(true)} />
        )}
        {tab === "pending" && (
          <PendingInvites onSaved={showToast} onInvite={() => setInviteOpen(true)} />
        )}
        {tab === "links" && <InviteLinks onSaved={showToast} />}
        {tab === "policy" && <InvitePolicy onSaved={showToast} />}
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <Toast toast={toast} />
    </>
  );
}
