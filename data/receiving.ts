/**
 * 재고·물류 > 입고·수입검사 더미 데이터 (FR-IV-07~14).
 * 검수는 대장이 아니라 라인 단위로 저장한다 — 각 라인이 관리번호·발주처·품목·발주/입고 수량을 모두 가진다.
 */

/** 검수 라인 — 규격은 요소별로 나눠 표기한다 (FR-IV-11) */
export interface InspectionLine {
  no: string;
  item: string;
  /** 사양(호칭) */
  spec: string;
  /** 규격 요소 — 예: ["Φ32", "140L"] */
  size: string[];
  ordered: number;
  received: number;
  note: string;
}

/** 발주처 × 납품 건 = 검수 카드 한 장 */
export interface ReceiptCard {
  id: string;
  orderedOn: string;
  projectCode: string;
  vehicle: string;
  supplier: string;
  poNo: string;
  drawing: string;
  rev: string;
  inspector: string;
  lines: InspectionLine[];
}

export const RECEIPTS: ReceiptCard[] = [
  {
    id: "GR-2607-012",
    orderedOn: "2026-07-02",
    projectCode: "26MSX-S03 OP20",
    vehicle: "미창 SX3e 88528-XD010",
    supplier: "POWERTEC",
    poNo: "PO-2607-0021",
    drawing: "26MSX-S03-20",
    rev: "Rev.C",
    inspector: "검사 담당",
    lines: [
      { no: "30", item: "GUIDE POST", spec: "MYKP", size: ["Φ32", "140L"], ordered: 4, received: 4, note: "" },
      { no: "31", item: "SPRING-LIFT", spec: "SWF", size: ["12", "50"], ordered: 3, received: 2, note: "1 EA 미입고 — 업체 취합 대기" },
      { no: "32", item: "LIFT PIN", spec: "LP", size: ["10", "58"], ordered: 3, received: 0, note: "미입고" },
    ],
  },
  {
    id: "GR-2607-013",
    orderedOn: "2026-07-02",
    projectCode: "26MSX-S03 OP20",
    vehicle: "미창 SX3e 88528-XD010",
    supplier: "JINYANG",
    poNo: "PO-2607-0022",
    drawing: "26MSX-S03-20",
    rev: "Rev.C",
    inspector: "검사 담당",
    lines: [
      { no: "13", item: "GAUGE", spec: "HMD", size: ["20*65", "35t"], ordered: 7, received: 7, note: "DETAIL 가공분" },
    ],
  },
  {
    id: "GR-2607-014",
    orderedOn: "2026-07-02",
    projectCode: "26MSX-S04 OP20",
    vehicle: "미창 SX3e 88628-XD010",
    supplier: "POWERTEC",
    poNo: "PO-2607-0023",
    drawing: "26MSX-S04-20",
    rev: "Rev.B",
    inspector: "검사 담당",
    lines: [
      { no: "30", item: "GUIDE POST", spec: "MYKP", size: ["Φ32", "140L"], ordered: 4, received: 0, note: "" },
      { no: "31", item: "SPRING-LIFT", spec: "SWF", size: ["12", "50"], ordered: 3, received: 0, note: "" },
      { no: "32", item: "LIFT PIN", spec: "LP", size: ["10", "58"], ordered: 3, received: 0, note: "" },
    ],
  },
  {
    id: "GR-2607-015",
    orderedOn: "2026-07-02",
    projectCode: "26MSX-S04 OP20",
    vehicle: "미창 SX3e 88628-XD010",
    supplier: "JINYANG",
    poNo: "PO-2607-0024",
    drawing: "26MSX-S04-20",
    rev: "Rev.B",
    inspector: "검사 담당",
    lines: [
      {
        no: "13",
        item: "GAUGE",
        spec: "HMD",
        size: ["20*65", "35t"],
        ordered: 7,
        received: 4,
        note: "트럭 적재 중량 제한 — 3 EA 분할 입고 예정",
      },
    ],
  },
  {
    id: "GR-2606-031",
    orderedOn: "2026-06-30",
    projectCode: "26PNQ-S16 OP10",
    vehicle: "미창 PNQ 88512-XA010",
    supplier: "대성정공",
    poNo: "PO-2606-0018",
    drawing: "26PNQ-S16-10",
    rev: "Rev.D",
    inspector: "검사 담당",
    lines: [
      { no: "21", item: "GUIDE PIN", spec: "SGPH", size: ["20", "120"], ordered: 8, received: 8, note: "" },
    ],
  },
];
