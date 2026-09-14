/**
 * 제품설계 > 도면 · BOM 모델과 데모 데이터 (FR-DR-01~11).
 *
 * **리비전 하나가 도면 하나다.** `26MSX-S03-20 Rev.B` 와 `Rev.C` 는 같은 도면번호의 다른 도면이고, Rev.C 는 Rev.B 에서
 * 파생된 것이다(2026-09-14 결정). 그래서 목록의 식별자는 `code + rev` 이고, 옛 리비전도 자기 BOM 을 그대로 갖는다.
 * 「지금 도면」은 같은 도면번호 중 리비전이 가장 높은 것이다(`latestOf`).
 *
 * 모델은 BE(`/api/workspace/design/drawings`, `DrawingDto`)와 같다. 데모 데이터는 BE 가 안 떠 있는 dev 에서
 * `components/design/design-provider.tsx` 가 폴백으로 쓰고, `INFRA/seed/data/design-demo.sql` 이 같은 값을 DB 에 넣는다.
 * 두 곳이 어긋나면 폴백 화면과 서버 화면이 달라진다.
 */

export type DrawingStatus = "승인" | "확인 필요" | "폐기";

/**
 * BOM 한 줄 — 정제 엑셀에서 추출한 표기 그대로.
 *
 * `itemCode` 가 설계 ↔ 재고의 다리다. null 이면 「미매핑」 — 발주서 작성이 이 도면을 막는다. 서버가 등록 때 품목 마스터에서
 * 호칭+규격 → 품명 순으로 자동 매핑하고, 못 찾은 줄은 BOM 관리에서 사람이 맺는다.
 */
export interface DrawingBomLine {
  /** 서버가 매긴 줄 id. 폴백 데이터에는 없다 */
  id?: number;
  item: string;
  spec: string;
  size: string;
  qty: number;
  itemCode: string | null;
}

/** 도면 하나 = 도면번호 + 리비전. 같은 code 의 다음 리비전은 앞 리비전에서 파생된 것으로 본다(별도 링크 없음 — 글자 순) */
export interface Drawing {
  code: string;
  rev: string;
  name: string;
  /** 파생 도면(가공도 등)이 근거로 삼은 상위 도면 code · 리비전 (FR-DR-08 역추적). 원본은 null */
  parent?: string | null;
  parentRev?: string | null;
  /** 원본만 보유 — 파생은 null 이라 화면이 상위 도면의 값을 대신 보인다 */
  vehicle?: string | null;
  projectCode?: string | null;
  /** 정제 엑셀 첨부 여부 (FR-DR-01 — 도면 단독 등록 허용) */
  excel: boolean;
  author: string;
  /** 이 리비전을 등록한 날 */
  updated: string;
  status: DrawingStatus;
  /** 이 리비전의 변경 내용 (FR-DR-03) · 요청 주체(고객사 / 사내 설계) */
  change: string;
  requester: string;
  bom: DrawingBomLine[];
}

