"use client";

import { useMemo, useRef, useState } from "react";
import { Modal } from "@/components/modal";
import { grantableRanks, invitableDepts } from "@/components/settings/company/link-create-modal";
import type { PeopleData } from "@/components/settings/company/people-manager";
import { RankTabsPreview, roleDefOf } from "@/components/settings/company/rank-perms";
import { IconCheckCircle, IconUpload, IconX } from "@/components/icons";
import { Badge, Button, FIELD } from "@/components/ui";
import {
  classifyEmail,
  parseInviteCsv,
  splitEmails,
  type InviteRow,
  type InviteVerdict,
} from "@/data/invite";
import { ApiRequestError } from "@/lib/api";
import { inviteMembers, type InviteResultDto, type WorkspaceMeDto } from "@/lib/workspace-api";

type Mode = "direct" | "file";

/** 판정 톤 — 배지에 배경을 넣지 않는다 (DESIGN.md 「알약 배지 금지」) */
const TONE: Record<InviteVerdict["kind"], "green" | "amber" | "red" | "slate"> = {
  ok: "green",
  warn: "amber",
  skip: "amber",
  bad: "red",
};

/** 보낸 결과 — 보냈다 · 서버가 건너뛰었다 · 화면에서 이미 걸러졌다(고쳐야 하는 줄) */
type Sent = { sent: number; skipped: number; blocked: number };

/**
 * 구성원 초대 팝업.
 *
 * **한 번에 여러 명이다.** 직접 입력은 주소를 칩으로 쌓고, 파일은 이름·이메일·부서·직급
 * 네 칸짜리 CSV를 읽는다. 판정 로직은 `data/invite.ts`에 있고 테스트가 지킨다.
 *
 * **권한을 여기서 만들지 않는다.** 권한은 직급이 정하고 직급은 권한 관리에서 만든다. 여기서는 고른 직급이 어떤 탭을
 * 여는지 **읽기 전용**으로 보여줄 뿐이다. 고를 수 있는 직급은 서버가 `assignable` 로 준 것만 — 내가 못 보는 탭을
 * 남에게 열어 줄 수 없다(서버 `PeopleGuard` 가 같은 규칙으로 거절한다).
 *
 * 보내기는 `POST /api/workspace/invitations` — 서버가 주소마다 보냈는지/건너뛰었는지를 돌려주고 메일을 보낸다.
 * 화면의 사전 판정(이미 구성원 · 초대 중 · 형식)은 서버 판정을 미리 보여 주는 것이고, 최종은 응답이다.
 *
 * **엑셀(.xlsx)은 아직 안 받는다.** 읽으려면 패키지가 하나 필요하고 그건 승인 사항이다
 * (루트 CLAUDE.md 의존성 규칙). CSV는 지금 코드로 읽는다.
 */
