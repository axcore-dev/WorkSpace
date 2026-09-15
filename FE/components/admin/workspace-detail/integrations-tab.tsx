"use client";

import { useEffect, useState } from "react";
import { AdminTable, TD, TD_KEY, TR } from "@/components/admin/admin-table";
import { Field } from "@/components/admin/form-parts";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Badge, Button, Card, FIELD, SectionHeader, Toast } from "@/components/ui";
import { useToast } from "@/components/use-toast";
import type { Tone } from "@/data/types";
import { ApiRequestError } from "@/lib/api";
import {
  createExternalSystem,
  deleteExternalSystem,
  EXTERNAL_SYSTEM_KINDS,
  listExternalSystems,
  SSL_MODES,
  testExternalSystem,
  updateExternalSystem,
  toDateTimeText,
  type ExternalSystemAdminDto,
  type ExternalSystemInput,
} from "@/lib/admin-api";
import { EditModal } from "./shared";

/**
 * 연동 탭 — 회사의 외부 시스템(ERP · MES …) 등록. 운영팀만 만진다. 고객의 설정 › 연동은 이 표를 읽기만 한다.
 *
 * 접속 정보(호스트 · DB · 사용자 · 비밀번호)가 있는 MES 는 AI 업무 데이터 도구가 읽는 그 MES 다 — 회사당 하나.
 * 비밀번호는 서버가 잠가 두고 돌려주지 않으므로 수정 폼에서는 비워 두면 그대로다.
 */
