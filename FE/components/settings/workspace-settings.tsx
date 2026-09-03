"use client";

import { useState } from "react";
import { BrandIcon } from "@/components/brand-icons";
import { ConnectorModal } from "@/components/connector-modal";
import { CONNECTOR_LIB } from "@/data/chat";
import { ICON_MAP, IconCheckCircle, IconPlus } from "@/components/icons";
import { Modal } from "@/components/modal";
import { useModules } from "@/components/module-provider";
import {
  AiBadge,
  Badge,
  Button,
  Card,
  FIELD,
  SectionHeader,
  Toggle,
} from "@/components/ui";
import { MODULES } from "@/data/modules";
import {
  CONNECTOR_TYPES,
  CONNECTORS,
  EXTERNAL_SERVICES,
  SYNC_RULES,
} from "@/data/org";

type Connector = (typeof CONNECTORS)[number];

/**
 * 외부 시스템 연결 상세 팝업 — 실무 필수 항목만.
 * 이름(사용자 설정)은 필수, 실제 시스템 명은 서브로 노출된다.
 */
function SystemModal({
  open,
  connector,
  onClose,
  onSave,
}: {
  open: boolean;
  connector: Connector | null;
  onClose: () => void;
  onSave: (c: Connector, original: Connector | null) => void;
}) {
  // 부모가 열 때마다 key를 바꿔 리마운트하므로 초기값으로만 세팅하면 된다
  const [name, setName] = useState(connector?.name ?? "");
  const [system, setSystem] = useState(connector?.system ?? "");
  const [type, setType] = useState(connector?.type ?? CONNECTOR_TYPES[0]);
  const [endpoint, setEndpoint] = useState(connector?.endpoint ?? "");
  const [apiKey, setApiKey] = useState("");
  const [tested, setTested] = useState(false);

  function save() {
    if (!name.trim()) return;
    onSave(
      {
        name: name.trim(),
        system: system.trim() || "미지정",
        type,
        endpoint: endpoint.trim(),
        status: connector?.status ?? { badge: "정상", tone: "green" },
      },
      connector,
    );
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={connector ? "외부 시스템 설정" : "외부 시스템 추가"}
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setTested(true)}
            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            {tested ? (
              <>
                <IconCheckCircle size={15} className="text-emerald-600" />
                <span className="text-emerald-600">연결 확인됨</span>
              </>
            ) : (
              "연결 테스트"
            )}
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button onClick={save} disabled={!name.trim()}>
              저장
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 p-5">
        <div>
          <label
            htmlFor="sys-name"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            id="sys-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 본사 ERP"
            className={FIELD}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            목록에 표시될 이름이에요. 용도를 알 수 있게 지어 주세요.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="sys-type"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              시스템 유형
            </label>
            <select
              id="sys-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={`${FIELD} cursor-pointer`}
            >
              {CONNECTOR_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="sys-system"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              실제 시스템 명
            </label>
            <input
              id="sys-system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="예: 더존비즈온 iCUBE"
              className={FIELD}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="sys-endpoint"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            연결 주소 (엔드포인트)
          </label>
          <input
            id="sys-endpoint"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https:// 또는 mqtt://"
            className={`${FIELD} font-mono`}
          />
        </div>
        <div>
          <label
            htmlFor="sys-key"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            인증 키 (API Key)
          </label>
          <input
            id="sys-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={connector ? "변경할 때만 입력" : "발급받은 키 입력"}
            autoComplete="off"
            className={FIELD}
          />
        </div>
      </div>
    </Modal>
  );
}

