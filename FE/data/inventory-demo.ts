import type { DocRules, Item, ItemStandard, Movement, PurchaseOrder, SafetyStandard, Vendor } from "./inventory";

/**
 * 재고·물류 데모 데이터 — 옛 `data/pages/inventory.ts` · `data/receiving.ts` 의 표를 새 모델로 옮긴 것.
 * BE(`/api/workspace/inventory/*`)가 없을 때 dev 에서만 폴백으로 쓴다(`lib/inventory-api.ts`).
 *
 * 날짜는 고정이다. 기한 넘김 · 경과일이 오늘에 따라 흔들리지 않게 폴백 모드의 「오늘」도 고정한다.
 */
export const DEMO_TODAY = "2026-07-08";

export const VENDORS: Vendor[] = [
  { id: "v-powertec", name: "POWERTEC", kind: "parts", initial: "PT", leadTimeDays: 5, owner: "구매 담당", active: true },
  { id: "v-jinyang", name: "JINYANG", kind: "outsourcing", initial: "JY", leadTimeDays: 7, owner: "구매 담당", active: true },
  { id: "v-daesung", name: "대성정공", kind: "parts", initial: "DS", leadTimeDays: 5, owner: "구매 담당", active: true },
  { id: "v-kgs", name: "한국가스스프링", kind: "parts", initial: "KG", leadTimeDays: 10, owner: "공구실 담당", active: true },
  { id: "v-mirae", name: "미래베어링", kind: "parts", initial: "MB", leadTimeDays: 3, owner: "구매 담당", active: true },
  // 품목 수정 팝업의 「만들기」로 생긴 거래처 — 리드타임이 비어 있어 기한 넘김을 판단하지 않는다
  { id: "v-sinsung", name: "신성금속", kind: "material", initial: "SS", leadTimeDays: null, owner: "구매 담당", active: true },
  { id: "v-hanil", name: "한일스프링", kind: "parts", initial: "HI", leadTimeDays: 7, owner: "구매 담당", active: false },
  { id: "v-inhouse", name: "자체 제작", kind: "inhouse", initial: "", leadTimeDays: null, owner: "생산 담당", active: true },
];

