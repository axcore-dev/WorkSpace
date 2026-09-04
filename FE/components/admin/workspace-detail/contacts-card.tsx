"use client";

import { useState } from "react";
import { DefinitionList } from "@/components/admin/admin-table";
import { Field } from "@/components/admin/form-parts";
import { EditHeader, EditModal, type Save } from "./shared";
import { IconAlertCircle, IconCheck, IconLink, IconPlus, IconX } from "@/components/icons";
import { Button, Card, FIELD, FIELD_ERROR } from "@/components/ui";
import { ApiRequestError } from "@/lib/api";
import { issueInviteLink, workspaceIdFromSchema } from "@/lib/admin-api";
import type { AdminWorkspace } from "@/data/admin";

/* ── 담당자 ── */

type LinkState =
  | { kind: "idle" }
  | { kind: "issuing" }
  /** 발급됐고 클립보드 복사까지 됐다 */
  | { kind: "copied"; link: string }
  /** 발급은 됐는데 클립보드 복사가 막혔다(권한 거부·비보안 컨텍스트). 링크는 화면에 보여 준다 */
  | { kind: "issued"; link: string }
  | { kind: "fail"; message: string };

export function ContactsCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(ws.contacts);
  const [link, setLink] = useState<LinkState>({ kind: "idle" });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact.email.trim());

  /**
   * 접속 링크 발급 + 복사.
   *
   * 전에는 `/login?ws=<schema>` 라는 데모 주소를 복사했다 — BE 는 그 값으로 아무도 초대하지 않는다.
   * 실제 링크는 BE 가 1회용 토큰과 함께 발급하고(`POST /api/admin/workspaces/{id}/invitations`),
   * 토큰은 SHA-256 해시로만 저장돼 **개설 때 받은 링크를 다시 꺼낼 수 없다.** 그래서 이 버튼은
   * 매번 새로 발급한다. BE 는 같은 담당자 앞으로 남아 있던 링크를 회수하고 새로 낸다 — 담당자에게
   * 이미 보낸 링크가 있으면 그 링크는 무효가 된다. 복사한 것을 보내고 끝낸다.
   */
  async function issueAndCopy() {
    const id = workspaceIdFromSchema(ws.schemaName);
    if (id === null) {
      setLink({ kind: "fail", message: "워크스페이스 식별자를 확인할 수 없어요" });
      return;
    }
    setLink({ kind: "issuing" });
    try {
      const issued = await issueInviteLink(id);
      if (!issued?.link) {
        setLink({ kind: "fail", message: "서버가 링크를 돌려주지 않았어요" });
        return;
      }
      try {
        await navigator.clipboard.writeText(issued.link);
        setLink({ kind: "copied", link: issued.link });
      } catch {
        // 클립보드가 막혀도 발급은 끝났다. 링크를 보여 주고 손으로 복사하게 한다.
        setLink({ kind: "issued", link: issued.link });
      }
    } catch (e: unknown) {
      setLink({
        kind: "fail",
        message:
          e instanceof ApiRequestError
            ? e.message
            : "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요",
      });
    }
  }

  return (
    <Card>
      <EditHeader
        title="담당자"
        onEdit={() => {
          setD(ws.contacts);
          setOpen(true);
        }}
      />

      <DefinitionList
        rows={[
          ["이름", ws.contacts.contact.name],
          ["이메일", ws.contacts.contact.email],
          ["연락처", <span key="p" className="tabular-nums">{ws.contacts.contact.phone}</span>],
          ["참조 수신", ws.contacts.cc.length > 0 ? ws.contacts.cc.join(", ") : "—"],
        ]}
      />

      {/*
        접속 링크는 운영팀이 복사해서 직접 보낸다 — 시스템이 메일을 쏘지 않는다.
        그래서 이 버튼이 이 카드의 유일한 동작이고, 아이콘만 두지 않고 이름을 붙였다.
        발급된 링크는 이 자리에 남겨 둔다 — 클립보드가 막힌 환경에서도 손으로 복사할 수 있어야 한다.
      */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={link.kind === "issuing"}
            onClick={() => void issueAndCopy()}
          >
            {link.kind === "copied" ? (
              <IconCheck size={14} />
            ) : link.kind === "fail" ? (
              <IconAlertCircle size={14} />
            ) : (
              <IconLink size={14} />
            )}
            {link.kind === "issuing"
              ? "발급 중…"
              : link.kind === "copied"
                ? "새 링크를 복사했어요"
                : link.kind === "issued"
                  ? "발급됐어요 — 아래에서 복사"
                  : link.kind === "fail"
                    ? "발급하지 못했어요"
                    : "새 접속 링크 발급·복사"}
          </Button>
          <p className="text-xs text-slate-400">
            누를 때마다 새 링크가 나가고, 담당자에게 먼저 보낸 링크는 무효가 돼요.
          </p>
        </div>

        {(link.kind === "copied" || link.kind === "issued") && (
          <input
            readOnly
            value={link.link}
            aria-label="접속 링크"
            onFocus={(e) => e.currentTarget.select()}
            className={`${FIELD} mt-3 w-full font-mono text-xs`}
          />
        )}
        {link.kind === "fail" && (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {link.message}
          </p>
        )}
      </div>

      <EditModal
        open={open}
        onClose={() => setOpen(false)}
        title="담당자 수정"
        canSave={!!d.contact.name.trim() && emailOk}
        onSave={() => {
          onSave({ contacts: { ...d, cc: d.cc.filter((x) => x.trim()) } });
          setOpen(false);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="e-c-name" label="이름" required>
            <input
              id="e-c-name"
              value={d.contact.name}
              onChange={(e) => setD({ ...d, contact: { ...d.contact, name: e.target.value } })}
              className={FIELD}
            />
          </Field>
          <Field id="e-c-phone" label="연락처">
            <input
              id="e-c-phone"
              value={d.contact.phone}
              onChange={(e) => setD({ ...d, contact: { ...d.contact, phone: e.target.value } })}
              className={`${FIELD} tabular-nums`}
            />
          </Field>
        </div>

        <Field
          id="e-c-email"
          label="이메일"
          required
          error={d.contact.email && !emailOk ? "이메일 형식을 확인해 주세요." : undefined}
        >
          <input
            id="e-c-email"
            type="email"
            value={d.contact.email}
            onChange={(e) => setD({ ...d, contact: { ...d.contact, email: e.target.value } })}
            aria-invalid={(!!d.contact.email && !emailOk) || undefined}
            className={d.contact.email && !emailOk ? FIELD_ERROR : FIELD}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">참조 수신</p>
          <p className="mb-2 text-xs text-slate-400">링크를 보낼 때 함께 넣을 주소예요.</p>
          <div className="space-y-2">
            {d.cc.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="email"
                  value={v}
                  onChange={(e) =>
                    setD({ ...d, cc: d.cc.map((x, j) => (j === i ? e.target.value : x)) })
                  }
                  aria-label={`참조 수신 ${i + 1}`}
                  placeholder="추가 이메일"
                  className={`${FIELD} flex-1`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`참조 수신 ${i + 1} 삭제`}
                  onClick={() => setD({ ...d, cc: d.cc.filter((_, j) => j !== i) })}
                >
                  <IconX size={14} />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className={d.cc.length > 0 ? "mt-2" : undefined}
            onClick={() => setD({ ...d, cc: [...d.cc, ""] })}
          >
            <IconPlus size={13} />한 줄 더
          </Button>
        </div>
      </EditModal>
    </Card>
  );
}
