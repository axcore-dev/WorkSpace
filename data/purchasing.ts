/**
 * 재고·물류 > 구매(발주) 관리 더미 데이터 (FR-PO-01~10).
 * 실제 API 연동 시 이 파일만 교체한다.
 */

export type PoStatus = "발주" | "부분 입고" | "입고 완료" | "지연";

export interface PoLine {
  itemName: string;
  spec: string;
  size: string;
  qty: number;
}

/** 발주 목록 한 건 — 발주처 단위로 채번되며 이후 입고·검수가 이 번호로 연결된다 */
export interface PurchaseOrderRow {
  poNo: string;
  orderedOn: string;
  supplier: string;
  /** 귀속 관리번호 */
  projectCode: string;
  /** 근거 도면 + 리비전 (FR-PO-09) */
  drawing: string;
  rev: string;
  requester: string;
  status: PoStatus;
  lines: PoLine[];
}

/** [Step.1] 발주 대상으로 고를 수 있는 도면(BOM). unmapped > 0 이면 진행 차단 (FR-BM-03) */
export interface PoDrawing {
  code: string;
  name: string;
  rev: string;
  projectCode: string;
  vehicle: string;
  unmapped: number;
}

/** [Step.2] 도면별 BOM 소요량과 현재 재고 */
export interface PoNeed {
  itemName: string;
  spec: string;
  size: string;
  need: number;
  stock: number;
  supplier: string;
}

export const PURCHASE_ORDERS: PurchaseOrderRow[] = [
  {
    poNo: "PO-2607-0021",
    orderedOn: "2026-07-02",
    supplier: "POWERTEC",
    projectCode: "26MSX-S03 OP20",
    drawing: "26MSX-S03-20",
    rev: "Rev.C",
    requester: "구매 담당",
    status: "부분 입고",
    lines: [
      { itemName: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", qty: 4 },
      { itemName: "SPRING-LIFT", spec: "SWF", size: "12-50", qty: 3 },
      { itemName: "LIFT PIN", spec: "LP", size: "10-58", qty: 3 },
    ],
  },
  {
    poNo: "PO-2607-0022",
    orderedOn: "2026-07-02",
    supplier: "JINYANG",
    projectCode: "26MSX-S03 OP20",
    drawing: "26MSX-S03-20",
    rev: "Rev.C",
    requester: "구매 담당",
    status: "입고 완료",
    lines: [{ itemName: "GAUGE", spec: "HMD", size: "20*65*35t", qty: 7 }],
  },
  {
    poNo: "PO-2607-0023",
    orderedOn: "2026-07-02",
    supplier: "POWERTEC",
    projectCode: "26MSX-S04 OP20",
    drawing: "26MSX-S04-20",
    rev: "Rev.B",
    requester: "구매 담당",
    status: "발주",
    lines: [
      { itemName: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", qty: 4 },
      { itemName: "SPRING-LIFT", spec: "SWF", size: "12-50", qty: 3 },
      { itemName: "LIFT PIN", spec: "LP", size: "10-58", qty: 3 },
    ],
  },
  {
    poNo: "PO-2607-0024",
    orderedOn: "2026-07-02",
    supplier: "JINYANG",
    projectCode: "26MSX-S04 OP20",
    drawing: "26MSX-S04-20",
    rev: "Rev.B",
    requester: "구매 담당",
    status: "부분 입고",
    lines: [{ itemName: "GAUGE", spec: "HMD", size: "20*65*35t", qty: 7 }],
  },
  {
    poNo: "PO-2606-0018",
    orderedOn: "2026-06-30",
    supplier: "대성정공",
    projectCode: "26PNQ-S16 OP10",
    drawing: "26PNQ-S16-10",
    rev: "Rev.D",
    requester: "구매 담당",
    status: "입고 완료",
    lines: [{ itemName: "GUIDE PIN", spec: "SGPH", size: "20-120", qty: 8 }],
  },
];

export const PO_DRAWINGS: PoDrawing[] = [
  {
    code: "26MSX-S03-20",
    name: "S03 OP20 (FO) LH 조립도",
    rev: "Rev.C",
    projectCode: "26MSX-S03 OP20",
    vehicle: "미창 SX3e 88528-XD010",
    unmapped: 2,
  },
  {
    code: "26MSX-S04-20",
    name: "S04 OP20 (FO) RH 조립도",
    rev: "Rev.B",
    projectCode: "26MSX-S04 OP20",
    vehicle: "미창 SX3e 88628-XD010",
    unmapped: 0,
  },
  {
    code: "26PNQ-S16-10",
    name: "S16 OP10 조립도",
    rev: "Rev.D",
    projectCode: "26PNQ-S16 OP10",
    vehicle: "미창 PNQ 88512-XA010",
    unmapped: 0,
  },
];

export const PO_BOM: Record<string, PoNeed[]> = {
  "26MSX-S03-20": [
    { itemName: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", need: 4, stock: 0, supplier: "POWERTEC" },
    { itemName: "SPRING-LIFT", spec: "SWF", size: "12-50", need: 3, stock: 0, supplier: "POWERTEC" },
    { itemName: "LIFT PIN", spec: "LP", size: "10-58", need: 3, stock: 0, supplier: "POWERTEC" },
    { itemName: "GAUGE", spec: "HMD", size: "20*65*35t", need: 7, stock: 0, supplier: "JINYANG" },
  ],
  "26MSX-S04-20": [
    { itemName: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", need: 4, stock: 0, supplier: "POWERTEC" },
    { itemName: "SPRING-LIFT", spec: "SWF", size: "12-50", need: 3, stock: 1, supplier: "POWERTEC" },
    { itemName: "LIFT PIN", spec: "LP", size: "10-58", need: 3, stock: 0, supplier: "POWERTEC" },
    { itemName: "GAUGE", spec: "HMD", size: "20*65*35t", need: 7, stock: 0, supplier: "JINYANG" },
  ],
  "26PNQ-S16-10": [
    { itemName: "GUIDE PIN", spec: "SGPH", size: "20-120", need: 16, stock: 12, supplier: "대성정공" },
    { itemName: "WEAR PLATE", spec: "STW", size: "38-100", need: 14, stock: 11, supplier: "대성정공" },
    { itemName: "GAS SPRING", spec: "PX", size: "1500-80-MH", need: 4, stock: 1, supplier: "한국가스스프링" },
  ],
};
