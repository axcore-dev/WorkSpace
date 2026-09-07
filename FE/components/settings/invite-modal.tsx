"use client";

import { useMemo, useRef, useState } from "react";
import { Modal } from "@/components/modal";
import { RankTabsPreview } from "@/components/settings/company/rank-perms";
import { IconCheckCircle, IconUpload, IconX } from "@/components/icons";
import { Badge, Button, FIELD } from "@/components/ui";
import {
  DEPARTMENTS,
  PENDING_INVITES,
  ROLES,
  USERS_ROLES,
  WORK_DOMAINS,
  currentRole,
} from "@/data/org";
import { grantableRanks, invitableDepts } from "@/data/grants";
import {
  classifyEmail,
  parseInviteCsv,
  splitEmails,
  summarize,
  type InviteRow,
  type InviteVerdict,
} from "@/data/invite";

type Mode = "direct" | "file";

/** 판정 톤 — 배지에 배경을 넣지 않는다 (DESIGN.md 「알약 배지 금지」) */
const TONE: Record<InviteVerdict["kind"], "green" | "amber" | "red" | "slate"> = {
  ok: "green",
  warn: "amber",
  skip: "amber",
  bad: "red",
};

/**
 * 이 부서에서 **내가 줄 수 있는** 직급.
 *
 * 직급은 부서 안에 있고(부서로 한 번 거른다), 그중에서도 내 권한 안에 드는 것만 남긴다 —
 * 내가 못 보는 탭을 남에게 열어 줄 수 없다 (`data/grants.ts`).
 */
function ranksOf(dept: string): string[] {
  return grantableRanks(currentRole(), ROLES.filter((r) => r.dept === dept)).map((r) => r.name);
}

function verdictCtx() {
  return {
    members: USERS_ROLES.map((u) => u.email),
    pending: PENDING_INVITES.map((p) => p.email),
    workDomains: [...WORK_DOMAINS],
  };
}

/**
 * 구성원 초대 팝업.
 *
 * **한 번에 여러 명이다.** 직접 입력은 주소를 칩으로 쌓고, 파일은 이름·이메일·부서·직급
 * 네 칸짜리 CSV를 읽는다. 판정 로직은 `data/invite.ts`에 있고 테스트가 지킨다.
 *
 * **권한을 여기서 만들지 않는다.** 예전에는 이 팝업에서 기능을 직접 켰는데, 이제 권한은
 * 직급이 정하고 직급은 권한 관리(소유자 전용)에서 만든다. 여기서는 고른 직급이 어떤 탭을
 * 여는지 **읽기 전용**으로 보여줄 뿐이다 — 안 그러면 초대하는 사람이 우회로 권한을 만든다.
 *
 * 「팀장 관점 미리보기」 토글은 뺐다. 위임 여부는 고를 수 있는 직급 목록이 줄어드는 것으로
 * 드러나는 게 맞다 — 관점을 바꿔 보는 것보다 실제로 못 고르는 편이 정확하다.
 *
 * **엑셀(.xlsx)은 아직 안 받는다.** 읽으려면 패키지가 하나 필요하고 그건 승인 사항이다
 * (루트 CLAUDE.md 의존성 규칙). CSV는 지금 코드로 읽는다.
 *
 * **BE 연동 seam**: `send()`가 초대 발급 API를 부른다. 운영자 콘솔 쪽에는 이미 발급·목록·
 * 취소가 있다(`lib/admin-api.ts`) — 고객 워크스페이스 관리자용이 생기면 그걸 부른다.
 */
