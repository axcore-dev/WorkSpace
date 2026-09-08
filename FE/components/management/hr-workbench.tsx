"use client";

import { useState } from "react";
import { IconDownload } from "@/components/icons";
import { RecordModal } from "@/components/record-modal";
import { Button, Card, DataTable, SectionHeader } from "@/components/ui";
import { ORG } from "@/data/pages/management";
import type { Cell, DetailRecord, Member } from "@/data/types";
import { downloadCsv } from "@/lib/download";
import { HR_DEFAULT_TEAM } from "@/lib/management-state";
import { useManagement } from "./management-provider";
import { CreateMemberModal } from "./create-member-modal";
import { EntityHeader, MasterList, Tiles, Workbench, type MasterItem } from "./workbench";

const COMPANY_ID = "company";
const divId = (name: string) => `div:${name}`;
const teamId = (name: string) => `team:${name}`;

/** 인사 작업대 — 명세 3.1.1(조직도 + 연락처)까지. 재직 상태·휴가·입퇴사는 넣지 않는다. */
export function HrWorkbench() {
  const { state, dispatch, notify, select, selected } = useManagement();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [record, setRecord] = useState<DetailRecord | null>(null);

  const members = state.members;
  const teams = ORG.divisions.flatMap((d) => d.teams.map((t) => ({ ...t, division: d.name, size: members[t.name]?.length ?? t.size })));
  const total = teams.reduce((s, t) => s + t.size, 0);
  const q = query.trim().toLowerCase();
  const matches = (teamName: string) =>
    !q ||
    teamName.toLowerCase().includes(q) ||
    (members[teamName] ?? []).some((m) => m.name.toLowerCase().includes(q) || m.phone.includes(q));

  const selectedId = selected("hr");
  const current = selectedId.startsWith("team:") ? selectedId : selectedId === COMPANY_ID || selectedId.startsWith("div:") ? selectedId : teamId(HR_DEFAULT_TEAM);
  const team = current.startsWith("team:") ? teams.find((t) => t.name === current.slice(5)) : undefined;
  const division = current.startsWith("div:") ? ORG.divisions.find((d) => d.name === current.slice(4)) : undefined;

  const items: MasterItem[] = [{ id: COMPANY_ID, name: ORG.company, meta: `${total}명 · ${ORG.divisions.length}본부 ${teams.length}팀` }];
  for (const d of ORG.divisions) {
    const visibleTeams = d.teams.filter((t) => matches(t.name));
    if (q && visibleTeams.length === 0) continue;
    const open = q ? true : !collapsed.has(d.name);
    items.push({
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
      items.push({ id: teamId(t.name), name: t.name, meta: `${members[t.name]?.length ?? t.size}명 · 팀장 ${t.head}`, badge: t.badge, indent: 2 });
    }
  }

  function exportCsv() {
    const scope = team ? [team.name] : division ? division.teams.map((t) => t.name) : teams.map((t) => t.name);
    const rows: Cell[][] = scope.flatMap((tn) => (members[tn] ?? []).map((m) => [tn, m.name, m.rank, m.phone, m.email, m.joined] as Cell[]));
    downloadCsv(`경영지원_${team?.name ?? division?.name ?? ORG.company}_구성원.csv`, [["팀", "이름", "직급", "연락처", "이메일", "입사일"], ...rows]);
    notify(`${team?.name ?? division?.name ?? ORG.company} 구성원 ${rows.length}명 명단을 내보냈어요`);
  }

  const memberRecord = (t: string, m: Member): DetailRecord => ({
    title: m.name,
    fields: [
      { label: "소속", value: t },
      { label: "직급", value: m.rank },
      { label: "연락처", value: m.phone },
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
        pickerLabel={`보고 있는 조직 · ${team?.name ?? division?.name ?? ORG.company}`}
        renderMaster={(close) => (
          <MasterList
            create={{ label: "구성원 등록하기", onClick: () => setCreateOpen(true) }}
            search={{ placeholder: "이름 · 팀 · 연락처로 찾기", value: query, onChange: setQuery }}
            groups={[{ items }]}
            selectedId={current}
            onSelect={(id) => {
              select("hr", id);
              close();
            }}
            footer={`${ORG.divisions.length}본부 ${teams.length}팀 · ${total}명`}
            emptyText="찾는 결과가 없어요. 다른 이름이나 팀으로 찾아볼까요?"
          />
        )}
      >
        {team ? (
          <>
            <EntityHeader title={team.name} meta={`${team.division} · ${team.size}명 · 팀장 ${team.head}`} actions={exportButton} />
            <Tiles
              items={[
                { label: "인원", value: `${team.size}명`, sub: team.badge?.text },
                { label: "팀장", value: team.head, sub: members[team.name]?.find((m) => m.name === team.head)?.phone },
                { label: "본부", value: team.division, sub: `${ORG.divisions.find((d) => d.name === team.division)?.teams.length ?? 0}팀` },
              ]}
            />
            <Card>
              <SectionHeader title={`구성원 ${team.size}명`} desc="행을 누르면 상세를 볼 수 있어요" />
              <DataTable
                dense
                data={{ columns: ["이름", "직급", "연락처", "이메일", "입사일"], rows: (members[team.name] ?? []).map((m) => [m.name, m.rank, m.phone, m.email, m.joined]) }}
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
                  columns: ["팀", "인원", "팀장", "연락처"],
                  rows: division.teams.map((t) => [t.name, `${members[t.name]?.length ?? t.size}명`, t.head, members[t.name]?.find((m) => m.name === t.head)?.phone ?? "—"]),
                }}
                onRowClick={(i) => select("hr", teamId(division.teams[i].name))}
              />
            </Card>
          </>
        ) : (
          <>
            <EntityHeader title={ORG.company} meta={`${ORG.divisions.length}본부 ${teams.length}팀 · ${total}명`} actions={exportButton} />
            <Tiles items={[{ label: "인원", value: `${total}명` }, { label: "본부", value: `${ORG.divisions.length}개` }, { label: "팀", value: `${teams.length}개` }]} />
            <Card>
              <SectionHeader title="본부" />
              <DataTable
                dense
                data={{ columns: ["본부", "팀 수", "인원"], rows: ORG.divisions.map((d) => [d.name, `${d.teams.length}팀`, `${d.teams.reduce((s, t) => s + (members[t.name]?.length ?? t.size), 0)}명`]) }}
                onRowClick={(i) => select("hr", divId(ORG.divisions[i].name))}
              />
            </Card>
          </>
        )}
      </Workbench>

      <CreateMemberModal
        key={String(createOpen)}
        open={createOpen}
        teams={teams.map((t) => t.name)}
        defaultTeam={team?.name}
        onSave={(t, m) => {
          dispatch({ type: "addMember", team: t, member: m });
          notify(`${t}에 ${m.name}을 등록했어요`);
        }}
        onClose={() => setCreateOpen(false)}
      />
      <RecordModal record={record} onClose={() => setRecord(null)} />
    </>
  );
}
