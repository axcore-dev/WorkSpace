"use client";

import { useState } from "react";
import { AdminTable, DefinitionList, TD, TD_KEY, TD_WRAP, TR } from "@/components/admin/admin-table";
import { EditActions, Field, SiteFields } from "@/components/admin/form-parts";
import { EditHeader, type Save } from "./shared";
import { IconPlus, IconX } from "@/components/icons";
import { Button, Card, FIELD, FIELD_ERROR, SectionHeader } from "@/components/ui";
import type { AdminWorkspace, Site } from "@/data/admin";

export function OverviewTab({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <BizInfoCard ws={ws} onSave={onSave} />
        <SitesCard ws={ws} onSave={onSave} />
        <MemoCard ws={ws} onSave={onSave} />
      </div>

      <div className="space-y-4">
        <ContactsCard ws={ws} onSave={onSave} />

        <Card>
          <SectionHeader title="현황" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "멤버", value: `${ws.members.length}명` },
              { label: "연결된 시스템", value: `${ws.systems.length}개` },
              { label: "이번 달 사용량", value: `${ws.usage.storageGb} GB` },
              { label: "최근 활동", value: ws.lastActive },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-slate-200 px-3.5 py-3">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── 사업자 정보 ── */

function BizInfoCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState(ws);

  function open() {
    setD(ws);
    setEditing(true);
  }

  return (
    <Card>
      <EditHeader title="사업자 정보" editing={editing} onEdit={open} />

      {!editing ? (
        <DefinitionList
          rows={[
            ["사업자등록번호", <span key="b" className="tabular-nums">{ws.bizNumber}</span>],
            ["법인등록번호", <span key="c" className="tabular-nums">{ws.corpNumber || "—"}</span>],
            ["회사명", ws.company],
            ["업태 / 업종", `${ws.bizType || "—"} / ${ws.bizItem || "—"}`],
            ["본사 주소", ws.address],
            [
              "웹사이트",
              ws.website ? (
                <a
                  key="w"
                  href={ws.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-700 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-primary-800"
                >
                  {ws.website.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "—"
              ),
            ],
          ]}
        />
      ) : (
        <div className="space-y-4">
          <Field
            id="e-biz"
            label="사업자등록번호"
            hint="테넌트를 식별하는 키라 바꿀 수 없어요. 잘못 등록했다면 새로 개설해야 해요."
          >
            <input
              id="e-biz"
              value={ws.bizNumber}
              disabled
              className={`${FIELD} bg-slate-50 tabular-nums text-slate-400`}
            />
          </Field>

          <Field id="e-company" label="회사명" required>
            <input
              id="e-company"
              value={d.company}
              onChange={(e) => setD({ ...d, company: e.target.value })}
              className={FIELD}
            />
          </Field>

          <Field id="e-corp" label="법인등록번호">
            <input
              id="e-corp"
              value={d.corpNumber}
              onChange={(e) => setD({ ...d, corpNumber: e.target.value })}
              placeholder="000000-0000000"
              className={`${FIELD} tabular-nums`}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="e-type" label="업태">
              <input
                id="e-type"
                value={d.bizType}
                onChange={(e) => setD({ ...d, bizType: e.target.value })}
                className={FIELD}
              />
            </Field>
            <Field id="e-item" label="업종">
              <input
                id="e-item"
                value={d.bizItem}
                onChange={(e) => setD({ ...d, bizItem: e.target.value })}
                className={FIELD}
              />
            </Field>
          </div>

          <Field id="e-addr" label="본사 주소" required>
            <input
              id="e-addr"
              value={d.address}
              onChange={(e) => setD({ ...d, address: e.target.value })}
              className={FIELD}
            />
          </Field>

          <Field id="e-web" label="웹사이트">
            <input
              id="e-web"
              value={d.website}
              onChange={(e) => setD({ ...d, website: e.target.value })}
              placeholder="https://"
              className={FIELD}
            />
          </Field>

          <EditActions
            canSave={!!d.company.trim() && !!d.address.trim()}
            onCancel={() => setEditing(false)}
            onSave={() => {
              onSave({
                company: d.company.trim(),
                corpNumber: d.corpNumber.trim(),
                bizType: d.bizType.trim(),
                bizItem: d.bizItem.trim(),
                address: d.address.trim(),
                website: d.website.trim(),
              });
              setEditing(false);
            }}
          />
        </div>
      )}
    </Card>
  );
}

/* ── 종사업장 ── */

function SitesCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState<Site[]>(ws.sites);

  function open() {
    setD(ws.sites);
    setEditing(true);
  }

  return (
    <Card>
      <EditHeader title={`종사업장 ${ws.sites.length}곳`} editing={editing} onEdit={open} />

      {!editing ? (
        ws.sites.length === 0 ? (
          <p className="text-sm text-slate-400">등록된 종사업장이 없어요.</p>
        ) : (
          <AdminTable columns={["사업장명", "사업자등록번호", "주소", "업태 / 업종"]} minWidth={440}>
            {ws.sites.map((s, i) => (
              <tr key={`${s.name}-${i}`} className={TR}>
                <td className={TD_KEY}>{s.name}</td>
                <td className={`${TD} tabular-nums`}>{s.bizNumber}</td>
                <td className={TD_WRAP}>{s.address}</td>
                <td className={TD}>
                  {s.bizType} / {s.bizItem}
                </td>
              </tr>
            ))}
          </AdminTable>
        )
      ) : (
        <>
          <SiteFields sites={d} onChange={setD} idPrefix="edit-site" />
          <EditActions
            canSave={d.every((s) => s.name.trim())}
            onCancel={() => setEditing(false)}
            onSave={() => {
              onSave({ sites: d.filter((s) => s.name.trim()) });
              setEditing(false);
            }}
          />
        </>
      )}
    </Card>
  );
}

/* ── 내부 메모 ── */

function MemoCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState(ws.memo);

  function open() {
    setD(ws.memo);
    setEditing(true);
  }

  return (
    <Card>
      <EditHeader
        title="내부 메모"
        desc="고객에게는 보이지 않아요."
        editing={editing}
        onEdit={open}
      />

      {!editing ? (
        ws.memo ? (
          <p className="whitespace-pre-wrap text-sm text-slate-700">{ws.memo}</p>
        ) : (
          <p className="text-sm text-slate-400">메모가 없어요.</p>
        )
      ) : (
        <>
          <textarea
            value={d}
            onChange={(e) => setD(e.target.value)}
            rows={4}
            aria-label="내부 메모"
            placeholder="계약 특이사항, 후속 처리 등"
            className={FIELD}
          />
          <EditActions
            onCancel={() => setEditing(false)}
            onSave={() => {
              onSave({ memo: d });
              setEditing(false);
            }}
          />
        </>
      )}
    </Card>
  );
}