export function IntegrationsTab({ workspaceId }: { workspaceId: number }) {
  const [rows, setRows] = useState<ExternalSystemAdminDto[] | null>(null);
  const [editing, setEditing] = useState<ExternalSystemAdminDto | "new" | null>(null);
  const [removing, setRemoving] = useState<ExternalSystemAdminDto | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [toast, showToast] = useToast();

  async function reload() {
    setRows(await listExternalSystems(workspaceId).catch(() => []));
  }
  useEffect(() => {
    let alive = true;
    listExternalSystems(workspaceId)
      .catch(() => [])
      .then((r) => {
        if (alive) setRows(r);
      });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const fail = (e: unknown, fallback: string) =>
    showToast(e instanceof ApiRequestError ? e.message : fallback, "error");

  async function test(row: ExternalSystemAdminDto) {
    setTesting(row.id);
    try {
      const r = await testExternalSystem(workspaceId, row.id);
      showToast(r.ok ? `${row.name}에 연결됐어요` : `연결 실패: ${r.message ?? ""}`, r.ok ? undefined : "error");
      await reload();
    } catch (e) {
      fail(e, "연결 테스트를 못 했어요");
    } finally {
      setTesting(null);
    }
  }

  async function remove(row: ExternalSystemAdminDto) {
    try {
      await deleteExternalSystem(workspaceId, row.id);
      showToast(`${row.name}을 삭제했어요`);
      setRemoving(null);
      await reload();
    } catch (e) {
      fail(e, "삭제하지 못했어요");
    }
  }

  return (
    <Card>
      <SectionHeader
        title="외부 시스템"
        desc="AI 가 읽는 고객사 MES 등. 접속 정보가 있는 MES 는 회사당 하나예요."
        action={
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            <IconPlus size={14} />
            등록
          </Button>
        }
      />

      {rows === null ? (
        <p className="text-sm text-slate-400">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">등록된 외부 시스템이 없어요. 「등록」으로 MES 접속 정보를 넣으면 AI 가 그 MES 를 읽어요.</p>
      ) : (
        <AdminTable columns={["이름", "종류", "제품", "접속", "상태", "수정", ""]} minWidth={760}>
          {rows.map((r) => (
            <tr key={r.id} className={TR}>
              <td className={TD_KEY}>{r.name}</td>
              <td className={TD}>{r.kind}</td>
              <td className={TD}>{r.vendor}</td>
              <td className={`${TD} font-mono text-xs`}>{r.host ? `${r.host}:${r.port}/${r.dbName}` : "표시만"}</td>
              <td className={TD}>
                <StatusBadge row={r} />
              </td>
              <td className={TD}>{toDateTimeText(r.updatedAt)}</td>
              <td className={`${TD} text-right`}>
                <span className="inline-flex gap-1">
                  {r.host && (
                    <Button size="sm" variant="ghost" disabled={testing === r.id} onClick={() => void test(r)}>
                      {testing === r.id ? "연결 중…" : "연결 테스트"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                    수정
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(r)}>
                    삭제
                  </Button>
                </span>
              </td>
            </tr>
          ))}
        </AdminTable>
      )}

      {editing !== null && (
        <SystemForm
          workspaceId={workspaceId}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (name) => {
            setEditing(null);
            showToast(`${name}을 저장했어요`);
            await reload();
          }}
          onError={(e) => fail(e, "저장하지 못했어요")}
        />
      )}

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="외부 시스템을 삭제할까요?"
        desc={removing ? `${removing.name}의 접속 정보가 지워지고 AI 가 더는 이 시스템을 읽지 못해요.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              취소
            </Button>
            <Button variant="danger" onClick={() => removing && void remove(removing)}>
              삭제
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500">삭제해도 이 회사의 다른 데이터는 그대로예요.</p>
      </Modal>

      <Toast toast={toast} />
    </Card>
  );
}

const STATUS: Record<ExternalSystemAdminDto["status"], { label: string; tone: Tone }> = {
  ok: { label: "정상", tone: "green" },
  delayed: { label: "지연", tone: "amber" },
  down: { label: "끊김", tone: "red" },
};

function StatusBadge({ row }: { row: ExternalSystemAdminDto }) {
  if (!row.host) return <Badge tone="slate">표시만</Badge>;
  const s = STATUS[row.status] ?? { label: row.status, tone: "slate" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** 등록 · 수정 폼. 접속 정보는 전부 적거나 전부 비운다 — 서버가 짝을 확인하고 400 을 준다 */
function SystemForm({
  workspaceId,
  initial,
  onClose,
  onSaved,
  onError,
}: {
  workspaceId: number;
  initial: ExternalSystemAdminDto | null;
  onClose: () => void;
  onSaved: (name: string) => Promise<void>;
  onError: (e: unknown) => void;
}) {
  const [d, setD] = useState<ExternalSystemInput>({
    name: initial?.name ?? "",
    vendor: initial?.vendor ?? "",
    kind: initial?.kind ?? "MES",
    host: initial?.host ?? "",
    port: initial?.port ?? 5432,
    dbName: initial?.dbName ?? "postgres",
    dbUser: initial?.dbUser ?? "",
    password: "",
    sslmode: initial?.sslmode ?? "require",
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ExternalSystemInput>) => setD((p) => ({ ...p, ...patch }));
  const linked = Boolean(d.host || d.dbUser);
  const canSave = d.name.trim() !== "" && d.vendor.trim() !== "" && !saving;

  async function save() {
    setSaving(true);
    try {
      const input: ExternalSystemInput = {
        ...d,
        name: d.name.trim(),
        vendor: d.vendor.trim(),
        host: d.host?.trim() || undefined,
        // 호스트 · 사용자가 없으면 접속 정보 전체를 비운다 — 기본값 "postgres" 만 남아 서버의 짝 검사에 걸리지 않게
        dbName: linked ? d.dbName?.trim() || undefined : undefined,
        dbUser: d.dbUser?.trim() || undefined,
        password: d.password || undefined,
      };
      if (initial) await updateExternalSystem(workspaceId, initial.id, input);
      else await createExternalSystem(workspaceId, input);
      await onSaved(input.name);
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditModal open onClose={onClose} title={initial ? "외부 시스템 수정" : "외부 시스템 등록"} canSave={canSave} onSave={() => void save()}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="xs-name" label="이름" required hint="회사가 부르는 이름. 예: 1공장 MES">
          <input id="xs-name" value={d.name} onChange={(e) => set({ name: e.target.value })} className={FIELD} />
        </Field>
        <Field id="xs-kind" label="종류" required>
          <select id="xs-kind" value={d.kind} onChange={(e) => set({ kind: e.target.value })} className={`${FIELD} cursor-pointer`}>
            {EXTERNAL_SYSTEM_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
        <Field id="xs-vendor" label="제품" required hint="실제 제품 이름. 예: 미라콤 MESplus · Supabase">
          <input id="xs-vendor" value={d.vendor} onChange={(e) => set({ vendor: e.target.value })} className={FIELD} />
        </Field>
      </div>

      <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        DB 접속 정보 <span className="font-normal normal-case tracking-normal">— 비우면 표시만 하는 시스템이에요</span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="xs-host" label="호스트" required={linked} hint="Supabase 는 Session pooler(IPv4) 주소">
          <input id="xs-host" value={d.host ?? ""} onChange={(e) => set({ host: e.target.value })} className={`${FIELD} font-mono`} />
        </Field>
        <Field id="xs-port" label="포트">
          <input
            id="xs-port"
            type="number"
            min={1}
            max={65535}
            value={d.port ?? 5432}
            onChange={(e) => set({ port: Number(e.target.value) || 5432 })}
            className={`${FIELD} tabular-nums`}
          />
        </Field>
        <Field id="xs-db" label="DB 이름" required={linked}>
          <input id="xs-db" value={d.dbName ?? ""} onChange={(e) => set({ dbName: e.target.value })} className={`${FIELD} font-mono`} />
        </Field>
        <Field id="xs-user" label="사용자" required={linked} hint="SELECT 만 가진 롤. Supabase 풀러는 롤.프로젝트ID">
          <input id="xs-user" value={d.dbUser ?? ""} onChange={(e) => set({ dbUser: e.target.value })} className={`${FIELD} font-mono`} />
        </Field>
        <Field
          id="xs-pw"
          label="비밀번호"
          required={linked && !initial?.hasPassword}
          hint={initial?.hasPassword ? "저장돼 있어요. 바꿀 때만 적어요" : undefined}
        >
          <input
            id="xs-pw"
            type="password"
            autoComplete="new-password"
            value={d.password ?? ""}
            onChange={(e) => set({ password: e.target.value })}
            className={FIELD}
          />
        </Field>
        <Field id="xs-ssl" label="SSL">
          <select id="xs-ssl" value={d.sslmode} onChange={(e) => set({ sslmode: e.target.value })} className={`${FIELD} cursor-pointer`}>
            {SSL_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </EditModal>
  );
}
