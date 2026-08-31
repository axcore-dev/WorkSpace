"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AdminTable, DefinitionList, TD, TD_KEY, TD_WRAP, TR } from "@/components/admin/admin-table";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { EditActions, Field, SiteFields } from "@/components/admin/form-parts";
import { Modal } from "@/components/modal";
import { IconAlertTriangle, IconPencil, IconPlus, IconSearch, IconX } from "@/components/icons";
import {
  Badge,
  Button,
  Card,
  FIELD,
  FIELD_ERROR,
  FIELD_INLINE,
  ProgressBar,
  SectionHeader,
} from "@/components/ui";
import {
  ADMIN_WORKSPACES,
  BILLING_STATE_LABEL,
  PLANS,
  KRW,
  MAPPING_STATE_LABEL,
  SYSTEM_STATE_LABEL,
  WS_STATUS_LABEL,
  estimateAmount,
  type AdminWorkspace,
  type BillingState,
  type MappingState,
  type Plan,
  type Site,
  type SystemState,
  type WsStatus,
} from "@/data/admin";

type Save = (patch: Partial<AdminWorkspace>) => void;

/** 카드 제목 + '수정' 버튼. 편집 중일 때는 버튼을 숨긴다 */
function EditHeader({
  title,
  desc,
  editing,
  onEdit,
}: {
  title: string;
  desc?: string;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <SectionHeader
      title={title}
      desc={desc}
      action={
        editing ? undefined : (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <IconPencil size={13} />
            수정
          </Button>
        )
      }
    />
  );
}

const TABS = ["개요", "멤버", "외부 시스템 연동", "사용량 · 요금"] as const;
type Tab = (typeof TABS)[number];

const STATUS_TONE: Record<WsStatus, "green" | "slate" | "amber"> = {
  live: "green",
  invited: "slate",
  suspended: "amber",
};
const SYSTEM_TONE: Record<SystemState, "green" | "red" | "slate"> = {
  ok: "green",
  authFail: "red",
  idle: "slate",
};
const MAPPING_TONE: Record<MappingState, "green" | "amber" | "red"> = {
  mapped: "green",
  review: "amber",
  unmapped: "red",
};
const BILLING_TONE: Record<BillingState, "green" | "slate" | "red"> = {
  paid: "green",
  due: "slate",
  overdue: "red",
};

