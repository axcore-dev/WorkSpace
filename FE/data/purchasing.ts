/**
 * 도면(BOM) 데모 — 발주서 작성의 소요 근거. 제품설계 모듈이 완성되면 그쪽 데이터로 바뀐다.
 * 발주 목록 자체는 `data/inventory.ts`(PurchaseOrder) 로 옮겨졌다.
 */

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
  // 소요는 확정됐는데 발주가 없는 작업 — 발주·입고 탭 아래 「발주 전」 줄에 뜬다
  {
    code: "26PNQ-S18-10",
    name: "S18 OP10 조립도",
    rev: "Rev.A",
    projectCode: "26PNQ-S18 OP10",
    vehicle: "미창 PNQ 88512-XA020",
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
  "26PNQ-S18-10": [
    { itemName: "GUIDE PIN", spec: "SGPH", size: "20-120", need: 16, stock: 12, supplier: "대성정공" },
    { itemName: "WEAR PLATE", spec: "STW", size: "28-100", need: 20, stock: 15, supplier: "대성정공" },
    { itemName: "GAS SPRING", spec: "MH", size: "1500", need: 30, stock: 27, supplier: "한국가스스프링" },
  ],
};
