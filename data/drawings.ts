/**
 * 제품설계 > 도면 관리 더미 데이터 (FR-DR-01~11).
 * 도면 목록 표(module-pages)와 같은 내용을 마스터-디테일 화면용 구조로 담는다.
 */

export type DrawingStatus = "승인" | "확인 필요" | "폐기";

export interface DrawingRevision {
  rev: string;
  date: string;
  /** 변경 내용 (FR-DR-03) */
  change: string;
  /** 요청 주체 — 고객사 / 사내 설계 등 */
  requester: string;
}

/** BOM 한 줄 — 등록·리비전 위저드의 추출 결과 미리보기에 쓴다 */
export interface DrawingBomLine {
  item: string;
  spec: string;
  size: string;
  qty: string;
}

export interface Drawing {
  code: string;
  name: string;
  rev: string;
  kind: "원본" | "파생";
  /** 파생일 때 상위 도면 code */
  parent?: string;
  /** 파생이 근거로 삼은 상위 리비전 (FR-DR-08 역추적) */
  parentRev?: string;
  /** 원본만 보유 */
  vehicle?: string;
  projectCode?: string;
  /** 정제 엑셀 첨부 여부 (FR-DR-01 — 도면 단독 등록 허용) */
  excel: boolean;
  author: string;
  updated: string;
  status: DrawingStatus;
  /** 최신이 앞 */
  revisions: DrawingRevision[];
  bom: DrawingBomLine[];
}

export const DRAWINGS: Drawing[] = [
  {
    code: "26MSX-S03-20",
    name: "S03 OP20 (FO) LH 조립도",
    rev: "Rev.C",
    kind: "원본",
    vehicle: "미창 SX3e 88528-XD010",
    projectCode: "26MSX-S03 OP20",
    excel: true,
    author: "설계 외주",
    updated: "2026-07-02",
    status: "승인",
    revisions: [
      { rev: "Rev.C", date: "2026-07-02", change: "가이드 포스트 Φ30 → Φ32 상향", requester: "고객사(미창)" },
      { rev: "Rev.B", date: "2026-06-24", change: "리프트 스프링 위치 12mm 이동", requester: "사내 설계" },
      { rev: "Rev.A", date: "2026-06-11", change: "최초 등록", requester: "고객사(미창)" },
    ],
    bom: [
      { item: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", qty: "4" },
      { item: "SPRING-LIFT", spec: "SWF", size: "12-50", qty: "3" },
      { item: "LIFT PIN", spec: "LP", size: "10-58", qty: "3" },
      { item: "GAUGE", spec: "HMD", size: "20*65*35t", qty: "7" },
    ],
  },
  {
    code: "26MSX-S03-20-P1",
    name: "S03 OP20 상형 가공도",
    rev: "Rev.B",
    kind: "파생",
    parent: "26MSX-S03-20",
    parentRev: "Rev.B",
    excel: true,
    author: "설계 외주",
    updated: "2026-07-02",
    status: "확인 필요",
    revisions: [
      { rev: "Rev.B", date: "2026-07-02", change: "포켓 깊이 18 → 20 수정", requester: "사내 설계" },
      { rev: "Rev.A", date: "2026-06-24", change: "최초 등록", requester: "사내 설계" },
    ],
    bom: [{ item: "UPPER HEIGHT BLOCK", spec: "S45C", size: "Φ40-95L", qty: "2" }],
  },
  {
    code: "26MSX-S03-20-P2",
    name: "S03 OP20 하형 가공도",
    rev: "Rev.A",
    kind: "파생",
    parent: "26MSX-S03-20",
    parentRev: "Rev.C",
    excel: true,
    author: "설계 외주",
    updated: "2026-06-30",
    status: "승인",
    revisions: [{ rev: "Rev.A", date: "2026-06-30", change: "최초 등록", requester: "사내 설계" }],
    bom: [{ item: "LOWER HEIGHT BLOCK", spec: "S45C", size: "Φ40-95L", qty: "2" }],
  },
  {
    code: "26MSX-S03-20-P0",
    name: "S03 OP20 상형 가공도 (구버전)",
    rev: "Rev.A",
    kind: "파생",
    parent: "26MSX-S03-20",
    parentRev: "Rev.A",
    excel: true,
    author: "설계 외주",
    updated: "2026-06-24",
    status: "폐기",
    revisions: [{ rev: "Rev.A", date: "2026-06-24", change: "최초 등록 — 기준면 오적용", requester: "사내 설계" }],
    bom: [],
  },
  {
    code: "26MSX-S04-20",
    name: "S04 OP20 (FO) RH 조립도",
    rev: "Rev.B",
    kind: "원본",
    vehicle: "미창 SX3e 88628-XD010",
    projectCode: "26MSX-S04 OP20",
    excel: true,
    author: "설계 외주",
    updated: "2026-07-02",
    status: "승인",
    revisions: [
      { rev: "Rev.B", date: "2026-07-02", change: "S03 대칭 반영 (LH → RH)", requester: "사내 설계" },
      { rev: "Rev.A", date: "2026-06-15", change: "최초 등록", requester: "고객사(미창)" },
    ],
    bom: [
      { item: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", qty: "4" },
      { item: "SPRING-LIFT", spec: "SWF", size: "12-50", qty: "3" },
      { item: "LIFT PIN", spec: "LP", size: "10-58", qty: "3" },
      { item: "GAUGE", spec: "HMD", size: "20*65*35t", qty: "7" },
    ],
  },
  {
    code: "26MSX-S04-20-P1",
    name: "S04 OP20 상형 가공도",
    rev: "Rev.A",
    kind: "파생",
    parent: "26MSX-S04-20",
    parentRev: "Rev.B",
    excel: false,
    author: "설계 외주",
    updated: "2026-07-01",
    status: "승인",
    revisions: [{ rev: "Rev.A", date: "2026-07-01", change: "최초 등록", requester: "사내 설계" }],
    bom: [],
  },
  {
    code: "26PNQ-S16-10",
    name: "S16 OP10 조립도",
    rev: "Rev.D",
    kind: "원본",
    vehicle: "미창 PNQ 88512-XA010",
    projectCode: "26PNQ-S16 OP10",
    excel: true,
    author: "설계 외주",
    updated: "2026-06-18",
    status: "승인",
    revisions: [
      { rev: "Rev.D", date: "2026-06-18", change: "가이드 핀 SGPH 20-120 수량 8 → 16", requester: "고객사(미창)" },
      { rev: "Rev.C", date: "2026-06-02", change: "웨어 플레이트 규격 변경", requester: "사내 설계" },
      { rev: "Rev.B", date: "2026-05-20", change: "백업 키 추가", requester: "사내 설계" },
      { rev: "Rev.A", date: "2026-05-08", change: "최초 등록", requester: "고객사(미창)" },
    ],
    bom: [
      { item: "GUIDE PIN", spec: "SGPH", size: "20-120", qty: "16" },
      { item: "WEAR PLATE", spec: "STW", size: "38-100", qty: "14" },
    ],
  },
];

/** Rev.A → Rev.B */
export function nextRev(rev: string): string {
  const c = rev.replace("Rev.", "");
  return "Rev." + String.fromCharCode(c.charCodeAt(0) + 1);
}
