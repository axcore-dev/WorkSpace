"use client";

import { useState } from "react";
import { DefinitionList } from "@/components/admin/admin-table";
import { Field } from "@/components/admin/form-parts";
import { EditHeader, EditModal, type Save } from "./shared";
import { IconAlertCircle, IconCheck, IconLink, IconPlus, IconX } from "@/components/icons";
import { Button, Card, FIELD, FIELD_ERROR } from "@/components/ui";
import type { AdminWorkspace } from "@/data/admin";

/* ── 담당자 ── */

/**
 * 데모 접속 링크. 실제 초대 링크는 BE가 1회용 토큰과 함께 발급한다 — 여기 값으로 초대되지 않는다.
 * 렌더가 아니라 클릭 핸들러에서만 부르므로 `window` 참조가 프리렌더를 깨지 않는다.
 */
function inviteUrl(schemaName: string) {
  return `${window.location.origin}/login?ws=${schemaName}`;
}

export function ContactsCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(ws.contacts);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact.email.trim());

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
      */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(inviteUrl(ws.schemaName));
              setCopied("ok");
            } catch {
              // 권한 거부·비보안 컨텍스트. 실패를 삼키지 않고 화면에서 알린다.
              setCopied("fail");
            }
            setTimeout(() => setCopied("idle"), 2200);
          }}
        >
          {copied === "ok" ? (
            <IconCheck size={14} />
          ) : copied === "fail" ? (
            <IconAlertCircle size={14} />
          ) : (
            <IconLink size={14} />
          )}
          {copied === "ok" ? "복사했어요" : copied === "fail" ? "복사하지 못했어요" : "접속 링크 복사"}
        </Button>
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