export const ITEMS: Item[] = [
  { code: "ITM-GS-0014", name: "GAS SPRING", spec: "PX", size: "1500-80-MH", unit: "EA", category: "금형 부품", vendorIds: ["v-kgs"], location: "공구실 A-1", discontinued: false },
  { code: "ITM-GS-0015", name: "GAS SPRING", spec: "PX", size: "500-100-MH", unit: "EA", category: "금형 부품", vendorIds: ["v-kgs"], location: "공구실 A-1", discontinued: false },
  { code: "ITM-GS-0016", name: "GAS SPRING", spec: "PX", size: "2400-80", unit: "EA", category: "금형 부품", vendorIds: ["v-kgs"], location: "공구실 A-2", discontinued: false },
  { code: "ITM-GS-0021", name: "GAS SPRING", spec: "MH", size: "1500", unit: "EA", category: "금형 부품", vendorIds: ["v-kgs", "v-hanil"], location: "공구실 A-1", discontinued: false },
  { code: "ITM-GS-0022", name: "GAS SPRING", spec: "MH", size: "2500", unit: "EA", category: "금형 부품", vendorIds: ["v-kgs"], location: "공구실 A-2", discontinued: false },
  { code: "ITM-WP-0003", name: "WEAR PLATE", spec: "STW", size: "38-100", unit: "EA", category: "금형 부품", vendorIds: ["v-daesung", "v-powertec"], location: "공구실 B-2", discontinued: false },
  { code: "ITM-WP-0004", name: "WEAR PLATE", spec: "STW", size: "28-100", unit: "EA", category: "금형 부품", vendorIds: ["v-daesung"], location: "공구실 B-2", discontinued: false },
  { code: "ITM-GP-0007", name: "GUIDE PIN", spec: "SGPH", size: "20-120", unit: "EA", category: "금형 부품", vendorIds: ["v-daesung"], location: "공구실 B-1", discontinued: false },
  { code: "ITM-GB-0004", name: "GUIDE BUSH", spec: "SGBT", size: "25-25", unit: "EA", category: "금형 부품", vendorIds: ["v-daesung"], location: "공구실 B-1", discontinued: false },
  { code: "ITM-SP-0001", name: "SPRING (D25이상)", spec: "SWF", size: "12-50", unit: "EA", category: "금형 부품", vendorIds: ["v-powertec"], location: "공구실 C-1", discontinued: false },
  { code: "ITM-GP-0032", name: "GUIDE POST", spec: "MYKP", size: "Φ32-140L", unit: "EA", category: "금형 부품", vendorIds: ["v-powertec"], location: "공구실 A-3", discontinued: false },
  { code: "ITM-LP-0011", name: "LIFT PIN", spec: "LP", size: "10-58", unit: "EA", category: "금형 부품", vendorIds: ["v-powertec"], location: "공구실 C-2", discontinued: false },
  { code: "ITM-GA-0005", name: "GAUGE", spec: "HMD", size: "20*65*35t", unit: "EA", category: "가공품", vendorIds: ["v-jinyang", "v-inhouse"], location: "검사실", discontinued: false },
  { code: "PRT-BRG-608", name: "베어링 608ZZ", spec: "NSK", size: "8×22×7", unit: "EA", category: "표준 부품", vendorIds: ["v-mirae"], location: "자재창고 R-2", discontinued: false },
  { code: "MAT-AL-6061", name: "알루미늄 합금 6061", spec: "T6", size: "20mm", unit: "kg", category: "소재", vendorIds: ["v-sinsung"], location: "자재창고 R-1", discontinued: false },
  { code: "ITM-ER-0009", name: "END RETAINER", spec: "DP-AN", size: "16", unit: "EA", category: "금형 부품", vendorIds: ["v-daesung"], location: "공구실 D-1", discontinued: true },
];

