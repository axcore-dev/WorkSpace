"use client";

import { useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { LinkCreateModal, type NewLink } from "@/components/settings/company/link-create-modal";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui";
import { INVITE_LINKS } from "@/data/org";

/**
 * 초대 관리 › 초대 링크 탭.
 *
 * 열은 **링크 만료일시 · 링크 · 권한** (수정요청 v12). 사용 횟수·부서·활성 배지를 뺐다 —
 * 만료일시가 이미 "쓸 수 있나"를 말한다.
 *
 * **BE 연동 seam**: `deleteLink`가 링크 회수 API를, `create`가 발급 API를 부른다.
 * 지금은 URL을 화면에서 만든다 — 실제 토큰은 **서버가 만들어야 한다.** 추측할 수 있는
 * 토큰이면 링크를 받지 않은 사람도 들어온다.
 */
export function InviteLinks({
  onSaved,
}: {
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const [links, setLinks] = useState(INVITE_LINKS);
  const [creating, setCreating] = useState(false);

  function create(next: NewLink) {
    setLinks((prev) => [
      {
        id: `link-${Date.now()}`,
        // 데모용 난수. BE가 붙으면 서버가 준 URL을 그대로 쓴다
        url: `https://axcore.it.kr/invite/${Math.random().toString(36).slice(2, 10)}`,
        used: 0,
        active: true,
        ...next,
      },
      ...prev,
    ]);
    setCreating(false);
    onSaved(`${next.dept} ${next.role} 링크를 만들었어요 · ${next.limit}명까지`);
  }

  function deleteLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    onSaved("초대 링크를 지웠어요");
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      onSaved("링크를 복사했어요");
    } catch {
      onSaved("복사하지 못했어요. 직접 선택해 주세요", "error");
    }
  }

  return (
    <>
      <div className="flex items-center justify-end pt-4">
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
          <IconPlus size={14} />
          링크 만들기
        </Button>
      </div>

      <DataTable
        rows={links}
        rowKey={(l) => l.id}
        columns={[
          {
            label: "링크 만료일시",
            cell: (l) => (
              // 만료된 링크는 값을 흐리게 — 남은 열을 읽기 전에 못 쓴다는 걸 안다
              <span className={l.active ? "text-slate-600" : "text-slate-400 line-through"}>
                {l.expiresAt}
              </span>
            ),
          },
          {
            label: "링크",
            cell: (l) => (
              <code className="font-mono text-xs text-slate-900">{l.url}</code>
            ),
          },
          { label: "권한", cell: (l) => <span className="text-slate-600">{l.role}</span> },
          {
            label: "",
            right: true,
            cell: (l) => (
              <span className="inline-flex gap-1">
                {l.active && (
                  <Button variant="ghost" size="sm" onClick={() => void copyLink(l.url)}>
                    복사
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => deleteLink(l.id)}>
                  삭제
                </Button>
              </span>
            ),
          },
        ]}
      />

      {/* 열 때만 마운트한다 — 닫으면 고르던 값이 사라진다 */}
      {creating && (
        <LinkCreateModal onClose={() => setCreating(false)} onCreate={create} />
      )}
    </>
  );
}
