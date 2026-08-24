import { CHART } from "@/lib/palette";
import type { ModulePageData } from "../types";

/** 품질검사 모듈 화면 데이터 — 상세 페이지 구성 + 행 클릭 상세 */
export const PAGE: ModulePageData = {
    stats: [
      { label: "금일 불량률", value: "0.82%", delta: "-0.11%p", deltaTone: "green", sub: "목표 1.0% 이하" },
      { label: "진행 중 시정조치(CAPA)", value: "3건", sub: "기한 임박 1건" },
      { label: "검사 완료율", value: "97.4%", sub: "금일 로트 기준" },
      { label: "공정능력지수 (Cpk)", value: "1.42", delta: "+0.05", deltaTone: "green", sub: "주요 치수 평균" },
    ],
    tabs: [
      {
        id: "defects",
        label: "불량 분석",
        actions: ["export"],
        chart: {
          type: "donut",
          title: "불량 유형 분포 (최근 30일)",
          segments: [
            { name: "치수 불량", value: 38, color: CHART.primary },
            { name: "표면 흠집", value: 27, color: CHART.primary400 },
            { name: "가공 누락", value: 17, color: CHART.primary300 },
            { name: "조립 불량", value: 11, color: CHART.primary200 },
            { name: "기타", value: 7, color: CHART.muted },
          ],
        },
        table: {
          columns: ["분석번호", "품목", "불량 유형", "추정 원인 (RCA)", "시정 조치", "상태"],
          rows: [
            ["QA-2607-02", "정밀 샤프트 Ø12", "치수 불량 (외경 +0.02)", "CNC-07 스핀들 진동 증가", "장비관리 정비 예측 연계", { badge: "조치중", tone: "amber" }],
            ["QA-2607-01", "브래킷", "표면 흠집", "프레스 금형 이물", "금형 세척 주기 단축", { badge: "조치중", tone: "amber" }],
            ["QA-2606-14", "하우징 케이스", "가공 누락 (탭 미가공)", "작업지시 도면 버전 불일치", "도면 배포 프로세스 개선", { badge: "완료", tone: "green" }],
          ],
        },
      },
      {
        id: "control",
        label: "품질 관리",
        actions: ["filter", "create"],
        table: {
          columns: ["검사 로트", "품목", "검사 항목", "표본", "결과", "검사원"],
          rows: [
            ["LOT-260702-A", "정밀 샤프트 Ø12", "외경·진원도·표면조도", "50/8,000", { badge: "양호", tone: "green" }, "이수진"],
            ["LOT-260702-B", "브래킷", "치수·외관", "80/12,000", { badge: "양호", tone: "green" }, "김태리"],
            ["LOT-260701-C", "플랜지 커플링", "동심도·경도", "30/4,000", { badge: "부적합 2건", tone: "red" }, "이수진"],
            ["LOT-260701-A", "하우징 케이스", "치수·나사 게이지", "60/6,500", { badge: "양호", tone: "green" }, "박찬영"],
          ],
        },
      },
    ],
  };
