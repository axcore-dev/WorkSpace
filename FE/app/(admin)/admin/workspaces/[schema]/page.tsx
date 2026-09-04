"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { STATUS_TONE } from "@/components/admin/workspace-detail/shared";
import { IntegrationsTab } from "@/components/admin/workspace-detail/integrations-tab";
import { MembersTab } from "@/components/admin/workspace-detail/members-tab";
import { OverviewTab } from "@/components/admin/workspace-detail/overview-tab";
import { UsageTab } from "@/components/admin/workspace-detail/usage-tab";
import { IconAlertTriangle } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Badge, Button } from "@/components/ui";
import { WS_STATUS_LABEL, type AdminWorkspace, type WsStatus } from "@/data/admin";
import { ApiRequestError } from "@/lib/api";
import {
  activateWorkspace,
  deactivateWorkspace,
  getWorkspaceDto,
  toAdminWorkspace,
  toUpdateInput,
  updateWorkspace,
  workspaceIdFromSchema,
  type ContactChangeDto,
  type WorkspaceDto,
} from "@/lib/admin-api";

/**
 * 수정 가능한 탭이 앞, 읽기 전용이 뒤다. 탭 띠만 보고 어디서 뭘 할 수 있는지
 * 알 수 있게 배치로 나눈다 — 「읽기 전용」 라벨이나 아이콘을 붙이지 않는다
 * (문구를 늘리지 않는다: 수정요청v9 ⑤ 5-4).
 */
const TABS = ["개요", "사용량 · 요금", "멤버", "온톨로지"] as const;
type Tab = (typeof TABS)[number];

/** 이 인덱스부터 읽기 전용 — 탭 띠에 구분을 준다 */
const READONLY_FROM = 2;

export default function AdminWorkspaceDetailPage() {
  const schema = useParams().schema as string;
  /**
   * 주소의 스키마 이름에서 id 를 되찾아 부른다. 목록을 거치지 않고 이 주소로 바로 들어와도
   * 동작해야 해서, 목록에서 넘겨받는 대신 여기서 다시 계산한다.
   */
  const id = workspaceIdFromSchema(schema);
  /**
   * 화면용(`ws`)과 원본 DTO(`dto`)를 같이 든다. 수정은 전체 교체(PUT)라 화면 타입에 없는 필드
   * (`ceoName`·`sites`·접속 링크 담당)까지 되돌려 보내야 하고, 그 값은 원본에만 있다.
   */
  const [ws, setWs] = useState<AdminWorkspace | undefined>(undefined);
  const [dto, setDto] = useState<WorkspaceDto | null>(null);
  const [loading, setLoading] = useState(id !== null);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** 마지막 저장에서 담당자가 바뀌어 서버가 한 일(소유자 이전 / 초대 발급). 담당자 카드가 보여 준다 */
  const [contactChange, setContactChange] = useState<ContactChangeDto | null>(null);

  useEffect(() => {
    let alive = true;
    if (id === null) return;
    getWorkspaceDto(id)
      .then((d) => {
        if (!alive) return;
        setDto(d);
        setWs(d ? toAdminWorkspace(d) : undefined);
      })
      .catch(() => {
        if (alive) setWs(undefined);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  /**
   * 저장. 화면은 먼저 바꾸고(낙관적), 서버가 거절하면 되돌린다.
   *
   * 담당자 이메일이 바뀐 저장은 서버가 후속 처리(소유자 이전·초대 발급)를 같은 트랜잭션으로 하고
   * 결과를 `contactChange` 로 준다. 그 뒤 구성원 역할·담당자 상태가 달라졌으므로 상세를 다시 읽는다.
   */
  async function save(patch: Partial<AdminWorkspace>) {
    if (id === null || !dto || !ws) return;
    const before = ws;
    setSaveError(null);
    setWs({ ...ws, ...patch });
    try {
      const res = await updateWorkspace(id, toUpdateInput(dto, patch));
      if (!res) return;
      setContactChange(res.contactChange.type === "NONE" ? null : res.contactChange);
      if (res.contactChange.type !== "NONE") {
        // 소유자 이전·초대 발급 뒤의 구성원 목록과 담당자 상태는 다시 읽어야 안다.
        const fresh = await getWorkspaceDto(id);
        if (fresh) {
          setDto(fresh);
          setWs(toAdminWorkspace(fresh));
        }
        return;
      }
      // 수정 응답은 구성원·담당자 상태를 싣지 않는다. 그 둘은 이전 값을 유지한다.
      const merged: WorkspaceDto = {
        ...res.dto,
        members: dto.members,
        contactStatus: dto.contactStatus,
      };
      setDto(merged);
      setWs(toAdminWorkspace(merged));
    } catch (e: unknown) {
      setWs(before);
      setSaveError(
        e instanceof ApiRequestError
          ? e.message
          : "저장하지 못했어요. 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요",
      );
    }
  }

  const [tab, setTab] = useState<Tab>("개요");
  /** 중지·재개는 데모라 화면 안에서만 바뀐다 */
  const [status, setStatus] = useState<WsStatus | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  if (loading) {
    return <p className="py-16 text-center text-sm text-slate-500">불러오는 중…</p>;
  }

  if (!ws) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm font-semibold text-slate-900">워크스페이스를 찾을 수 없어요</p>
        <p className="mt-1 text-sm text-slate-500">주소의 스키마 이름을 확인해 주세요.</p>
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
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{ws.company}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge tone={STATUS_TONE[current]}>{WS_STATUS_LABEL[current]}</Badge>
          {suspended ? (
            <Button
              variant="secondary"
              onClick={() => {
                if (id === null) return;
                setStatus("active");
                // 실패하면 화면을 되돌린다. 서버가 거절했는데 활성으로 보이면 안 된다.
                activateWorkspace(id).catch(() => setStatus("suspended"));
              }}
            >
              활성화
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmSuspend(true)}>
              비활성화
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {TABS.map((t, i) => (
          <div key={t} className="flex items-center">
            {i === READONLY_FROM && (
              <span className="mx-1.5 h-4 w-px shrink-0 bg-slate-200" aria-hidden />
            )}
            <button
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
          </div>
        ))}
      </div>

      {saveError && (
        <p
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          role="alert"
        >
          {saveError}
        </p>
      )}

      <div className="mt-5">
        {tab === "개요" && <OverviewTab ws={ws} onSave={save} contactChange={contactChange} />}
        {tab === "멤버" && <MembersTab ws={ws} />}
        {tab === "온톨로지" && <IntegrationsTab />}
        {tab === "사용량 · 요금" && <UsageTab ws={ws} onSave={save} />}
      </div>

      <Modal
        open={confirmSuspend}
        onClose={() => setConfirmSuspend(false)}
        size="sm"
        title="워크스페이스를 비활성화할까요?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmSuspend(false)}>
              닫기
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (id === null) return;
                setStatus("suspended");
                setConfirmSuspend(false);
                deactivateWorkspace(id).catch(() => setStatus("active"));
              }}
            >
              비활성화
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
            데이터와 연동 설정은 그대로 남아 있고, 언제든 다시 활성화할 수 있어요. 외부 시스템
            동기화는 비활성화 동안 멈춥니다.
          </p>
        </div>
      </Modal>
    </div>
  );
}