export const ORDERS: PurchaseOrder[] = [
  {
    poNo: "PO-2607-0021",
    orderedOn: "2026-07-02",
    vendorId: "v-powertec",
    projectCode: "26MSX-S03 OP20",
    drawing: "26MSX-S03-20",
    rev: "Rev.C",
    requester: "구매 담당",
    lines: [
      { no: "30", itemCode: "ITM-GP-0032", nameAtOrder: "GUIDE POST", specAtOrder: "MYKP", sizeAtOrder: "Φ32-140L", ordered: 4, received: 4, judgement: "pass", note: "" },
      // 품목 마스터 이름은 「SPRING (D25이상)」 — 발주 시점 표기가 그대로 남는다
      { no: "31", itemCode: "ITM-SP-0001", nameAtOrder: "SPRING-LIFT", specAtOrder: "SWF", sizeAtOrder: "12-50", ordered: 3, received: 2, judgement: "pass", note: "1 EA 미입고 — 업체 취합 대기" },
      { no: "32", itemCode: "ITM-LP-0011", nameAtOrder: "LIFT PIN", specAtOrder: "LP", sizeAtOrder: "10-58", ordered: 3, received: 0, judgement: null, note: "" },
    ],
  },
  {
    poNo: "PO-2607-0022",
    orderedOn: "2026-07-02",
    vendorId: "v-jinyang",
    projectCode: "26MSX-S03 OP20",
    drawing: "26MSX-S03-20",
    rev: "Rev.C",
    requester: "구매 담당",
    lines: [{ no: "13", itemCode: "ITM-GA-0005", nameAtOrder: "GAUGE", specAtOrder: "HMD", sizeAtOrder: "20*65*35t", ordered: 7, received: 7, judgement: "pass", note: "DETAIL 가공분" }],
  },
  {
    poNo: "PO-2607-0023",
    orderedOn: "2026-07-05",
    vendorId: "v-powertec",
    projectCode: "26MSX-S04 OP20",
    drawing: "26MSX-S04-20",
    rev: "Rev.B",
    requester: "구매 담당",
    lines: [
      { no: "30", itemCode: "ITM-GP-0032", nameAtOrder: "GUIDE POST", specAtOrder: "MYKP", sizeAtOrder: "Φ32-140L", ordered: 4, received: 0, judgement: null, note: "" },
      { no: "31", itemCode: "ITM-SP-0001", nameAtOrder: "SPRING-LIFT", specAtOrder: "SWF", sizeAtOrder: "12-50", ordered: 3, received: 0, judgement: null, note: "" },
      { no: "32", itemCode: "ITM-LP-0011", nameAtOrder: "LIFT PIN", specAtOrder: "LP", sizeAtOrder: "10-58", ordered: 3, received: 0, judgement: null, note: "" },
    ],
  },
  {
    poNo: "PO-2607-0024",
    orderedOn: "2026-07-02",
    vendorId: "v-jinyang",
    projectCode: "26MSX-S04 OP20",
    drawing: "26MSX-S04-20",
    rev: "Rev.B",
    requester: "구매 담당",
    lines: [{ no: "13", itemCode: "ITM-GA-0005", nameAtOrder: "GAUGE", specAtOrder: "HMD", sizeAtOrder: "20*65*35t", ordered: 7, received: 4, judgement: "pass", note: "트럭 적재 중량 제한 — 3 EA 분할 입고 예정" }],
  },
  {
    poNo: "PO-2607-0025",
    orderedOn: "2026-07-06",
    vendorId: "v-sinsung",
    projectCode: "26PNQ-S17 OP20",
    drawing: "26PNQ-S17-20",
    rev: "Rev.A",
    requester: "구매 담당",
    lines: [{ no: "01", itemCode: "MAT-AL-6061", nameAtOrder: "알루미늄 합금 6061", specAtOrder: "T6", sizeAtOrder: "20mm", ordered: 600, received: 0, judgement: null, note: "" }],
  },
  {
    poNo: "PO-2606-0018",
    orderedOn: "2026-06-30",
    vendorId: "v-daesung",
    projectCode: "26PNQ-S16 OP10",
    drawing: "26PNQ-S16-10",
    rev: "Rev.D",
    requester: "구매 담당",
    lines: [{ no: "21", itemCode: "ITM-GP-0007", nameAtOrder: "GUIDE PIN", specAtOrder: "SGPH", sizeAtOrder: "20-120", ordered: 8, received: 8, judgement: "pass", note: "" }],
  },
];

/** 기초 재고 기준일. 이날 이후의 이력만 재고 계산에 들어간다 */
const AS_OF = "2026-06-01";

export const STANDARDS: ItemStandard[] = [
  { itemCode: "ITM-GS-0014", baseline: 2, asOf: AS_OF, safety: null },
  { itemCode: "ITM-GS-0015", baseline: 0, asOf: AS_OF, safety: null },
  { itemCode: "ITM-GS-0016", baseline: 0, asOf: AS_OF, safety: null },
  { itemCode: "ITM-GS-0021", baseline: 29, asOf: AS_OF, safety: 29 },
  { itemCode: "ITM-GS-0022", baseline: 33, asOf: AS_OF, safety: 30 },
  { itemCode: "ITM-WP-0003", baseline: 7, asOf: AS_OF, safety: 12 },
  { itemCode: "ITM-WP-0004", baseline: 16, asOf: AS_OF, safety: null },
  { itemCode: "ITM-GP-0007", baseline: 4, asOf: AS_OF, safety: 10 },
  { itemCode: "ITM-GB-0004", baseline: 6, asOf: AS_OF, safety: 0 },
  { itemCode: "ITM-SP-0001", baseline: 1, asOf: AS_OF, safety: null },
  { itemCode: "ITM-GP-0032", baseline: 0, asOf: AS_OF, safety: null },
  { itemCode: "ITM-LP-0011", baseline: 0, asOf: AS_OF, safety: null },
  { itemCode: "ITM-GA-0005", baseline: 0, asOf: AS_OF, safety: null },
  { itemCode: "PRT-BRG-608", baseline: 8240, asOf: AS_OF, safety: 10000 },
  { itemCode: "MAT-AL-6061", baseline: 3420, asOf: AS_OF, safety: 4000 },
  { itemCode: "ITM-ER-0009", baseline: 3, asOf: AS_OF, safety: null },
];