export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("direct");
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  /**
   * 고를 수 있는 부서 — 전체 범위가 아니면 **자기 부서 하나로 고정**된다.
   * 부서 범위인 사람이 남의 부서로 사람을 부르면 자기가 볼 수 없는 곳에 구성원을 만드는
   * 셈이라, 부른 뒤에 확인도 못 한다 (`data/grants.ts`).
   */
  const deptList = invitableDepts(currentRole(), DEPARTMENTS);
  const deptLocked = deptList.length <= 1;

  const [dept, setDept] = useState<string>(deptList[0] ?? "");
  const [rank, setRank] = useState<string>(ranksOf(deptList[0] ?? "")[0] ?? "");
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [sent, setSent] = useState<ReturnType<typeof summarize> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 목록은 렌더마다 다시 만들 이유가 없다 — 판정이 매번 배열을 훑는다
  const ctx = useMemo(() => verdictCtx(), []);
  const rankList = ranksOf(dept);

  function changeDept(next: string) {
    setDept(next);
    // 부서를 바꾸면 직급도 그 부서 것으로 옮긴다 — 안 하면 없는 조합이 남는다
    setRank(ranksOf(next)[0] ?? "");
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
    setRows(parseInviteCsv(text, { depts: deptList, ranksOf }));
    setPicked(null);
  }

  function fixRow(i: number, patch: Partial<InviteRow>) {
    setRows((prev) =>
      prev.map((r, k) => {
        if (k !== i) return r;
        const next = { ...r, ...patch };
        // 부서를 바꾸면 그 부서에 없는 직급은 버린다
        if (patch.dept !== undefined && next.rank && !ranksOf(patch.dept ?? "").includes(next.rank)) {
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
  const tally = summarize(verdicts);

  const pickedRow = picked !== null ? rows[picked] : null;
  const previewRole =
    mode === "direct"
      ? (ROLES.find((r) => r.dept === dept && r.name === rank) ?? null)
      : (ROLES.find((r) => r.dept === pickedRow?.dept && r.name === pickedRow?.rank) ?? null);

  function close() {
    setMode("direct");
    setEmails([]);
    setDraft("");
    setRows([]);
    setFileName("");
    setPicked(null);
    setSent(null);
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
              {tally.sending}명에게 보냅니다
              {tally.skipped + tally.blocked > 0 &&
                ` · ${tally.skipped + tally.blocked}명은 건너뜁니다`}
            </span>
            <span className="flex gap-2">
              <Button variant="secondary" onClick={close}>
                취소
              </Button>
              <Button disabled={tally.sending === 0} onClick={() => setSent(tally)}>
                초대 보내기
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
            {sent.total}명 중 {sent.sending}명에게 초대를 보냈어요
          </p>
          {sent.skipped + sent.blocked > 0 && (
            <p className="mt-1.5 max-w-sm text-sm text-slate-500">
              {[
                sent.skipped > 0 && `이미 있거나 초대 중인 ${sent.skipped}명`,
                sent.blocked > 0 && `고쳐야 하는 ${sent.blocked}명`,
              ]
                .filter(Boolean)
                .join(", ")}
              은 건너뛰었어요.
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
              {tally.total > 0 && tally.sending < tally.total && (
                <p className="mt-1.5 text-xs text-slate-400">
                  {tally.total}명 중 {tally.total - tally.sending}명은 보낼 수 없어요 — 칩에
                  커서를 올리면 이유가 보여요
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
                <p className="text-[13.5px] font-semibold text-slate-700">
                  CSV를 여기에 끌어다 놓으세요
                </p>
                <p className="mt-1 text-xs text-slate-400">이름 · 이메일 · 부서 · 직급</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => fileRef.current?.click()}
                >
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
                            <td className="px-3 py-2 font-mono text-[11.5px] text-slate-500">
                              {r.email}
                            </td>
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
                                    <option key={d} value={d}>
                                      {d}
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
                                  {ranksOf(r.dept).map((n) => (
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
                              <Badge tone={TONE[v.kind]}>
                                {v.kind === "ok" ? "보낼 수 있어요" : v.why}
                              </Badge>
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
                    {dept || "소속된 부서가 없어요"}
                    <Badge tone="slate">내 부서로 고정</Badge>
                  </p>
                ) : (
                  <select
                    id="inv-dept"
                    value={dept}
                    onChange={(e) => changeDept(e.target.value)}
                    className={FIELD}
                  >
                    {deptList.map((d) => (
                      <option key={d} value={d}>
                        {d}
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
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  disabled={rankList.length === 0}
                  className={FIELD}
                >
                  {rankList.length === 0 ? (
                    <option value="">줄 수 있는 직급이 없어요</option>
                  ) : (
                    rankList.map((n) => (
                      <option key={n} value={n}>
                        {n}
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
            <RankTabsPreview role={previewRole} />
          </div>
        </div>
      )}
    </Modal>
  );
}