export function InviteModal({
  open,
  onClose,
  data,
  me,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  data: PeopleData;
  me: WorkspaceMeDto | null;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<Mode>("direct");
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const deptList = invitableDepts(me, data.depts);
  const deptLocked = deptList.length <= 1;

  const [deptId, setDeptId] = useState<number | null>(deptList[0]?.id ?? null);
  const [roleId, setRoleId] = useState<number | null>(grantableRanks(data.roles, deptList[0]?.id ?? null)[0]?.id ?? null);
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 회사 메일 도메인은 따로 설정이 없다 — 지금 구성원들의 주소 도메인을 회사 것으로 본다
  const ctx = useMemo(
    () => ({
      members: data.members.map((u) => u.email),
      pending: data.pending.map((p) => p.email),
      workDomains: [...new Set(data.members.map((u) => u.email.slice(u.email.lastIndexOf("@") + 1)))],
    }),
    [data.members, data.pending],
  );

  const rankList = grantableRanks(data.roles, deptId);
  /** 부서 이름 → id, 직급 이름 → 직급. CSV 는 이름으로 적혀 온다 */
  const deptByName = (name: string | null) => deptList.find((d) => d.name === name) ?? null;
  const rankNamesOf = (deptName: string) =>
    grantableRanks(data.roles, deptByName(deptName)?.id ?? null).map((r) => r.name);

  function changeDept(next: number | null) {
    setDeptId(next);
    // 부서를 바꾸면 직급도 그 부서 것으로 옮긴다 — 안 하면 없는 조합이 남는다
    setRoleId(grantableRanks(data.roles, next)[0]?.id ?? null);
  }

  /* ── 직접 입력 ── */
  const chips = emails.map((e) => ({ email: e, v: classifyEmail(e, ctx) }));

  function addEmails(raw: string) {
    const next = splitEmails(raw);
    if (next.length === 0) return;
    // 같은 주소는 조용히 합친다 — 두 번 넣었다고 알려 줄 일이 아니다
    setEmails((prev) => [...new Set([...prev, ...next])]);
    setDraft("");
  }

  /* ── 파일 ── */
  async function readFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setFileName(file.name);
    // 파일에도 같은 제약이 걸린다 — 고를 수 없는 부서·직급은 비워 두고 화면에서 고치게 한다
    setRows(parseInviteCsv(text, { depts: deptList.map((d) => d.name), ranksOf: rankNamesOf }));
    setPicked(null);
  }

  function fixRow(i: number, patch: Partial<InviteRow>) {
    setRows((prev) =>
      prev.map((r, k) => {
        if (k !== i) return r;
        const next = { ...r, ...patch };
        // 부서를 바꾸면 그 부서에 없는 직급은 버린다
        if (patch.dept !== undefined && next.rank && !rankNamesOf(patch.dept ?? "").includes(next.rank)) {
          next.rank = null;
        }
        return next;
      }),
    );
  }

  /** 파일 한 줄의 판정 — 주소 문제가 먼저, 그다음이 부서·직급 */
  function rowVerdict(r: InviteRow): InviteVerdict {
    const v = classifyEmail(r.email, ctx);
    if (v.kind === "bad" || v.kind === "skip") return v;
    if (!r.dept) return { kind: "bad", why: `‘${r.rawDept || "빈 값"}’은 없는 부서예요` };
    if (!r.rank) return { kind: "bad", why: `‘${r.rawRank || "빈 값"}’은 없는 직급이에요` };
    return v;
  }

  const verdicts = mode === "direct" ? chips.map((c) => c.v) : rows.map(rowVerdict);
  const sendable = verdicts.filter((v) => v.kind === "ok" || v.kind === "warn").length;
  const notSendable = verdicts.length - sendable;
  const canSend = sendable > 0 && (mode === "file" || roleId !== null);

  const pickedRow = picked !== null ? rows[picked] : null;
  const previewRole =
    mode === "direct"
      ? (data.roles.find((r) => r.id === roleId) ?? null)
      : (data.roles.find((r) => r.name === pickedRow?.rank) ?? null);

  /* ── 보내기 ── */
  async function send() {
    setBusy(true);
    setError(null);
    try {
      const results: InviteResultDto[] = [];
      let blocked = 0;
      if (mode === "direct") {
        if (roleId === null) return;
        const list = chips.filter((c) => c.v.kind === "ok" || c.v.kind === "warn").map((c) => c.email);
        blocked = chips.length - list.length;
        results.push(await inviteMembers({ emails: list, roleId, departmentId: deptId }));
      } else {
        // 줄마다 직급·부서가 다르다 — 같은 조합끼리 묶어 한 번씩 보낸다
        const groups = new Map<string, { roleId: number; departmentId: number | null; emails: string[] }>();
        for (const r of rows) {
          const v = rowVerdict(r);
          if (v.kind !== "ok" && v.kind !== "warn") {
            blocked += 1;
            continue;
          }
          const dept = deptByName(r.dept);
          const role = data.roles.find((x) => x.name === r.rank);
          if (!role) {
            blocked += 1;
            continue;
          }
          const key = `${role.id}:${dept?.id ?? ""}`;
          const g = groups.get(key) ?? { roleId: role.id, departmentId: dept?.id ?? null, emails: [] };
          g.emails.push(r.email);
          groups.set(key, g);
        }
        for (const g of groups.values()) {
          results.push(await inviteMembers(g));
        }
      }
      const lines = results.flatMap((r) => r.results);
      setSent({ sent: lines.filter((l) => l.status === "sent").length, skipped: lines.length - lines.filter((l) => l.status === "sent").length, blocked });
      onSent();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.body.message : "초대를 보내지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setMode("direct");
    setEmails([]);
    setDraft("");
    setRows([]);
    setFileName("");
    setPicked(null);
    setSent(null);
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="구성원 초대"
      footer={
        !sent && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              {sendable}명에게 보냅니다
              {notSendable > 0 && ` · ${notSendable}명은 건너뜁니다`}
            </span>
            <span className="flex gap-2">
              <Button variant="secondary" onClick={close}>
                취소
              </Button>
              <Button disabled={!canSend || busy} onClick={() => void send()}>
                {busy ? "보내는 중…" : "초대 보내기"}
              </Button>
            </span>
          </div>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <IconCheckCircle size={40} className="text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {sent.sent + sent.skipped + sent.blocked}명 중 {sent.sent}명에게 초대를 보냈어요
          </p>
          {sent.skipped + sent.blocked > 0 && (
            <p className="mt-1.5 max-w-sm text-sm text-slate-500">
              이미 있거나 초대 중인 {sent.skipped}명, 고쳐야 하는 {sent.blocked}명은 건너뛰었어요.
            </p>
          )}
          <Button className="mt-5" onClick={close}>
            확인
          </Button>
        </div>
      ) : (
        <div className="p-5">
          {/* 입력 방식 — 라우트가 아니라 한 팝업 안이라 인라인 탭이다 */}
          <div role="tablist" aria-label="입력 방식" className="flex gap-1 border-b border-slate-200">
            {(
              [
                { id: "direct", label: "직접 입력" },
                { id: "file", label: "파일로 올리기" },
              ] as const
            ).map((t) => {
              const on = t.id === mode;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setMode(t.id)}
                  className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 ${
                    on
                      ? "border-slate-900 font-semibold text-slate-900"
                      : "border-transparent font-medium text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          {mode === "direct" ? (
            <div className="mt-4">
              <label htmlFor="inv-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                이메일
              </label>
              {/* 칩 상자 — 클릭하면 어디를 눌러도 입력으로 들어간다 */}
              <div
                className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 p-1.5 focus-within:border-slate-400"
                onClick={(e) => {
                  if (e.target === e.currentTarget) document.getElementById("inv-email")?.focus();
                }}
              >
                {/* 칩은 **테두리 하나로 통일한다.** 점선이나 배경 채움으로 가르면 목록이
                    얼룩덜룩해지고, 「보낼 수 없음」이 「고장」처럼 읽힌다. 판정은 테두리와
                    글자의 옅은 색으로만 구분한다 (DESIGN.md 상태 정책). */}
                {chips.map(({ email, v }) => (
                  <span
                    key={email}
                    title={v.why || undefined}
                    className={`inline-flex items-center gap-1.5 rounded-lg border py-1 pl-2.5 pr-1.5 font-mono text-[12px] ${
                      v.kind === "ok"
                        ? "border-slate-200 text-slate-700"
                        : v.kind === "bad"
                          ? "border-red-200 text-red-600"
                          : "border-amber-200 text-amber-700"
                    }`}
                  >
                    {email}
                    <button
                      type="button"
                      aria-label={`${email} 빼기`}
                      onClick={() => setEmails((prev) => prev.filter((x) => x !== email))}
                      className="-mr-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-400"
                    >
                      <IconX size={13} />
                    </button>
                  </span>
                ))}
                <input
                  id="inv-email"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => addEmails(draft)}
                  onPaste={(e) => {
                    e.preventDefault();
                    addEmails(e.clipboardData.getData("text"));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      e.preventDefault();
                      addEmails(draft);
                    }
                    if (e.key === "Backspace" && draft === "") {
                      setEmails((prev) => prev.slice(0, -1));
                    }
                  }}
                  placeholder={emails.length === 0 ? "주소를 적고 Enter" : ""}
                  className="min-w-[150px] flex-1 bg-transparent px-1.5 py-1 text-[13px] text-slate-900 outline-none"
                />
              </div>
              {chips.length > 0 && notSendable > 0 && (
                <p className="mt-1.5 text-xs text-slate-400">
                  {chips.length}명 중 {notSendable}명은 보낼 수 없어요 — 칩에 커서를 올리면 이유가 보여요
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                aria-hidden
                tabIndex={-1}
                onChange={(e) => void readFile(e.target.files?.[0])}
              />
              <div
                className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void readFile(e.dataTransfer.files?.[0]);
                }}
              >
                <p className="text-[13.5px] font-semibold text-slate-700">CSV를 여기에 끌어다 놓으세요</p>
                <p className="mt-1 text-xs text-slate-400">이름 · 이메일 · 부서 · 직급</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => fileRef.current?.click()}>
                  <IconUpload size={14} />
                  파일 고르기
                </Button>
              </div>
              {fileName && (
                <p className="mt-2 text-xs text-slate-400">
                  <span className="font-mono">{fileName}</span> · {rows.length}줄
                </p>
              )}

              {rows.length > 0 && (
                <div className="thin-scroll relative mt-3 max-h-[220px] overflow-auto">
                  <table className="w-full min-w-[560px] text-left text-[13px]">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                        <th scope="col" className="py-2 pr-3">이름</th>
                        <th scope="col" className="px-3 py-2">이메일</th>
                        <th scope="col" className="px-3 py-2">부서</th>
                        <th scope="col" className="px-3 py-2">직급</th>
                        <th scope="col" className="py-2 pl-3">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r, i) => {
                        const v = rowVerdict(r);
                        const on = picked === i;
                        return (
                          <tr
                            key={`${r.email}-${i}`}
                            aria-selected={on}
                            onClick={() => setPicked(i)}
                            className={`cursor-pointer transition-colors ${
                              on ? "bg-slate-50 ring-1 ring-inset ring-slate-200" : "hover:bg-slate-50/70"
                            }`}
                          >
                            <td className="py-2 pr-3 font-medium text-slate-900">{r.name}</td>
                            <td className="px-3 py-2 font-mono text-[11.5px] text-slate-500">{r.email}</td>
                            <td className="px-3 py-2">
                              {/* 없는 이름은 자동으로 고르지 않는다 — 잘못 짚으면 엉뚱한 권한이 나간다 */}
                              {r.dept ? (
                                <span className="text-slate-600">{r.dept}</span>
                              ) : (
                                <select
                                  className={`${FIELD} py-1 text-[12px]`}
                                  value=""
                                  aria-label={`${r.name} 부서 고르기`}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => fixRow(i, { dept: e.target.value })}
                                >
                                  <option value="">고르기</option>
                                  {deptList.map((d) => (
                                    <option key={d.id} value={d.name}>
                                      {d.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {r.rank ? (
                                <span className="text-slate-600">{r.rank}</span>
                              ) : r.dept ? (
                                <select
                                  className={`${FIELD} py-1 text-[12px]`}
                                  value=""
                                  aria-label={`${r.name} 직급 고르기`}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => fixRow(i, { rank: e.target.value })}
                                >
                                  <option value="">고르기</option>
                                  {rankNamesOf(r.dept).map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs text-slate-400">부서 먼저</span>
                              )}
                            </td>
                            <td className="py-2 pl-3">
                              <Badge tone={TONE[v.kind]}>{v.kind === "ok" ? "보낼 수 있어요" : v.why}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 부서·직급 — 직접 입력일 때만. 파일은 줄마다 값을 갖는다 */}
          {mode === "direct" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="inv-dept" className="mb-1.5 block text-sm font-medium text-slate-700">
                  부서
                </label>
                {deptLocked ? (
                  /* 고를 게 하나뿐이면 드롭다운을 두지 않는다 — 눌러도 안 바뀌는 컨트롤이
                     제일 헷갈린다. 값과 이유만 보인다 */
                  <p className="flex h-[38px] items-center gap-2 text-sm text-slate-600">
                    {deptList[0]?.name ?? "소속된 부서가 없어요"}
                    <Badge tone="slate">내 부서로 고정</Badge>
                  </p>
                ) : (
                  <select
                    id="inv-dept"
                    value={deptId ?? ""}
                    onChange={(e) => changeDept(e.target.value === "" ? null : Number(e.target.value))}
                    className={FIELD}
                  >
                    <option value="">부서 없음</option>
                    {deptList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label htmlFor="inv-rank" className="mb-1.5 block text-sm font-medium text-slate-700">
                  직급
                </label>
                <select
                  id="inv-rank"
                  value={roleId ?? ""}
                  onChange={(e) => setRoleId(Number(e.target.value))}
                  disabled={rankList.length === 0}
                  className={FIELD}
                >
                  {rankList.length === 0 ? (
                    <option value="">줄 수 있는 직급이 없어요</option>
                  ) : (
                    rankList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          )}

          {/* 권한 미리보기 — 읽기 전용 */}
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2">
              <span className="text-xs font-semibold text-slate-600">
                {mode === "file" && pickedRow
                  ? `${pickedRow.name} · ${pickedRow.dept ?? "부서 없음"} ${pickedRow.rank ?? ""}`
                  : mode === "file"
                    ? "줄을 누르면 그 사람의 권한이 보여요"
                    : "이 직급이 볼 수 있는 탭"}
              </span>
              <span className="text-[11px] text-slate-400">읽기 전용</span>
            </div>
            <RankTabsPreview role={previewRole ? roleDefOf(previewRole) : null} />
          </div>
        </div>
      )}
    </Modal>
  );
}