export const MOVEMENTS: Movement[] = [
  { id: "m-0101", at: "2026-07-03T10:20", itemCode: "ITM-GP-0032", kind: "in", qty: 4, actor: "검사 담당", ref: "26MSX-S03 OP20", note: "", poNo: "PO-2607-0021", judgement: "pass" },
  { id: "m-0102", at: "2026-07-03T10:20", itemCode: "ITM-SP-0001", kind: "in", qty: 2, actor: "검사 담당", ref: "26MSX-S03 OP20", note: "1 EA 미입고 — 업체 취합 대기", poNo: "PO-2607-0021", judgement: "pass" },
  { id: "m-0103", at: "2026-07-04T15:40", itemCode: "ITM-GA-0005", kind: "in", qty: 7, actor: "검사 담당", ref: "26MSX-S03 OP20", note: "DETAIL 가공분", poNo: "PO-2607-0022", judgement: "pass" },
  { id: "m-0104", at: "2026-07-06T09:10", itemCode: "ITM-GA-0005", kind: "in", qty: 4, actor: "검사 담당", ref: "26MSX-S04 OP20", note: "트럭 적재 중량 제한 — 3 EA 분할 입고 예정", poNo: "PO-2607-0024", judgement: "pass" },
  { id: "m-0095", at: "2026-06-30T14:20", itemCode: "ITM-GP-0007", kind: "in", qty: 8, actor: "구매 담당", ref: "26PNQ-S16 OP10", note: "", poNo: "PO-2606-0018", judgement: "pass" },
  { id: "m-0094", at: "2026-06-30T14:05", itemCode: "ITM-WP-0003", kind: "in", qty: 4, actor: "구매 담당", ref: "26PNQ-S16 OP10", note: "", judgement: "pass" },
  { id: "m-0093", at: "2026-06-30T11:40", itemCode: "ITM-GS-0015", kind: "in", qty: 4, actor: "구매 담당", ref: "26PNQ-S17 OP20", note: "", judgement: "pass" },
  { id: "m-0092", at: "2026-06-29T16:10", itemCode: "ITM-GS-0022", kind: "in", qty: 2, actor: "공구실 담당", ref: "26MSX-S03 OP20", note: "", judgement: "pass" },
  { id: "m-0091", at: "2026-06-29T15:30", itemCode: "ITM-GS-0021", kind: "out", qty: -2, actor: "공구실 담당", ref: "26MSX-S03 OP20", note: "" },
  { id: "m-0090", at: "2026-06-29T15:05", itemCode: "ITM-GS-0014", kind: "out", qty: -1, actor: "공구실 담당", ref: "26MSX-S03 OP20", note: "" },
  { id: "m-0089", at: "2026-06-29T10:00", itemCode: "ITM-GS-0016", kind: "in", qty: 1, actor: "구매 담당", ref: "26MSX-S04 OP20", note: "", judgement: "pass" },
  { id: "m-0088", at: "2026-06-25T09:00", itemCode: "ITM-WP-0004", kind: "adjust", qty: -1, actor: "공구실 담당", ref: "실사 차이 반영", note: "" },
];

export const SAFETY_STANDARD: SafetyStandard = { method: "manual", avgWindowDays: 30 };

export const DOC_RULES: DocRules = {
  // 26MSX-S03 OP20 — 거래처 이니셜은 조각 후보에는 있으나 기본 순서에는 없다
  codeSegments: ["year", "model", "team", "seq"],
  separators: { beforeTeam: "-", beforeOp: " " },
  formats: {
    material: ["품명", "규격", "수량", "비고"],
    parts: ["품명", "호칭", "규격", "수량", "비고"],
  },
  processTags: ["열처리", "연마", "도금", "방전"],
};
