import { CHART } from "@/lib/palette";
import type { DetailRecord, ModulePageData } from "../types";

/** 영업관리 모듈 화면 데이터 — 상세 페이지 구성 + 행 클릭 상세 */
export const PAGE: ModulePageData = {
    stats: [
      { label: "이번 달 수주액", value: "22.4억원", delta: "+8.7%", deltaTone: "green", sub: "전월 대비" },
      { label: "진행 중 수주", value: "17건", sub: "납기 임박 3건" },
      { label: "견적 전환율", value: "34.2%", delta: "+2.1%p", deltaTone: "green", sub: "최근 90일" },
      { label: "8월 수요 예측", value: "31,800 EA", sub: "AI 예측 · 신뢰도 88%" },
    ],
    tabs: [
      {
        id: "orders",
        label: "수주 관리",
        actions: ["filter", "create"],
        table: {
          columns: ["수주번호", "고객사", "품목", "수량", "금액", "납기", "상태"],
          rows: [
            ["SO-2607-05", "한빛모터스", "정밀 샤프트 Ø12", "24,000EA", "8.6억원", "2026-07-18", { badge: "생산중", tone: "blue" }],
            ["SO-2607-04", "세진전자", "브래킷 어셈블리", "18,000EA", "4.2억원", "2026-07-15", { badge: "생산중", tone: "blue" }],
            ["SO-2607-03", "대륙기계", "감속 기어", "6,000EA", "3.8억원", "2026-07-25", { badge: "자재 준비", tone: "amber" }],
            ["SO-2607-02", "글로벌AT", "하우징 케이스", "12,000EA", "5.1억원", "2026-08-05", { badge: "수주 확정", tone: "green" }],
            ["SO-2606-31", "한빛모터스", "플랜지 커플링", "8,000EA", "2.4억원", "2026-07-06", { badge: "납기 임박", tone: "red" }],
          ],
        },
      },
      {
        id: "forecast",
        label: "수요 예측",
        ai: true,
        actions: ["export"],
        chart: {
          type: "line",
          title: "월별 수요 실적 및 예측 (천 EA)",
          compact: true,
          valueUnit: "천 EA",
          labels: ["3월", "4월", "5월", "6월", "7월", "8월", "9월"],
          series: [
            { name: "실적", color: CHART.primary, values: [26.4, 27.8, 28.9, 29.6, 0, 0, 0] },
            { name: "AI 예측", color: CHART.amber, values: [26.1, 27.2, 29.3, 29.9, 30.7, 31.8, 30.2] },
          ],
        },
      },
      {
        id: "quotes",
        label: "단가 견적",
        actions: ["filter", "create"],
        table: {
          columns: ["견적번호", "고객사", "품목", "산출 단가", "제출 단가", "마진", "상태"],
          rows: [
            ["QT-2607-08", "미래로보틱스", "정밀 샤프트 Ø12 변형", "2,840원", "3,400원", "16.5%", { badge: "발송", tone: "blue" }],
            ["QT-2607-07", "세진전자", "브래킷 신규 사양", "1,920원", "2,300원", "16.5%", { badge: "협의중", tone: "amber" }],
            ["QT-2607-05", "대륙기계", "감속 기어 대량", "5,610원", "6,500원", "13.7%", { badge: "수주 전환", tone: "green" }],
            ["QT-2606-22", "글로벌AT", "하우징 케이스", "3,780원", "4,250원", "11.1%", { badge: "미전환", tone: "slate" }],
          ],
        },
      },
    ],
  };

export const DETAILS: Record<string, DetailRecord[]> = {
    orders: [
      {
        title: "SO-2607-05 · 한빛모터스",
        subtitle: "정밀 샤프트 Ø12 · 24,000 EA",
        status: { label: "생산중", tone: "blue" },
        fields: [
          { label: "수주 금액", value: "8.6억원" },
          { label: "단가", value: "3,580원 / EA" },
          { label: "납기", value: "2026-07-18" },
          { label: "결제 조건", value: "월말 마감 익월 30일" },
          { label: "생산 연계", value: "WO-2607-021 (진척 51%)" },
          { label: "담당", value: "강지훈 · 국내영업팀" },
        ],
      },
      {
        title: "SO-2607-04 · 세진전자",
        subtitle: "브래킷 어셈블리 · 18,000 EA",
        status: { label: "생산중", tone: "blue" },
        fields: [
          { label: "수주 금액", value: "4.2억원" },
          { label: "단가", value: "2,333원 / EA" },
          { label: "납기", value: "2026-07-15" },
          { label: "결제 조건", value: "현금 50% + 어음 50%" },
          { label: "생산 연계", value: "WO-2607-019 (진척 74%)" },
          { label: "담당", value: "강지훈 · 국내영업팀" },
        ],
      },
      {
        title: "SO-2607-03 · 대륙기계",
        subtitle: "감속 기어 · 6,000 EA",
        status: { label: "자재 준비", tone: "amber" },
        fields: [
          { label: "수주 금액", value: "3.8억원" },
          { label: "단가", value: "6,333원 / EA" },
          { label: "납기", value: "2026-07-25" },
          { label: "결제 조건", value: "월말 마감 익월 30일" },
          { label: "특이사항", value: "SCM420 소재 입고 대기" },
          { label: "담당", value: "문가영 · 해외영업팀" },
        ],
      },
      {
        title: "SO-2607-02 · 글로벌AT",
        subtitle: "하우징 케이스 · 12,000 EA",
        status: { label: "수주 확정", tone: "green" },
        fields: [
          { label: "수주 금액", value: "5.1억원" },
          { label: "단가", value: "4,250원 / EA" },
          { label: "납기", value: "2026-08-05" },
          { label: "결제 조건", value: "L/C 90 days" },
          { label: "담당", value: "문가영 · 해외영업팀" },
        ],
      },
      {
        title: "SO-2606-31 · 한빛모터스",
        subtitle: "플랜지 커플링 · 8,000 EA",
        status: { label: "납기 임박", tone: "red" },
        fields: [
          { label: "수주 금액", value: "2.4억원" },
          { label: "단가", value: "3,000원 / EA" },
          { label: "납기", value: "2026-07-06 (D-4)" },
          { label: "결제 조건", value: "월말 마감 익월 30일" },
          { label: "생산 연계", value: "WO-2607-018 (지연 · 42%)" },
          { label: "담당", value: "강지훈 · 국내영업팀" },
        ],
      },
    ],
  };
