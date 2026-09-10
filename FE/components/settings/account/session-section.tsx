"use client";

import { useEffect, useState } from "react";
import {
  SectionActions,
  SettingsSection,
} from "@/components/settings/settings-section";
import { IconLaptop } from "@/components/icons";
import { Badge, Button } from "@/components/ui";
import { getSessions, revokeSession, type SessionDto } from "@/lib/account-api";

/**
 * 계정 › 기기 — 살아 있는 세션 (`GET /api/auth/sessions`).
 *
 * 현장 공용 단말을 로그아웃하지 않고 떠나는 일이 잦아서 넣었다. 여기서 바로 끊는다
 * (`DELETE /api/auth/sessions/{id}`).
 *
 * **기기 이름과 위치는 서버에 없다.** 세션이 들고 있는 것은 `User-Agent` 문자열과 IP 뿐이다.
 * 이름은 그 문자열에서 OS·브라우저만 뽑아 만들고, 위치 자리에는 IP 를 그대로 둔다 — 지역으로
 * 바꾸려면 GeoIP 가 필요하고 그건 서버 몫이다. 알아볼 수 없는 문자열은 「알 수 없는 기기」다.
 *
 * **「다른 기기 모두 로그아웃」은 한 번에 지우는 경로가 없다.** 남은 세션마다 DELETE 를 보낸다.
 * 하나가 실패해도 나머지는 끊고, 끝에 실제로 끊긴 수를 알린다 — 다 끊긴 것처럼 말해 두고
 * 하나가 살아 있으면 그게 가장 나쁘다.
 */
export function SessionSection({
  onSaved,
}: {
  onSaved: (message: string, tone?: "ink" | "error") => void;
}) {
  /** null 은 「불러오는 중」. 실패는 `failed` 로 따로 둔다 — 빈 목록으로 바꾸면 「끊을 기기가 없다」로 읽혀서
   *  공용 단말을 정리하러 온 사람이 그대로 나간다. */
  const [sessions, setSessions] = useState<SessionDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const rows = await getSessions();
        if (alive) setSessions(rows);
      } catch {
        if (alive) setFailed(true);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  /** 「다시 시도」 — 버튼 핸들러라 실패 표시를 지우고 로딩으로 되돌린 뒤 다시 받는다 */
  async function retry() {
    setFailed(false);
    setSessions(null);
    try {
      setSessions(await getSessions());
    } catch {
      setFailed(true);
    }
  }

  const rows = sessions ?? [];
  const current = rows.find((s) => s.current);
  const rest = rows.filter((s) => !s.current);
  const others = rest.length;

  async function logoutOne(session: SessionDto) {
    setBusy(true);
    try {
      await revokeSession(session.id);
      setSessions((prev) => (prev ?? []).filter((s) => s.id !== session.id));
      onSaved(`${deviceName(session.userAgent)}에서 로그아웃했어요`);
    } catch (e: unknown) {
      onSaved(e instanceof Error && e.message ? e.message : "끊지 못했어요", "error");
    } finally {
      setBusy(false);
    }
  }

  async function logoutOthers() {
    setBusy(true);
    const results = await Promise.allSettled(rest.map((s) => revokeSession(s.id)));
    const goneIds = rest.filter((_, i) => results[i].status === "fulfilled").map((s) => s.id);
    setSessions((prev) => (prev ?? []).filter((s) => !goneIds.includes(s.id)));
    setBusy(false);
    if (goneIds.length === rest.length) {
      onSaved(`${goneIds.length}개 기기에서 로그아웃했어요`);
    } else {
      onSaved(`${goneIds.length}개만 로그아웃했어요. 나머지는 다시 시도해 주세요`, "error");
    }
  }

  return (
    <SettingsSection
      title="기기"
      aside={
        <span className="text-xs text-slate-400">
          {failed ? "확인하지 못했어요" : sessions === null ? "" : `다른 기기 ${others}대`}
        </span>
      }
    >
      {/* 지금 쓰는 기기를 표 밖으로 뺀다. 그러면 아래 「다른 기기 모두 로그아웃」이 무엇을
          지우고 무엇을 남기는지가 배치로 설명된다 — 문장으로 안 적어도 된다. */}
      {current && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <IconLaptop size={17} className="shrink-0 text-slate-500" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-900">
              {deviceName(current.userAgent)}
              <Badge tone="green">지금 이 기기</Badge>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {current.ip ?? "주소 없음"} · {formatDate(current.createdAt)} 로그인
            </p>
          </div>
        </div>
      )}

      {failed ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-[13.5px] text-slate-500">기기 목록을 불러오지 못했어요.</p>
          <Button variant="secondary" size="sm" onClick={() => void retry()}>
            다시 시도
          </Button>
        </div>
      ) : sessions === null ? (
        <p className="py-8 text-center text-[13.5px] text-slate-400">불러오는 중이에요…</p>
      ) : rest.length === 0 ? (
        <p className="py-8 text-center text-[13.5px] text-slate-400">
          다른 기기에서 로그인한 기록이 없어요.
        </p>
      ) : (
        <>
          <div className="thin-scroll relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-400">
                  <th scope="col" className="py-2.5 pr-3">다른 기기</th>
                  <th scope="col" className="px-3 py-2.5">로그인</th>
                  <th scope="col" className="px-3 py-2.5">IP</th>
                  {/* 동작 열은 이름을 두지 않는다 — 읽을 값이 아니다 */}
                  <th scope="col" className="py-2.5 pl-3">
                    <span className="sr-only">동작</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rest.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="py-3 pr-3">
                      <span className="flex items-center gap-2">
                        <IconLaptop size={15} className="shrink-0 text-slate-400" />
                        <span className="min-w-0 font-medium text-slate-900">
                          {deviceName(s.userAgent)}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">{formatDate(s.createdAt)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">
                      {s.ip ?? "—"}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void logoutOne(s)}
                      >
                        로그아웃
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SectionActions>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => void logoutOthers()}>
              다른 기기 {others}대 모두 로그아웃
            </Button>
          </SectionActions>
        </>
      )}
    </SettingsSection>
  );
}

/**
 * `User-Agent` 에서 사람이 읽을 이름을 만든다. 정확한 파싱이 아니라 목록에서 자기 기기를
 * 알아볼 정도면 된다 — 라이브러리를 들이지 않는 이유다.
 */
function deviceName(userAgent: string | null): string {
  if (!userAgent) return "알 수 없는 기기";
  const os =
    /Windows/i.test(userAgent) ? "Windows"
    : /iPhone|iPad/i.test(userAgent) ? "iOS"
    : /Android/i.test(userAgent) ? "Android"
    : /Mac OS X/i.test(userAgent) ? "macOS"
    : /Linux/i.test(userAgent) ? "Linux"
    : null;
  // Edge·Chrome 은 UA 에 서로의 이름을 함께 싣는다. 좁은 것부터 본다
  const browser =
    /Edg\//i.test(userAgent) ? "Edge"
    : /OPR\//i.test(userAgent) ? "Opera"
    : /Chrome\//i.test(userAgent) ? "Chrome"
    : /Safari\//i.test(userAgent) ? "Safari"
    : /Firefox\//i.test(userAgent) ? "Firefox"
    : null;
  if (os && browser) return `${os} · ${browser}`;
  return os ?? browser ?? userAgent.slice(0, 40);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
