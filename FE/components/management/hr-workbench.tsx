"use client";

import { useState } from "react";
import { IconDownload } from "@/components/icons";
import { RecordModal } from "@/components/record-modal";
import { Button, Card, DataTable, SectionHeader } from "@/components/ui";
import type { OrgMember } from "@/data/pages/management";
import type { Cell, DetailRecord } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { HR_COMPANY_ID } from "@/lib/management-state";
import { useManagement } from "./management-provider";
import { EntityHeader, MasterList, Tiles, Workbench, type MasterItem } from "./workbench";

const divId = (name: string) => `div:${name}`;
const teamId = (name: string) => `team:${name}`;

/**
 * 인사 작업대 — 조직도 + 연락처(명세 3.1.1). 재직 상태·휴가·입퇴사는 넣지 않는다.
 * 데이터는 회사의 부서·구성원 그대로다(`GET /api/workspace/management/org`). 사람을 더하는 일은 설정 › 초대 관리에서 한다.
 */
export function HrWorkbench() {
  const { state, notify, select, selected } = useManagement();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [record, setRecord] = useState<DetailRecord | null>(null);

  const org = state.org;
  const members = org.members;
  const teams = org.divisions.flatMap((d) => d.teams.map((t) => ({ ...t, division: d.name, size: members[t.name]?.length ?? t.size })));
  const total = teams.reduce((s, t) => s + t.size, 0);
  const q = query.trim().toLowerCase();
  const matches = (teamName: string) =>
    !q ||
    teamName.toLowerCase().includes(q) ||
    (members[teamName] ?? []).some((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));

  const selectedId = selected("hr");
  const current = selectedId.startsWith("team:") || selectedId.startsWith("div:") ? selectedId : HR_COMPANY_ID;
  const team = current.startsWith("team:") ? teams.find((t) => t.name === current.slice(5)) : undefined;
  const division = current.startsWith("div:") ? org.divisions.find((d) => d.name === current.slice(4)) : undefined;

  const treeItems: MasterItem[] = [];
  let matched = 0;
  for (const d of org.divisions) {
    const visibleTeams = d.teams.filter((t) => matches(t.name));
    if (q && visibleTeams.length === 0) continue;
    matched += visibleTeams.length;
    const open = q ? true : !collapsed.has(d.name);
    treeItems.push({
      id: divId(d.name),
      name: d.name,
      meta: `${visibleTeams.reduce((s, t) => s + (members[t.name]?.length ?? t.size), 0)}명`,
      indent: 1,
      expandable: true,
      expanded: open,
      onToggle: () =>
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (next.has(d.name)) next.delete(d.name);
          else next.add(d.name);
          return next;
        }),
    });
    if (!open) continue;
    for (const t of visibleTeams) {
      treeItems.push({ id: teamId(t.name), name: t.name, meta: `${members[t.name]?.length ?? t.size}명 · 팀장 ${t.head}`, indent: 2 });
    }
  }
  const items: MasterItem[] =
    q && matched === 0 ? [] : [{ id: HR_COMPANY_ID, name: org.company, meta: `${total}명 · ${org.divisions.length}본부 ${teams.length}팀` }, ...treeItems];

  const scopeName = team?.name ?? division?.name ?? org.company;

  function exportCsv() {
    const scope = team ? [team.name] : division ? division.teams.map((t) => t.name) : teams.map((t) => t.name);
    const rows: Cell[][] = scope.flatMap((tn) => (members[tn] ?? []).map((m) => [tn, m.name, m.rank, m.email, m.joined] as Cell[]));
    downloadCsv(`경영지원_${scopeName}_구성원.csv`, [["팀", "이름", "직급", "이메일", "입사일"], ...rows]);
    notify(`${scopeName} 구성원 ${rows.length}명 명단을 내보냈어요`);
  }

  const memberRecord = (t: string, m: OrgMember): DetailRecord => ({
    title: m.name,
    fields: [
      { label: "소속", value: t },
      { label: "직급", value: m.rank },
      { label: "이메일", value: m.email },
      { label: "입사일", value: m.joined },
    ],
  });

  const exportButton = (
    <Button variant="secondary" size="sm" className="h-8" onClick={exportCsv}>
      <IconDownload size={14} /> 명단 내보내기
    </Button>
  );

  return (
    <>
      <Workbench
        pickerTitle="팀 고르기"
        pickerLabel={`보고 있는 조직 · ${scopeName}`}
        renderMaster={(close) => (
          <MasterList
            search={{ placeholder: "이름 · 팀 · 이메일로 찾기", value: query, onChange: setQuery }}
            groups={[{ items }]}
            selectedId={current}
            onSelect={(id) => {
              select("hr", id);
              close();
            }}
            footer={`${org.divisions.length}본부 ${teams.length}팀 · ${total}명`}
            emptyText="찾는 결과가 없어요. 다른 이름이나 팀으로 찾아볼까요?"
          />
        )}
      >
        {team ? (
          <>
            <EntityHeader title={team.name} meta={`${team.division} · ${team.size}명 · 팀장 ${team.head}`} actions={exportButton} />
            <Tiles
              items={[
                { label: "인원", value: `${team.size}명` },
                { label: "팀장", value: team.head, sub: members[team.name]?.find((m) => m.name === team.head)?.rank },
                { label: "본부", value: team.division, sub: `${org.divisions.find((d) => d.name === team.division)?.teams.length ?? 0}팀` },
              ]}
            />
            <Card>
              <SectionHeader title={`구성원 ${team.size}명`} desc="행을 누르면 상세를 볼 수 있어요" />
              <DataTable
                dense
                data={{ columns: ["이름", "직급", "이메일", "입사일"], rows: (members[team.name] ?? []).map((m) => [m.name, m.rank, m.email, m.joined]) }}
                onRowClick={(i) => setRecord(memberRecord(team.name, members[team.name][i]))}
              />
            </Card>
          </>
        ) : division ? (
          <>
            <EntityHeader title={division.name} meta={`${division.teams.length}팀 · ${division.teams.reduce((s, t) => s + (members[t.name]?.length ?? t.size), 0)}명`} actions={exportButton} />
            <Card>
              <SectionHeader title={`팀 ${division.teams.length}개`} />
              <DataTable
                dense
                data={{
                  columns: ["팀", "인원", "팀장"],
                  rows: division.teams.map((t) => [t.name, `${members[t.name]?.length ?? t.size}명`, t.head]),
                }}
                onRowClick={(i) => select("hr", teamId(division.teams[i].name))}
              />
            </Card>
          </>
        ) : (
          <>
            <EntityHeader title={org.company} meta={`${org.divisions.length}본부 ${teams.length}팀 · ${total}명`} actions={exportButton} />
            <Tiles items={[{ label: "인원", value: `${total}명` }, { label: "본부", value: `${org.divisions.length}개` }, { label: "팀", value: `${teams.length}개` }]} />
            <Card>
              <SectionHeader title="본부" desc="부서와 구성원은 설정 › 회사에서 바꿔요" />
              <DataTable
                dense
                data={{ columns: ["본부", "팀 수", "인원"], rows: org.divisions.map((d) => [d.name, `${d.teams.length}팀`, `${d.teams.reduce((s, t) => s + (members[t.name]?.length ?? t.size), 0)}명`]) }}
                onRowClick={(i) => select("hr", divId(org.divisions[i].name))}
              />
            </Card>
          </>
        )}
      </Workbench>

      <RecordModal record={record} onClose={() => setRecord(null)} />
    </>
  );
}
