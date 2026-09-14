/**
 * 한국어 조사 — 앞 글자 받침에 따라 갈린다.
 *
 * 이름을 문장에 끼워 넣는 곳이 늘면서 필요해졌다. 「생산본부을 지울까요?」처럼 어긋나는데,
 * 이름이 데이터라서 문장을 고정해 둘 수가 없다.
 *
 * 이 파일은 **import를 갖지 않는다** — `node --test`가 타입 스트립으로 그대로 실행한다.
 */

/**
 * 마지막 글자의 받침 — 한글 음절만 본다.
 *
 * `null`은 한글이 아니라는 뜻이다. 영문·숫자로 끝나는 이름은 읽는 사람마다 발음이 달라
 * (「MES를」 / 「MES을」) 받침 없음으로 친다 — 둘 중 하나는 골라야 하고, 받침 없는 쪽이
 * 어색함이 덜하다.
 */
function finalConsonant(word: string): number | null {
  const last = word.trim().at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28;
}

/** 받침이 있으면 `withFinal`, 없으면 `plain` */
function pick(word: string, withFinal: string, plain: string): string {
  const f = finalConsonant(word);
  return f === null || f === 0 ? plain : withFinal;
}

/**
 * 이름 뒤에 붙일 조사를 고른다.
 *
 * ```ts
 * `${dept}${josa(dept, "을/를")} 지울까요?`  // 생산본부를 · 공장장을
 * ```
 *
 * 쓰는 짝만 둔다. `이/가`·`와/과`가 필요해지면 그때 `pick`으로 한 줄씩 늘린다.
 */
export type JosaPair = "을/를" | "은/는" | "로/으로";

export function josa(word: string, pair: JosaPair): string {
  switch (pair) {
    case "을/를":
      return pick(word, "을", "를");
    case "은/는":
      // 발주서 편집기 「단위는 이 서식의 문서에 안 찍혀요」 — 열 이름이 데이터라 조사를 고정할 수 없다
      return pick(word, "은", "는");
    case "로/으로": {
      // ㄹ 받침은 「로」를 쓴다 — 「서울로」지 「서울으로」가 아니다
      const f = finalConsonant(word);
      if (f === null || f === 0 || f === 8) return "로";
      return "으로";
    }
  }
}

/** 이름과 조사를 붙인 문자열 — 부르는 쪽이 짧아진다 */
export function withJosa(word: string, pair: JosaPair): string {
  return word + josa(word, pair);
}
