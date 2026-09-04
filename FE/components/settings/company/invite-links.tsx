"use client";

import { useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui";
import { INVITE_LINKS } from "@/data/org";

/**
 * 초대 관리 › 초대 링크 탭.
 *
 * 열은 **링크 만료일시 · 링크 · 권한** (수정요청 v12). 사용 횟수·부서·활성 배지를 뺐다 —
 * 만료일시가 이미 "쓸 수 있나"를 말한다.
 *
 * **BE 연동 seam**: `deleteLink`가 링크 회수 API를 부른다.
 * `링크 만들기`는 역할·부서·횟수·만료일을 정하는 모달이 필요하다 — 다음 작업이다.
 */
export function InviteLinks({
  onSaved,
}: {
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  const [links, setLinks] = useState(INVITE_LINKS);

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
        <Button variant="secondary" size="sm">
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
    </>
  );
}