/* ── 담당자 ── */

function ContactsCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState(ws.contacts);
  const [resent, setResent] = useState(false);

  function open() {
    setD(ws.contacts);
    setEditing(true);
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.link.email.trim());

  return (
    <Card>
      <EditHeader title="담당자" editing={editing} onEdit={open} />

      {!editing ? (
        <>
          <p className="text-xs font-semibold text-slate-500">접속 링크 받는 사람</p>
          <div className="mt-2">
            <DefinitionList
              rows={[
                ["이름", ws.contacts.link.name],
                ["이메일", ws.contacts.link.email],
              ]}
            />
          </div>

          <p className="mt-4 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
            연락 담당
          </p>
          <div className="mt-2">
            <DefinitionList
              rows={[
                ["이름", ws.contacts.contact.name],
                ["이메일", ws.contacts.contact.email],
                ["연락처", <span key="p" className="tabular-nums">{ws.contacts.contact.phone}</span>],
                ["참조 수신", ws.contacts.cc.length > 0 ? ws.contacts.cc.join(", ") : "—"],
              ]}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              접속 링크 발송 {ws.linkSentAt} ·{" "}
              {ws.linkOpened ? (
                <span className="font-medium text-emerald-700">접속 완료</span>
              ) : (
                <span className="font-medium text-amber-700">아직 열지 않음</span>
              )}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto"
              disabled={resent}
              onClick={() => {
                setResent(true);
                setTimeout(() => setResent(false), 2200);
              }}
            >
              {resent ? "다시 보냈어요" : "링크 다시 보내기"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            링크는 <span className="font-medium text-slate-600">{ws.contacts.link.email}</span> 으로만
            나가요.
          </p>
        </>
      ) : (
        <div className="space-y-4">
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

          <EditActions
            canSave={!!d.link.name.trim() && emailOk}
            onCancel={() => setEditing(false)}
            onSave={() => {
              onSave({ contacts: { ...d, cc: d.cc.filter((x) => x.trim()) } });
              setEditing(false);
            }}
          />
        </div>
      )}
    </Card>
  );
}