export default function AdminWorkspaceDetailPage() {
  const slug = useParams().slug as string;
  /**
   * 수정 결과는 이 화면 안에서만 유지된다 — 저장할 BE가 없다.
   * 새로고침하면 `data/admin.ts`의 원래 값으로 돌아간다.
   */
  const [ws, setWs] = useState(() => ADMIN_WORKSPACES.find((w) => w.slug === slug));

  function save(patch: Partial<AdminWorkspace>) {
    setWs((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  const [tab, setTab] = useState<Tab>("개요");
  /** 중지·재개는 데모라 화면 안에서만 바뀐다 */
  const [status, setStatus] = useState<WsStatus | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  if (!ws) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm font-semibold text-slate-900">워크스페이스를 찾을 수 없어요</p>
        <p className="mt-1 text-sm text-slate-500">주소의 워크스페이스 이름을 확인해 주세요.</p>
        <Button variant="secondary" className="mt-5" href="/admin/workspaces">
          목록으로
        </Button>
      </div>
    );
  }

  const current = status ?? ws.status;
  const suspended = current === "suspended";

  return (
    <div>
      <Breadcrumb
        items={[{ label: "워크스페이스", href: "/admin/workspaces" }, { label: ws.company }]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">
            {ws.company} · <span className="font-mono text-lg text-slate-600">{ws.slug}</span>
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            사업자등록번호 <span className="tabular-nums">{ws.bizNumber}</span> · 생성 {ws.createdAt} ·
            담당 운영자 {ws.operator}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge tone={STATUS_TONE[current]}>{WS_STATUS_LABEL[current]}</Badge>
          {suspended ? (
            <Button variant="secondary" onClick={() => setStatus("live")}>
              재개
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmSuspend(true)}>
              중지
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px cursor-pointer border-b-2 px-3.5 py-2.5 text-sm transition-colors duration-150 ${
              tab === t
                ? "border-slate-800 font-semibold text-slate-900"
                : "border-transparent font-medium text-slate-500 hover:text-slate-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "개요" && <Overview ws={ws} onSave={save} />}
        {tab === "멤버" && <Members ws={ws} />}
        {tab === "외부 시스템 연동" && <Integrations ws={ws} />}
        {tab === "사용량 · 요금" && <Usage ws={ws} onSave={save} />}
      </div>

      <Modal
        open={confirmSuspend}
        onClose={() => setConfirmSuspend(false)}
        size="sm"
        title="워크스페이스를 중지할까요?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmSuspend(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setStatus("suspended");
                setConfirmSuspend(false);
              }}
            >
              중지
            </Button>
          </div>
        }
      >
        <div className="space-y-3 p-5 text-sm text-slate-600">
          <p className="flex items-start gap-2.5">
            <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <span>
              <span className="font-semibold text-slate-900">{ws.company}</span>의 구성원{" "}
              {ws.members.length}명이 워크스페이스에 접속할 수 없게 돼요.
            </span>
          </p>
          <p>
            데이터와 연동 설정은 그대로 남아 있고, 언제든 재개할 수 있어요. 외부 시스템 동기화는
            중지 동안 멈춥니다.
          </p>
        </div>
      </Modal>
    </div>
  );
}

/* ────────────────────────── 개요 ────────────────────────── */

function Overview({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
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

/* ────────────────────────── 멤버 (보기 전용) ────────────────────────── */

function Members({ ws }: { ws: AdminWorkspace }) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ws.members;
    return ws.members.filter(
      (m) => m.email.toLowerCase().includes(needle) || (m.name ?? "").toLowerCase().includes(needle),
    );
  }, [q, ws.members]);

  return (
    <Card>
      <SectionHeader
        title={`멤버 ${ws.members.length}명`}
        desc="보기 전용이에요. 멤버 초대·권한 변경은 고객사 담당자가 자기 화면에서 해요."
      />

      {ws.members.length === 0 ? (
        <p className="text-sm text-slate-400">
          아직 멤버가 없어요. 접속 링크 받는 사람이 링크를 열면 첫 관리자로 등록돼요.
        </p>
      ) : (
        <>
          <div className="relative mb-4 max-w-xs">
            <IconSearch
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 또는 이메일"
              aria-label="멤버 검색"
              className={`${FIELD} pl-9`}
            />
          </div>

          <AdminTable
            columns={["이름", "이메일", "권한", "상태", "초대일", "마지막 접속"]}
            minWidth={720}
          >
            {rows.map((m) => (
              <tr key={m.email} className={TR}>
                <td className={TD_KEY}>{m.name ?? "—"}</td>
                <td className={TD}>{m.email}</td>
                <td className={TD}>{m.role}</td>
                <td className={TD}>
                  {m.state === "active" ? (
                    <Badge tone="green">사용 중</Badge>
                  ) : (
                    <Badge tone="slate">초대 대기</Badge>
                  )}
                </td>
                <td className={TD}>{m.invitedAt}</td>
                <td className={TD}>{m.lastSeen}</td>
              </tr>
            ))}
          </AdminTable>

          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              검색 결과가 없어요. 다른 이름이나 이메일로 찾아보세요.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/* ────────────────────── 외부 시스템 연동 (온톨로지 매핑 중심) ────────────────────── */

function Integrations({ ws }: { ws: AdminWorkspace }) {
  const [state, setState] = useState<MappingState | "all">("all");
  const [system, setSystem] = useState("all");

  const counts = useMemo(
    () => ({
      mapped: ws.mappings.filter((m) => m.state === "mapped").length,
      review: ws.mappings.filter((m) => m.state === "review").length,
      unmapped: ws.mappings.filter((m) => m.state === "unmapped").length,
    }),
    [ws.mappings],
  );

  const rows = useMemo(
    () =>
      ws.mappings.filter(
        (m) => (state === "all" || m.state === state) && (system === "all" || m.system === system),
      ),
    [ws.mappings, state, system],
  );

  if (ws.systems.length === 0) {
    return (
      <Card>
        <SectionHeader title="연결된 시스템" />
        <p className="text-sm text-slate-400">
          아직 연결된 외부 시스템이 없어요. ERP·MES를 연결하면 온톨로지 AI가 항목을 이어 붙여요.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 매핑이 이 탭의 주인공 — 시스템 목록은 위에 요약으로 둔다 */}
      <Card>
        <SectionHeader
          title="온톨로지 매핑"
          desc="원본 항목을 온톨로지 개념에 이어 붙인 결과예요. 확신도가 낮으면 사람이 확인해야 해요."
        />

        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "mapped" as const, label: "매핑됨", value: counts.mapped, tone: "text-emerald-700" },
            { key: "review" as const, label: "검토 필요", value: counts.review, tone: "text-amber-700" },
            { key: "unmapped" as const, label: "미매핑", value: counts.unmapped, tone: "text-red-700" },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={state === c.key}
              onClick={() => setState(state === c.key ? "all" : c.key)}
              className={`cursor-pointer rounded-lg border px-3.5 py-3 text-left transition-colors ${
                state === c.key
                  ? "border-slate-400 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
              }`}
            >
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className={`mt-0.5 text-lg font-bold tabular-nums ${c.tone}`}>{c.value}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <select
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            aria-label="시스템 필터"
            className={`${FIELD_INLINE} cursor-pointer`}
          >
            <option value="all">시스템: 전체</option>
            {ws.systems.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
          {state !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setState("all")}>
              {MAPPING_STATE_LABEL[state]} 필터 해제
            </Button>
          )}
          <span className="ml-auto text-xs text-slate-400">{rows.length}개 항목</span>
        </div>

        <div className="mt-4">
          <AdminTable
            columns={["시스템", "원본 항목", "온톨로지 개념", "확신도", "상태"]}
            minWidth={680}
          >
            {rows.map((m) => (
              <tr key={`${m.system}-${m.source}`} className={TR}>
                <td className={TD}>{m.system}</td>
                <td className={`${TD_KEY} font-mono`}>{m.source}</td>
                <td className={TD}>{m.concept}</td>
                <td className={TD}>
                  <span className="flex items-center gap-2">
                    <span className="w-9 shrink-0 tabular-nums">{m.confidence}%</span>
                    <ProgressBar
                      value={m.confidence}
                      tone={m.confidence >= 90 ? "green" : m.confidence >= 70 ? "amber" : "red"}
                      className="w-16"
                    />
                  </span>
                </td>
                <td className={TD}>
                  <Badge tone={MAPPING_TONE[m.state]}>{MAPPING_STATE_LABEL[m.state]}</Badge>
                </td>
              </tr>
            ))}
          </AdminTable>

          {rows.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              조건에 맞는 항목이 없어요. 필터를 넓혀 보세요.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeader title="연결된 시스템" desc="연결 상태와 마지막 동기화 시각이에요." />
        <AdminTable columns={["시스템", "종류", "사업장", "연결 상태", "마지막 동기화"]} minWidth={620}>
          {ws.systems.map((s) => (
            <tr key={s.name} className={TR}>
              <td className={TD_KEY}>{s.name}</td>
              <td className={TD}>{s.kind}</td>
              <td className={TD}>{s.site}</td>
              <td className={TD}>
                <Badge tone={SYSTEM_TONE[s.state]}>{SYSTEM_STATE_LABEL[s.state]}</Badge>
              </td>
              <td className={TD}>{s.lastSync}</td>
            </tr>
          ))}
        </AdminTable>
        {ws.systems.some((s) => s.state === "authFail") && (
          <p className="mt-3 flex items-start gap-2 text-xs text-red-600">
            <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
            인증이 실패한 시스템은 매핑이 갱신되지 않아요. 고객사에 접속 정보 재발급을 요청해 주세요.
          </p>
        )}
      </Card>
    </div>
  );
}

/* ── 요금제·청구 정보 (사용량 탭) ── */

function PlanCard({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<Plan>(ws.plan);
  const [taxEmail, setTaxEmail] = useState(ws.taxEmail);

  function open() {
    setPlan(ws.plan);
    setTaxEmail(ws.taxEmail);
    setEditing(true);
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={open}>
            <IconPencil size={13} />
            수정
          </Button>
        </div>
        <DefinitionList
          rows={[
            ["요금제", ws.plan],
            [
              "이번 달 예상 금액",
              <span key="a" className="font-semibold tabular-nums">
                {KRW.format(estimateAmount(ws))}원
              </span>,
            ],
            ["세금계산서 수신", ws.taxEmail || "—"],
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field id="e-plan" label="요금제" hint="바꾸면 이번 달 예상 금액이 함께 바뀌어요.">
        <select
          id="e-plan"
          value={plan}
          onChange={(e) => setPlan(e.target.value as Plan)}
          className={`${FIELD} cursor-pointer`}
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field id="e-tax" label="세금계산서 수신">
        <input
          id="e-tax"
          type="email"
          value={taxEmail}
          onChange={(e) => setTaxEmail(e.target.value)}
          placeholder="tax@company.co.kr"
          className={FIELD}
        />
      </Field>

      <EditActions
        onCancel={() => setEditing(false)}
        onSave={() => {
          onSave({ plan, taxEmail: taxEmail.trim() });
          setEditing(false);
        }}
      />
    </div>
  );
}

/* ────────────────────────── 사용량 · 요금 ────────────────────────── */

function Usage({ ws, onSave }: { ws: AdminWorkspace; onSave: Save }) {
  const u = ws.usage;
  const bars = [
    { label: "저장 용량", used: u.storageGb, limit: u.storageLimitGb, unit: " GB" },
    { label: "조회 건수", used: u.queries, limit: u.queryLimit, unit: "회" },
    { label: "연동 동기화", used: u.syncs, limit: u.syncLimit, unit: "회" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="이번 달 사용량" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {bars.map((b) => {
              const pct = b.limit ? Math.min(100, Math.round((b.used / b.limit) * 100)) : 0;
              return (
                <div key={b.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{b.label}</span>
                    <span className="tabular-nums text-slate-500">
                      {KRW.format(b.used)}
                      {b.unit} / {b.limit === null ? "무제한" : `${KRW.format(b.limit)}${b.unit}`}
                    </span>
                  </div>
                  <ProgressBar
                    value={pct}
                    tone={pct >= 90 ? "red" : pct >= 75 ? "amber" : "slate"}
                    className="mt-1.5"
                  />
                  {b.limit !== null && pct >= 75 && (
                    <p className="mt-1 text-xs text-amber-700">
                      한도의 {pct}%를 썼어요. 상위 요금제를 안내할 시점이에요.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <PlanCard ws={ws} onSave={onSave} />
        </div>
      </Card>

      <Card>
        <SectionHeader title="청구 내역" />
        {ws.invoices.length === 0 ? (
          <p className="text-sm text-slate-400">아직 청구 내역이 없어요.</p>
        ) : (
          <AdminTable columns={["기간", "요금제", "사용량", "금액", "상태"]} minWidth={560}>
            {ws.invoices.map((iv) => (
              <tr key={iv.period} className={TR}>
                <td className={`${TD_KEY} tabular-nums`}>{iv.period}</td>
                <td className={TD}>{iv.plan}</td>
                <td className={`${TD} tabular-nums`}>{iv.usage}</td>
                <td className={`${TD} tabular-nums`}>{KRW.format(iv.amount)}원</td>
                <td className={TD}>
                  <Badge tone={BILLING_TONE[iv.state]}>{BILLING_STATE_LABEL[iv.state]}</Badge>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </Card>
    </div>
  );
}