const S03_BOM_A: DrawingBomLine[] = [
  { item: "GUIDE POST", spec: "MYKP", size: "Φ30-140L", qty: 4, itemCode: null },
  { item: "SPRING-LIFT", spec: "SWF", size: "12-50", qty: 3, itemCode: "ITM-SP-0001" },
  { item: "LIFT PIN", spec: "LP", size: "10-58", qty: 3, itemCode: "ITM-LP-0011" },
  { item: "GAUGE", spec: "HMD", size: "20*65*35t", qty: 7, itemCode: null },
];
const S04_BOM: DrawingBomLine[] = [
  { item: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", qty: 4, itemCode: "ITM-GP-0032" },
  { item: "SPRING-LIFT", spec: "SWF", size: "12-50", qty: 3, itemCode: "ITM-SP-0001" },
  { item: "LIFT PIN", spec: "LP", size: "10-58", qty: 3, itemCode: "ITM-LP-0011" },
  { item: "GAUGE", spec: "HMD", size: "20*65*35t", qty: 7, itemCode: "ITM-GA-0005" },
];
const S16_BOM_A: DrawingBomLine[] = [
  { item: "GUIDE PIN", spec: "SGPH", size: "20-120", qty: 8, itemCode: "ITM-GP-0007" },
  { item: "WEAR PLATE", spec: "STW", size: "28-100", qty: 14, itemCode: "ITM-WP-0004" },
  { item: "GAS SPRING", spec: "PX", size: "1500-80-MH", qty: 4, itemCode: "ITM-GS-0014" },
];
const BACKUP_KEY: DrawingBomLine = { item: "BACKUP KEY", spec: "SKD11", size: "20*20*80", qty: 2, itemCode: null };

const S03 = { code: "26MSX-S03-20", name: "S03 OP20 (FO) LH 조립도", vehicle: "미창 SX3e 88528-XD010", projectCode: "26MSX-S03 OP20", excel: true, author: "설계 외주" };
const S04 = { code: "26MSX-S04-20", name: "S04 OP20 (FO) RH 조립도", vehicle: "미창 SX3e 88628-XD010", projectCode: "26MSX-S04 OP20", excel: true, author: "설계 외주" };
const S16 = { code: "26PNQ-S16-10", name: "S16 OP10 조립도", vehicle: "미창 PNQ 88512-XA010", projectCode: "26PNQ-S16 OP10", excel: true, author: "설계 외주" };

/** 리비전마다 한 항목. 같은 code 는 오래된 것부터 적었다 — 순서는 뜻이 없고 `rev` 가 기준이다 */
export const DRAWINGS: Drawing[] = [
  { ...S03, rev: "Rev.A", status: "승인", updated: "2026-06-11", change: "최초 등록", requester: "고객사(미창)", bom: S03_BOM_A },
  { ...S03, rev: "Rev.B", status: "승인", updated: "2026-06-24", change: "리프트 스프링 위치 12mm 이동", requester: "사내 설계", bom: S03_BOM_A },
  {
    ...S03,
    rev: "Rev.C",
    status: "승인",
    updated: "2026-07-02",
    change: "가이드 포스트 Φ30 → Φ32 상향",
    requester: "고객사(미창)",
    bom: [
      { item: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", qty: 4, itemCode: "ITM-GP-0032" },
      { item: "SPRING-LIFT", spec: "SWF", size: "12-50", qty: 3, itemCode: "ITM-SP-0001" },
      { item: "LIFT PIN", spec: "LP", size: "10-58", qty: 3, itemCode: "ITM-LP-0011" },
      // 시연용 미매핑 — BOM 관리에서 눌러 ITM-GA-0005 에 맺는 것을 보여 준다
      { item: "GAUGE", spec: "HMD", size: "20*65*35t", qty: 7, itemCode: null },
    ],
  },
  // 파생(가공도) — 현장 제작품이라 품목 마스터에 없어 미매핑이 정상이다
  {
    code: "26MSX-S03-20-P1",
    rev: "Rev.A",
    name: "S03 OP20 상형 가공도",
    parent: "26MSX-S03-20",
    parentRev: "Rev.B",
    excel: true,
    author: "설계 외주",
    updated: "2026-06-24",
    status: "승인",
    change: "최초 등록",
    requester: "사내 설계",
    bom: [{ item: "UPPER HEIGHT BLOCK", spec: "S45C", size: "Φ40-95L", qty: 2, itemCode: null }],
  },
  {
    code: "26MSX-S03-20-P1",
    rev: "Rev.B",
    name: "S03 OP20 상형 가공도",
    parent: "26MSX-S03-20",
    parentRev: "Rev.B",
    excel: true,
    author: "설계 외주",
    updated: "2026-07-02",
    status: "확인 필요",
    change: "포켓 깊이 18 → 20 수정",
    requester: "사내 설계",
    bom: [{ item: "UPPER HEIGHT BLOCK", spec: "S45C", size: "Φ40-95L", qty: 2, itemCode: null }],
  },
  {
    code: "26MSX-S03-20-P2",
    rev: "Rev.A",
    name: "S03 OP20 하형 가공도",
    parent: "26MSX-S03-20",
    parentRev: "Rev.C",
    excel: true,
    author: "설계 외주",
    updated: "2026-06-30",
    status: "승인",
    change: "최초 등록",
    requester: "사내 설계",
    bom: [{ item: "LOWER HEIGHT BLOCK", spec: "S45C", size: "Φ40-95L", qty: 2, itemCode: null }],
  },
  {
    code: "26MSX-S03-20-P0",
    rev: "Rev.A",
    name: "S03 OP20 상형 가공도 (구버전)",
    parent: "26MSX-S03-20",
    parentRev: "Rev.A",
    excel: true,
    author: "설계 외주",
    updated: "2026-06-24",
    status: "폐기",
    change: "최초 등록 — 기준면 오적용",
    requester: "사내 설계",
    bom: [],
  },
  { ...S04, rev: "Rev.A", status: "승인", updated: "2026-06-15", change: "최초 등록", requester: "고객사(미창)", bom: S04_BOM },
  { ...S04, rev: "Rev.B", status: "승인", updated: "2026-07-02", change: "S03 대칭 반영 (LH → RH)", requester: "사내 설계", bom: S04_BOM },
  {
    code: "26MSX-S04-20-P1",
    rev: "Rev.A",
    name: "S04 OP20 상형 가공도",
    parent: "26MSX-S04-20",
    parentRev: "Rev.B",
    excel: false,
    author: "설계 외주",
    updated: "2026-07-01",
    status: "승인",
    change: "최초 등록",
    requester: "사내 설계",
    bom: [],
  },
  { ...S16, rev: "Rev.A", status: "승인", updated: "2026-05-08", change: "최초 등록", requester: "고객사(미창)", bom: S16_BOM_A },
  { ...S16, rev: "Rev.B", status: "승인", updated: "2026-05-20", change: "백업 키 추가", requester: "사내 설계", bom: [...S16_BOM_A, BACKUP_KEY] },
  {
    ...S16,
    rev: "Rev.C",
    status: "승인",
    updated: "2026-06-02",
    change: "웨어 플레이트 규격 변경",
    requester: "사내 설계",
    bom: [S16_BOM_A[0], { item: "WEAR PLATE", spec: "STW", size: "38-100", qty: 14, itemCode: "ITM-WP-0003" }, S16_BOM_A[2], BACKUP_KEY],
  },
  {
    ...S16,
    rev: "Rev.D",
    status: "승인",
    updated: "2026-06-18",
    change: "가이드 핀 SGPH 20-120 수량 8 → 16",
    requester: "고객사(미창)",
    bom: [
      { item: "GUIDE PIN", spec: "SGPH", size: "20-120", qty: 16, itemCode: "ITM-GP-0007" },
      { item: "WEAR PLATE", spec: "STW", size: "38-100", qty: 14, itemCode: "ITM-WP-0003" },
      { item: "GAS SPRING", spec: "PX", size: "1500-80-MH", qty: 4, itemCode: "ITM-GS-0014" },
      BACKUP_KEY,
    ],
  },
  // 소요는 확정됐는데 발주가 없는 작업
  {
    code: "26PNQ-S18-10",
    rev: "Rev.A",
    name: "S18 OP10 조립도",
    vehicle: "미창 PNQ 88512-XA020",
    projectCode: "26PNQ-S18 OP10",
    excel: true,
    author: "설계 외주",
    updated: "2026-07-06",
    status: "승인",
    change: "최초 등록",
    requester: "고객사(미창)",
    bom: [
      { item: "GUIDE PIN", spec: "SGPH", size: "20-120", qty: 16, itemCode: "ITM-GP-0007" },
      { item: "WEAR PLATE", spec: "STW", size: "28-100", qty: 20, itemCode: "ITM-WP-0004" },
      { item: "GAS SPRING", spec: "MH", size: "1500", qty: 30, itemCode: "ITM-GS-0021" },
    ],
  },
];
