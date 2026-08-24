import type { DetailRecord } from "./types";
import { DETAILS as management } from "./pages/management";
import { DETAILS as sales } from "./pages/sales";
import { DETAILS as support } from "./pages/support";
export { HR_MEMBERS } from "./pages/management";

/**
 * 테이블 행 클릭 시 뜨는 상세 팝업 데이터.
 * [모듈slug][탭id] = 해당 탭 table.rows 와 같은 순서의 상세 레코드 배열.
 * 실제 내용은 `data/pages/<모듈>.ts` 에 있다. 이 파일은 모아 주는 배럴이다.
 */
export const ROW_DETAILS: Record<string, Record<string, DetailRecord[]>> = {
  management,
  sales,
  support,
};
