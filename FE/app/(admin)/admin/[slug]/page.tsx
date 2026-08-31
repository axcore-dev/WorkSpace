"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AdminTable, DefinitionList, TD, TD_KEY, TD_WRAP, TR } from "@/components/admin/admin-table";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { Modal } from "@/components/modal";
import { IconAlertTriangle, IconSearch } from "@/components/icons";
import { Badge, Button, Card, FIELD, FIELD_INLINE, ProgressBar, SectionHeader } from "@/components/ui";
import {
  ADMIN_WORKSPACES,
  BILLING_STATE_LABEL,
  KRW,
  MAPPING_STATE_LABEL,
  SYSTEM_STATE_LABEL,
  WS_STATUS_LABEL,
  estimateAmount,
  type AdminWorkspace,
  type BillingState,
  type MappingState,
  type SystemState,
  type WsStatus,
} from "@/data/admin";

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
  const ws = ADMIN_WORKSPACES.find((w) => w.slug === slug);

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
        {tab === "개요" && <Overview ws={ws} />}
        {tab === "멤버" && <Members ws={ws} />}
        {tab === "외부 시스템 연동" && <Integrations ws={ws} />}
        {tab === "사용량 · 요금" && <Usage ws={ws} />}
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

function Overview({ ws }: { ws: AdminWorkspace }) {
  const [resent, setResent] = useState(false);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Card>
          <SectionHeader title="사업자 정보" />
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
        </Card>

        <Card>
          <SectionHeader title={`종사업장 ${ws.sites.length}곳`} />
          {ws.sites.length === 0 ? (
            <p className="text-sm text-slate-400">등록된 종사업장이 없어요.</p>
          ) : (
            <AdminTable columns={["사업장명", "사업자등록번호", "주소", "업태 / 업종"]} minWidth={440}>
              {ws.sites.map((s) => (
                <tr key={s.name} className={TR}>
                  <td className={TD_KEY}>{s.name}</td>
                  <td className={`${TD} tabular-nums`}>{s.bizNumber}</td>
                  <td className={TD_WRAP}>{s.address}</td>
                  <td className={TD}>
                    {s.bizType} / {s.bizItem}
                  </td>
                </tr>
              ))}
            </AdminTable>
          )}
        </Card>

        {ws.memo && (
          <Card>
            <SectionHeader title="내부 메모" desc="고객에게는 보이지 않아요." />
            <p className="whitespace-pre-wrap text-sm text-slate-700">{ws.memo}</p>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <SectionHeader title="담당자" />

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
        </Card>

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

/* ────────────────────────── 사용량 · 요금 ────────────────────────── */

function Usage({ ws }: { ws: AdminWorkspace }) {
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
