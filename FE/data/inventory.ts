/**
 * 재고·물류 데이터 모델 (스펙 `docs/superpowers/specs/2026-09-11-inventory-renewal-design.md` 「데이터 모델」).
 *
 * - 발주 라인이 입고·판정을 직접 갖는다 — 검수 카드(`ReceiptCard`)는 없다.
 * - 재고는 저장하지 않는다. `기초(asOf) + Σ 이력(asOf 이후)` 로 파생한다(`lib/inventory-state.ts` `stockOf`).
 * - 발주 라인은 발주 시점 표기 스냅샷(`nameAtOrder` …)을 갖는다 — 출력한 발주서와 화면이 어긋나면 안 된다.
 */

/** 서브기능 id — `data/modules.ts` inventory.subfunctions 와 같다. 권한(`me.permissions.tabs`)·기능 on/off 의 키 */
export type InventorySub = "purchasing" | "receiving" | "movements" | "stock" | "items" | "vendors" | "safety" | "docrules";

export type VendorKind = "parts" | "material" | "outsourcing" | "inhouse";

export interface Vendor {
  id: string;
  name: string;
  kind: VendorKind;
  /** 관리번호 조각으로 쓰는 이니셜. 자체 제작은 빈 문자열 */
  initial: string;
  /** 발주 → 입고까지 기대 일수. 「만들기」로 만든 거래처는 null — 기한 넘김 판단을 하지 않는다 */
  leadTimeDays: number | null;
  owner: string;
  active: boolean;
}

export interface Item {
  code: string;
  name: string;
  spec: string;
  size: string;
  unit: string;
  category: string;
  /** 여러 곳. `[0]` 이 기본 거래처 — 순서가 뜻이다 */
  vendorIds: string[];
  /** 자유 입력 한 칸. 창고·거점 개념은 없다 */
  location: string;
  discontinued: boolean;
}

export type Judgement = "pass" | "fail";

export interface PoLine {
  no: string;
  itemCode: string;
  nameAtOrder: string;
  specAtOrder: string;
  sizeAtOrder: string;
  ordered: number;
  /** 합격 입고 누계. 불합격은 세지 않는다 — 잔량이 남아 다시 받을 수 있다 */
  received: number;
  judgement: Judgement | null;
  note: string;
}

export interface PurchaseOrder {
  poNo: string;
  orderedOn: string;
  vendorId: string;
  /** 귀속 관리번호 */
  projectCode: string;
  drawing: string;
  rev: string;
  requester: string;
  lines: PoLine[];
  /** 잔량을 남긴 채 「검수 완료」로 마감한 날. 있으면 입고 완료로 본다 */
  closedOn?: string;
}

export type MovementKind = "in" | "out" | "adjust" | "baseline";

export interface Movement {
  id: string;
  /** ISO 분 단위 `2026-06-30T14:20` */
  at: string;
  itemCode: string;
  kind: MovementKind;
  /** 부호 있는 증감. `baseline` 은 새 기초 재고 값이라 합산하지 않는다 */
  qty: number;
  actor: string;
  /** 관리번호 · 발주번호 · 사유 */
  ref: string;
  note: string;
  poNo?: string;
  judgement?: Judgement;
}

export interface SafetyStandard {
  method: "leadTimeAvg" | "manual";
  avgWindowDays: number;
}

export interface ItemStandard {
  itemCode: string;
  baseline: number;
  /** 기초 재고의 기준일. 이날 이후 이력만 위에 쌓인다 */
  asOf: string;
  /** 담당자 지정 기준. null 은 미설정 */
  safety: number | null;
}

export type CodeSegment = "year" | "vendorInitial" | "model" | "team" | "seq";

export interface DocRules {
  codeSegments: CodeSegment[];
  separators: { beforeTeam: string; beforeOp: string };
  formats: { material: string[]; parts: string[] };
  processTags: string[];
}
