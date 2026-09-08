"use client";

import { useState } from "react";
import { DataTable } from "@/components/settings/company/data-table";
import { LinkCreateModal, type NewLink } from "@/components/settings/company/link-create-modal";
import type { PeopleData } from "@/components/settings/company/people-manager";
import { IconPlus } from "@/components/icons";
import { Button } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { createInviteLink, revokeInviteLink, type WorkspaceMeDto } from "@/lib/workspace-api";

/**
 * 초대 관리 › 초대 링크 탭.
 *
 * 열은 **링크 만료일시 · 링크 · 권한** (수정요청 v12). 부서·활성 배지를 뺐다 —
 * 만료일시가 이미 "쓸 수 있나"를 말하고, 사용 횟수는 링크 열에 함께 적는다.
 *
 * **링크 원문은 만든 직후에만 보인다.** 서버는 토큰의 해시만 저장한다(`shared.workspace_invite_links`) —
 * 새로고침하면 다시 볼 수 없다. 그래서 만들면 바로 클립보드에 복사하고, 이 세션 동안만 표에 남긴다.
 * 잃어버렸으면 지우고 새로 만든다. 지우기는 회수다 — 그 순간부터 아무도 못 쓴다.
 */
export function InviteLinks({
  data,
  me,
  onSaved,
  onChanged,
}: {
  data: PeopleData;
  me: WorkspaceMeDto | null;
  onSaved: (message: string, tone?: "ink" | "error") => void;
  onChanged: () => Promise<void>;
}) {
  const { links } = data;
  // 소유자만 만들고 지운다
  const canManage = !!me?.member.owner;
  const [creating, setCreating] = useState(false);
  /** 이 세션에서 만든 링크의 원문. 서버에는 없다 */
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function create(next: NewLink) {
    try {
      const made = await createInviteLink(next);
      if (made.url) {
        setUrls((prev) => ({ ...prev, [made.id]: made.url! }));
        try {
          await navigator.clipboard.writeText(made.url);
          onSaved(`${made.roleName ?? "구성원"} 링크를 만들고 복사했어요 · ${made.maxUses}명까지`);
        } catch {
          onSaved(`${made.roleName ?? "구성원"} 링크를 만들었어요 · 표에서 복사해 주세요`);
        }
      }
      setCreating(false);
      await onChanged();
    } catch (e) {
      onSaved(e instanceof ApiRequestError ? e.body.message : "링크를 만들지 못했어요", "error");
    }
  }

  async function deleteLink(id: string) {
    setBusy(id);
    try {
      await revokeInviteLink(id);
      await onChanged();
      onSaved("초대 링크를 지웠어요");
    } catch (e) {
      onSaved(e instanceof ApiRequestError ? e.body.message : "지우지 못했어요", "error");
    } finally {
      setBusy(null);
    }
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
      {canManage && (
        <div className="flex items-center justify-end pt-4">
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            <IconPlus size={14} />
            링크 만들기
          </Button>
        </div>
      )}

      <DataTable
        rows={links}
        rowKey={(l) => l.id}
        empty="초대 링크가 없어요"
        columns={[
          {
            label: "링크 만료일시",
            cell: (l) => (
              // 못 쓰는 링크는 값을 흐리게 — 남은 열을 읽기 전에 못 쓴다는 걸 안다
              <span className={l.active ? "text-slate-600" : "text-slate-400 line-through"}>
                {/* 만료가 하루 안에 갈리는 링크가 있어 시각까지. sv-SE 가 `YYYY-MM-DD HH:mm` 을 낸다 */}
                {new Date(l.expiresAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}
              </span>
            ),
          },
          {
            label: "링크",
            cell: (l) => {
              const url = urls[l.id];
              return (
                <span className="flex flex-col gap-0.5">
                  {url ? (
                    <code className="font-mono text-xs text-slate-900">{url}</code>
                  ) : (
                    <span className="text-xs text-slate-400">만든 직후에만 볼 수 있어요</span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {l.useCount}/{l.maxUses}명 사용{l.revokedAt ? " · 지워짐" : ""}
                  </span>
                </span>
              );
            },
          },
          {
            label: "권한",
            cell: (l) => (
              <span className="text-slate-600">
                {l.roleName ?? "구성원"}
                {l.departmentName && <span className="ml-1.5 text-xs text-slate-400">{l.departmentName}</span>}
              </span>
            ),
          },
          {
            label: "",
            right: true,
            cell: (l) => (
              <span className="inline-flex gap-1">
                {l.active && urls[l.id] && (
                  <Button variant="ghost" size="sm" onClick={() => void copyLink(urls[l.id])}>
                    복사
                  </Button>
                )}
                {canManage && !l.revokedAt && (
                  <Button variant="ghost" size="sm" disabled={busy === l.id} onClick={() => void deleteLink(l.id)}>
                    삭제
                  </Button>
                )}
              </span>
            ),
          },
        ]}
      />

      {/* 열 때만 마운트한다 — 닫으면 고르던 값이 사라진다 */}
      {creating && <LinkCreateModal data={data} me={me} onClose={() => setCreating(false)} onCreate={create} />}
    </>
  );
}
