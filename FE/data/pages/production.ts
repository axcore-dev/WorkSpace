import { CHART } from "@/lib/palette";
import type { ModulePageData } from "../types";

/** 생산관리 모듈 화면 데이터 — 상세 페이지 구성 + 행 클릭 상세 */
export const PAGE: ModulePageData = {
    stats: [
      { label: "금일 생산 실적", value: "12,480 EA", delta: "+4.2%", deltaTone: "green", sub: "계획 대비 96.8%" },
      { label: "가동 중 설비", value: "18 / 21대", sub: "정지 2 · 정비 1" },
      { label: "진행 중 작업지시", value: "9건", sub: "지연 1건 포함" },
      { label: "평균 사이클 타임", value: "42.5초", delta: "-1.8초", deltaTone: "green", sub: "전주 대비" },
    ],
    tabs: [
      {
        id: "monitoring",
        label: "모니터링",
        actions: ["export"],
        chart: {
          type: "line",
          title: "시간대별 생산량 (계획 vs 실적)",
          labels: ["08시", "10시", "12시", "14시", "16시", "18시", "20시"],
          series: [
            { name: "계획", color: CHART.neutral, values: [1800, 1800, 1200, 1800, 1800, 1800, 1600] },
            { name: "실적", color: CHART.primary, values: [1740, 1815, 1180, 1752, 1691, 1788, 1514] },
          ],
        },
        table: {
          columns: ["라인", "품목", "계획", "실적", "달성률", "설비 상태"],
          rows: [
            ["CNC 1라인", "정밀 샤프트 Ø12", "4,200", "4,116", "98.0%", { badge: "가동", tone: "green" }],
            ["CNC 2라인", "하우징 케이스", "3,600", "3,371", "93.6%", { badge: "가동", tone: "green" }],
            ["프레스 1라인", "브래킷", "3,000", "3,048", "101.6%", { badge: "가동", tone: "green" }],
            ["프레스 2라인", "플랜지 커플링", "1,800", "1,527", "84.8%", { badge: "일시 정지", tone: "amber" }],
            ["조립 라인", "샤프트 어셈블리", "1,400", "418", "29.9%", { badge: "정비 중", tone: "red" }],
          ],
        },
      },
      {
        id: "workorders",
        label: "작업지시",
        actions: ["filter", "create"],
        table: {
          columns: ["지시번호", "품목", "수량", "라인", "납기", "진척", "상태"],
          rows: [
            ["WO-2607-021", "정밀 샤프트 Ø12", "8,000", "CNC 1라인", "2026-07-04", "51%", { badge: "진행중", tone: "blue" }],
            ["WO-2607-020", "하우징 케이스", "6,500", "CNC 2라인", "2026-07-05", "38%", { badge: "진행중", tone: "blue" }],
            ["WO-2607-019", "브래킷", "12,000", "프레스 1라인", "2026-07-03", "74%", { badge: "진행중", tone: "blue" }],
            ["WO-2607-018", "플랜지 커플링", "4,000", "프레스 2라인", "2026-07-03", "42%", { badge: "지연", tone: "red" }],
            ["WO-2607-015", "감속 기어", "2,400", "CNC 3라인", "2026-07-02", "100%", { badge: "완료", tone: "green" }],
          ],
        },
      },
      {
        id: "bottleneck",
        label: "공정병목 분석",
        actions: ["export"],
        chart: {
          type: "bar",
          title: "공정별 평균 대기시간 (분)",
          valueUnit: "분",
          labels: ["원자재 투입", "CNC 가공", "열처리", "연마", "검사", "포장"],
          series: [
            { name: "평균 대기시간", color: CHART.primary, values: [4, 12, 38, 9, 21, 6] },
          ],
        },
        table: {
          columns: ["병목 구간", "원인 분석", "영향", "개선 우선순위"],
          rows: [
            ["열처리 공정", "외주 열처리 배치 대기 (일 2회 수거)", "리드타임 +0.8일", { badge: "1순위", tone: "red" }],
            ["검사 공정", "치수 검사 수작업 비중 65%", "처리량 -18%", { badge: "2순위", tone: "amber" }],
            ["CNC 가공", "야간 무인 가동률 71%", "가동률 손실 6%", { badge: "3순위", tone: "slate" }],
          ],
        },
      },
      {
        id: "reporting",
        label: "보고 자동화",
        ai: true,
        custom: "report-automation",
      },
    ],
  };
