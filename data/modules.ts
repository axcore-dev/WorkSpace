import type { ModuleDef } from "./types";

/**
 * 자사 8대 핵심 모듈 카탈로그 (더미 데이터).
 * 추후 실제 API 연동 시 이 파일만 교체한다.
 */
export const MODULES: ModuleDef[] = [
  {
    slug: "management",
    name: "경영지원",
    icon: "briefcase",
    summary: "인사·급여·자재·회계·구매",
    action: "인사·급여부터 회계·구매까지, 경영 업무를 한 곳에서 관리할 수 있어요.",
    externalSystem: "ERP",
    subfunctions: [
      { id: "hr", name: "인사 관리" },
      { id: "payroll", name: "급여 관리" },
      { id: "materials", name: "자재 관리" },
      { id: "accounting", name: "회계 관리" },
      { id: "purchasing", name: "구매 관리" },
    ],
  },
  {
    slug: "design",
    name: "제품설계",
    icon: "compass",
    summary: "도면·설계·BOM 관리",
    action: "도면과 BOM, 설계 변경 이력을 버전별로 관리할 수 있어요.",
    externalSystem: "PLM",
    subfunctions: [
      { id: "drawings", name: "도면 관리" },
      { id: "specs", name: "설계 관리" },
      { id: "bom", name: "BOM 관리" },
    ],
  },
  {
    slug: "production",
    name: "생산관리",
    icon: "factory",
    summary: "모니터링·작업지시·공정병목",
    action: "생산 현황을 실시간으로 보고 작업지시와 병목을 관리할 수 있어요.",
    externalSystem: "MES",
    subfunctions: [
      { id: "monitoring", name: "모니터링" },
      { id: "workorders", name: "작업지시" },
      { id: "bottleneck", name: "공정병목 분석" },
      { id: "reporting", name: "보고 자동화", ai: true },
    ],
  },
  {
    slug: "equipment",
    name: "장비관리",
    icon: "wrench",
    summary: "정비 예측(AI)·정비 관리",
    action: "센서로 설비 고장을 미리 예측하고 정비 일정을 잡을 수 있어요.",
    externalSystem: "설비 예지보전(PdM)",
    subfunctions: [
      { id: "predict", name: "정비 예측", ai: true },
      { id: "maintenance", name: "정비 관리" },
    ],
  },
  {
    slug: "quality",
    name: "품질검사",
    icon: "clipboardCheck",
    summary: "불량 분석·품질 관리",
    action: "불량 원인을 분석하고 검사 결과를 기록·관리할 수 있어요.",
    externalSystem: "QMS",
    subfunctions: [
      { id: "defects", name: "불량 분석" },
      { id: "control", name: "품질 관리" },
    ],
  },
  {
    slug: "inventory",
    name: "재고·물류",
    icon: "truck",
    summary: "현재·안전 재고·입출고 검수",
    action: "재고와 안전재고를 실시간으로 확인하고 입출고를 검수할 수 있어요.",
    externalSystem: "WMS",
    subfunctions: [
      { id: "stock", name: "현재 재고" },
      { id: "safety", name: "안전 재고" },
      { id: "receiving", name: "입출고 검수" },
    ],
  },
  {
    slug: "sales",
    name: "영업관리",
    icon: "trendingUp",
    summary: "수주·수요 예측(AI)·단가 견적",
    action: "수주부터 수요 예측, 단가 견적까지 영업 흐름을 관리할 수 있어요.",
    externalSystem: "CRM",
    subfunctions: [
      { id: "orders", name: "수주 관리" },
      { id: "forecast", name: "수요 예측", ai: true },
      { id: "quotes", name: "단가 견적" },
    ],
  },
  {
    slug: "support",
    name: "고객지원",
    icon: "headset",
    summary: "AS 접수·AS 트래킹·VOC 분석",
    action: "AS 접수부터 처리 추적, VOC 분석까지 고객 대응을 관리할 수 있어요.",
    externalSystem: "CS 시스템",
    subfunctions: [
      { id: "tickets", name: "AS 접수" },
      { id: "tracking", name: "AS 트래킹" },
      { id: "voc", name: "VOC 분석" },
    ],
  },
];

export const MODULE_BY_SLUG = Object.fromEntries(MODULES.map((m) => [m.slug, m]));

/** 온보딩 위저드에서 선택 가능한 외부 시스템 → 중복 모듈 매핑 */
export const EXTERNAL_SYSTEMS: {
  id: string;
  name: string;
  desc: string;
  duplicatesModule: string; // MODULES.slug
}[] = [
  { id: "erp", name: "ERP", desc: "전사적 자원 관리", duplicatesModule: "management" },
  { id: "mes", name: "MES", desc: "생산 실행 시스템", duplicatesModule: "production" },
  { id: "plm", name: "PLM", desc: "제품 수명주기 관리", duplicatesModule: "design" },
  { id: "qms", name: "QMS", desc: "품질 경영 시스템", duplicatesModule: "quality" },
  { id: "wms", name: "WMS", desc: "창고 관리 시스템", duplicatesModule: "inventory" },
  { id: "crm", name: "CRM", desc: "고객 관계 관리", duplicatesModule: "sales" },
  { id: "cs", name: "CS 시스템", desc: "고객 지원/AS 관리", duplicatesModule: "support" },
  { id: "pdm", name: "설비 예지보전", desc: "PdM 솔루션", duplicatesModule: "equipment" },
];
