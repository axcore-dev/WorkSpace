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
  const [resent, setResent] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.link.email.trim());

  return (
    <Card>
      <EditHeader
        title="담당자"
        onEdit={() => {
          setD(ws.contacts);
          setOpen(true);
        }}
      />

      {/*
        접속 링크 받는 사람은 수정 팝업 안에서 보고 고친다. 읽기 뷰에서 두 블록으로 나뉘어 있던 것이
        카드를 길게 만들었고, 아래 링크 발송 줄이 이미 링크 상태를 알려준다 (수정요청v10 ③).
      */}
      <DefinitionList
        rows={[
          ["이름", ws.contacts.contact.name],
          ["이메일", ws.contacts.contact.email],
          ["연락처", <span key="p" className="tabular-nums">{ws.contacts.contact.phone}</span>],
          ["참조 수신", ws.contacts.cc.length > 0 ? ws.contacts.cc.join(", ") : "—"],
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          접속 링크 발송 {ws.linkSentAt} ·{" "}
          {ws.linkOpened ? (
            <span className="font-medium text-emerald-700">접속 완료</span>
          ) : (
            <span className="font-medium text-amber-700">아직 열지 않음</span>
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-label={
            copied === "ok"
              ? "접속 링크를 복사했어요"
              : copied === "fail"
                ? "접속 링크를 복사하지 못했어요"
                : "접속 링크 복사"
          }
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(inviteUrl(ws.schemaName));
              setCopied("ok");
            } catch {
              // 권한 거부·비보안 컨텍스트. 실패를 삼키지 않고 아이콘으로 알린다.
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
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={resent}
          onClick={() => {
            setResent(true);
            setTimeout(() => setResent(false), 2200);
          }}
        >
          {resent ? "다시 보냈어요" : "링크 다시 보내기"}
        </Button>
      </div>

      <EditModal
        open={open}
        onClose={() => setOpen(false)}
        title="담당자 수정"
        size="lg"
        canSave={!!d.link.name.trim() && emailOk}
        onSave={() => {
          onSave({ contacts: { ...d, cc: d.cc.filter((x) => x.trim()) } });
          setOpen(false);
        }}
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-700">접속 링크 받는 사람</p>
          <p className="mt-0.5 text-xs text-slate-500">
            이 주소를 바꾸면 다음부터 링크가 새 주소로 나가요. 이미 보낸 링크는 그대로예요.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field id="e-link-name" label="이름" required>
              <input
                id="e-link-name"
                value={d.link.name}
                onChange={(e) => setD({ ...d, link: { ...d.link, name: e.target.value } })}
                className={FIELD}
              />
            </Field>
            <Field
              id="e-link-email"
              label="이메일"
              required
              error={d.link.email && !emailOk ? "이메일 형식을 확인해 주세요." : undefined}
            >
              <input
                id="e-link-email"
                type="email"
                value={d.link.email}
                onChange={(e) => setD({ ...d, link: { ...d.link, email: e.target.value } })}
                aria-invalid={(!!d.link.email && !emailOk) || undefined}
                className={d.link.email && !emailOk ? FIELD_ERROR : FIELD}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-700">연락 담당</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field id="e-c-name" label="이름">
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
          <div className="mt-4">
            <Field id="e-c-email" label="이메일">
              <input
                id="e-c-email"
                type="email"
                value={d.contact.email}
                onChange={(e) => setD({ ...d, contact: { ...d.contact, email: e.target.value } })}
                className={FIELD}
              />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">참조 수신</p>
          <p className="mb-2 text-xs text-slate-400">발송 메일에 CC로 함께 들어가요.</p>
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
