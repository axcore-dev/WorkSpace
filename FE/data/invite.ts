/**
 * 초대 예외 판정과 CSV 파싱 — 순수 로직.
 *
 * 이 파일은 **import를 갖지 않는다.** `node --test`가 타입 스트립으로 `.ts`를 그대로
 * 실행하는데 `@/` 경로 별칭을 해석하지 못한다 (`data/roles.ts`와 같은 이유).
 *
 * **원칙: 보낼 수 있는 것만 보내고, 못 보내는 줄은 이유를 남긴다.**
 * 한 줄이 잘못됐다고 전체를 막지 않고, 몰래 건너뛰지도 않는다.
 */

/**
 * 한 줄의 판정.
 *
 * - `ok` — 보낸다
 * - `warn` — **보낸다.** 다만 표시한다 (외부 도메인처럼 의심스럽지만 정당할 수 있는 것)
 * - `skip` — 안 보낸다. 이미 있거나 이미 보낸 것이라 다시 보낼 이유가 없다
 * - `bad` — 못 보낸다. 고쳐야 한다
 */
export type InviteVerdict = {
  kind: "ok" | "warn" | "skip" | "bad";
  why: string;
};

export const SENDABLE: InviteVerdict["kind"][] = ["ok", "warn"];

/** 주소 모양만 본다 — 실제로 받는 주소인지는 메일을 보내 봐야 안다 */
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 이메일 한 줄을 판정한다.
 *
 * **외부 도메인을 막지 않는다.** 협력사·감사인처럼 사외 주소를 부를 일이 실제로 있다.
 * 표시만 하고 보낸다 — 막아야 한다면 초대 정책이라는 별개 기능이 필요하다.
 */
export function classifyEmail(
  email: string,
  ctx: { members: string[]; pending: string[]; workDomains: string[] },
): InviteVerdict {
  const v = email.trim().toLowerCase();

  if (!SHAPE.test(v)) return { kind: "bad", why: "주소 형식이 아니에요" };
  if (ctx.members.some((m) => m.toLowerCase() === v)) {
    return { kind: "skip", why: "이미 구성원이에요" };
  }
  if (ctx.pending.some((p) => p.toLowerCase() === v)) {
    return { kind: "skip", why: "초대 중이에요" };
  }

  const domain = v.slice(v.lastIndexOf("@") + 1);
  if (!ctx.workDomains.some((d) => domain === d.toLowerCase())) {
    return { kind: "warn", why: "회사 메일이 아니에요" };
  }
  return { kind: "ok", why: "" };
}

/**
 * 붙여넣은 문자열을 주소 목록으로 쪼갠다 — 쉼표·세미콜론·줄바꿈·공백 다.
 *
 * **같은 주소는 하나로 합친다.** 대소문자만 다른 것도 같은 주소다. 순서는 처음 나온 자리를
 * 지킨다 — 붙여넣은 목록과 화면 순서가 다르면 뭐가 빠졌는지 못 찾는다.
 */
export function splitEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[\s,;]+/)) {
    const v = piece.trim().toLowerCase();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export type InviteRow = {
  name: string;
  email: string;
  /** 파일에 적힌 값. 목록에 없는 이름이면 `null`이 되고 화면에서 골라야 한다 */
  dept: string | null;
  rank: string | null;
  /** 파일에 있었지만 목록에 없던 원래 값 — 「‘생산1팀’은 없는 부서예요」로 보여준다 */
  rawDept?: string;
  rawRank?: string;
};

/**
 * 초대 CSV를 읽는다. 열은 **이름 · 이메일 · 부서 · 직급**.
 *
 * 첫 줄이 머리글처럼 보이면 건너뛴다 — 양식을 그대로 채워 올리는 게 보통이라
 * 머리글을 남겨 두면 「이름」이라는 사람이 초대된다.
 *
 * **부서·직급이 목록에 없으면 비워 둔다.** 비슷한 이름으로 자동 보정하지 않는다 —
 * 「생산본부」와 「생산관리팀」을 잘못 짚으면 엉뚱한 권한이 나간다.
 *
 * 따옴표로 감싼 칸은 다루지 않는다. 이름·메일·부서·직급에 쉼표가 들어갈 일이 없다.
 * ponytail: 쉼표가 든 값이 실제로 나오면 그때 파서를 올린다.
 */
export function parseInviteCsv(
  text: string,
  known: { depts: readonly string[]; ranksOf: (dept: string) => readonly string[] },
): InviteRow[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];
  const first = lines[0].split(",").map((c) => c.trim());
  const hasHeader = first[0] === "이름" || first[0].toLowerCase() === "name";

  return lines.slice(hasHeader ? 1 : 0).map((line) => {
    const [name = "", email = "", dept = "", rank = ""] = line.split(",").map((c) => c.trim());
    const deptOk = known.depts.includes(dept) ? dept : null;
    // 부서가 틀리면 직급도 확인할 수 없다 — 직급은 부서 안에 있다
    const rankOk = deptOk && known.ranksOf(deptOk).includes(rank) ? rank : null;
    return {
      name,
      email: email.toLowerCase(),
      dept: deptOk,
      rank: rankOk,
      ...(deptOk ? {} : { rawDept: dept }),
      ...(rankOk ? {} : { rawRank: rank }),
    };
  });
}

/** 「4명 중 2명에게 보냈어요」에 쓸 숫자 */
export function summarize(verdicts: InviteVerdict[]): {
  total: number;
  sending: number;
  skipped: number;
  blocked: number;
} {
  return {
    total: verdicts.length,
    sending: verdicts.filter((v) => SENDABLE.includes(v.kind)).length,
    skipped: verdicts.filter((v) => v.kind === "skip").length,
    blocked: verdicts.filter((v) => v.kind === "bad").length,
  };
}