export function WorkspaceSettings() {
  const { state, setModule, setSub } = useModules();
  /** 커넥터 연결 상태 — 이 화면 안에서만 쓰인다. BE에 커넥터 API가 생기면 서버가 진실을 갖는다 */
  const [connectedApps, setConnectedApps] = useState<string[]>(() =>
    CONNECTOR_LIB.filter((c) => c.connected).map((c) => c.slug),
  );
  const [connectors, setConnectors] = useState(CONNECTORS);
  const [systemOpen, setSystemOpen] = useState(false);
  const [systemModalKey, setSystemModalKey] = useState(0);
  const [editingConnector, setEditingConnector] = useState<Connector | null>(
    null,
  );

  function openSystemModal(target: Connector | null) {
    setEditingConnector(target);
    setSystemModalKey((k) => k + 1);
    setSystemOpen(true);
  }
  const [services, setServices] = useState(EXTERNAL_SERVICES);
  const [connectorLibOpen, setConnectorLibOpen] = useState(false);

  const connectedServices = services.filter((s) => s.connected);

  function saveConnector(next: Connector, original: Connector | null) {
    setConnectors((prev) =>
      original ? prev.map((c) => (c === original ? next : c)) : [...prev, next],
    );
  }

  function disconnectService(id: string) {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, connected: false } : s)),
    );
  }

  return (
    <div className="space-y-5">
      {/* 기능 활성화 설정 */}
      <Card>
        <SectionHeader title="기능 활성화 설정" />
        <ul className="divide-y divide-slate-100">
          {MODULES.map((mod) => {
            const Icon = ICON_MAP[mod.icon];
            const st = state[mod.slug];
            return (
              <li key={mod.slug} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon
                      size={17}
                      className={`shrink-0 ${st.enabled ? "text-slate-600" : "text-slate-300"}`}
                    />
                    <p
                      className={`text-sm font-semibold ${st.enabled ? "text-slate-900" : "text-slate-400"}`}
                    >
                      {mod.name}
                    </p>
                  </div>
                  <Toggle
                    size="sm"
                    checked={st.enabled}
                    onChange={(v) => setModule(mod.slug, v)}
                    label={`${mod.name} 기능`}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 pl-8">
                  {mod.subfunctions.map((sub) => (
                    <span
                      key={sub.id}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Toggle
                        size="sm"
                        checked={st.subs[sub.id]}
                        onChange={(v) => setSub(mod.slug, sub.id, v)}
                        label={`${mod.name} > ${sub.name}`}
                      />
                      <span
                        className={`flex items-center gap-1 text-[13px] ${st.subs[sub.id] ? "text-slate-600" : "text-slate-400"}`}
                      >
                        {sub.name}
                        {sub.ai && <AiBadge />}
                      </span>
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* 외부 시스템 연동 */}
      <Card>
        <SectionHeader
          title="외부 시스템 연동"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openSystemModal(null)}
            >
              <IconPlus size={14} />
              외부 시스템 추가
            </Button>
          }
        />
        <ul className="divide-y divide-slate-100">
          {connectors.map((c, i) => (
            <li
              key={`${c.name}-${i}`}
              className="flex flex-wrap items-center gap-3 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {c.name}
                  <span className="text-xs font-normal text-slate-400">
                    {c.type}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {c.system}
                </p>
              </div>
              <Badge tone={c.status.tone}>{c.status.badge}</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openSystemModal(c)}
              >
                설정
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {/* 모듈 간 데이터 연동 */}
      <Card>
        <SectionHeader title="모듈 간 데이터 연동" />
        <ul className="divide-y divide-slate-100">
          {SYNC_RULES.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-800">{r.from}</span>
                <span className="text-slate-300">→</span>
                <span className="font-medium text-slate-800">{r.to}</span>
                <span className="w-full text-xs text-slate-500 sm:w-auto sm:flex-1 sm:truncate">
                  {r.rule}
                </span>
              </div>
              <Badge tone={r.status.tone}>{r.status.badge}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      {/* 외부 서비스 연동 — 연결된 서비스만 표시, 추가는 커넥터 팝업에서 */}
      <Card>
        <SectionHeader
          title="외부 서비스 연동"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConnectorLibOpen(true)}
            >
              <IconPlus size={14} />
              커넥터 연결
            </Button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {connectedServices.map((svc) => (
            <div
              key={svc.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    <BrandIcon slug={svc.icon} size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {svc.name}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {svc.desc}
                    </span>
                  </span>
                </span>
                <Badge tone="green">연결됨</Badge>
              </div>
              {svc.account && (
                <p className="mt-2 truncate font-mono text-[11px] text-slate-400">
                  {svc.account}
                </p>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => disconnectService(svc.id)}
              >
                연결 해제
              </Button>
            </div>
          ))}
        </div>
        {connectedServices.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            연결된 서비스가 없어요. 우측 상단 &lsquo;커넥터 연결&rsquo;에서
            추가해 주세요.
          </p>
        )}
      </Card>

      {/* 알림 설정 — 임시 비활성화 */}
      <Card>
        <SectionHeader title="알림 설정" />
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-400">
          알림 설정은 임시 비활성화되어 있어요. 다음 업데이트에서 다시 제공될
          예정이에요.
        </p>
      </Card>

      <SystemModal
        key={systemModalKey}
        open={systemOpen}
        connector={editingConnector}
        onClose={() => setSystemOpen(false)}
        onSave={saveConnector}
      />
      <ConnectorModal
        open={connectorLibOpen}
        onClose={() => setConnectorLibOpen(false)}
        connected={connectedApps}
        onConnect={(slug) => setConnectedApps((prev) => [...prev, slug])}
        onDisconnect={(slug) =>
          setConnectedApps((prev) => prev.filter((x) => x !== slug))
        }
      />
    </div>
  );
}
