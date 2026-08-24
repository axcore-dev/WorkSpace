import { CHART } from "@/lib/palette";
import type { ModulePageData } from "../types";

/** 장비관리 모듈 화면 데이터 — 상세 페이지 구성 + 행 클릭 상세 */
export const PAGE: ModulePageData = {
    stats: [
      { label: "관리 대상 설비", value: "21대", sub: "센서 연동 18대" },
      { label: "고장 위험 경고", value: "2건", delta: "+1", deltaTone: "red", sub: "24시간 내 예측" },
      { label: "평균 가동률 (OEE)", value: "84.6%", delta: "+1.9%p", deltaTone: "green", sub: "전월 대비" },
      { label: "이번 주 정비 일정", value: "4건", sub: "예방 정비 3 · 교정 1" },
    ],
    tabs: [
      {
        id: "predict",
        label: "정비 예측",
        ai: true,
        actions: ["export"],
        table: {
          columns: ["설비", "예측 유형", "고장 확률", "예측 근거", "권고 조치", "위험도"],
          rows: [
            ["CNC-07 머시닝센터", "스핀들 베어링 마모", "87%", "진동 RMS 14일 연속 상승", "72시간 내 베어링 교체", { badge: "높음", tone: "red" }],
            ["PRS-02 프레스", "유압 펌프 열화", "64%", "유온 상승 + 압력 편차 확대", "유압유·필터 점검", { badge: "중간", tone: "amber" }],
            ["CMP-01 컴프레서", "흡기 필터 막힘", "41%", "전력 소비 8% 증가 추세", "필터 청소/교체", { badge: "낮음", tone: "slate" }],
            ["CNC-03 머시닝센터", "냉각수 순환 저하", "12%", "정상 범위", "정기 점검 유지", { badge: "정상", tone: "green" }],
          ],
        },
        chart: {
          type: "line",
          title: "CNC-07 스핀들 진동 추이 (RMS, mm/s)",
          labels: ["6/18", "6/21", "6/24", "6/27", "6/30", "7/2"],
          series: [
            { name: "진동 RMS", color: CHART.red, values: [2.1, 2.4, 2.9, 3.6, 4.4, 5.1] },
            { name: "경고 임계치", color: CHART.amber, values: [4.5, 4.5, 4.5, 4.5, 4.5, 4.5] },
          ],
        },
      },
      {
        id: "maintenance",
        label: "정비 관리",
        actions: ["filter", "create"],
        table: {
          columns: ["정비번호", "설비", "유형", "내용", "담당", "일정", "상태"],
          rows: [
            ["MT-2607-04", "CNC-07 머시닝센터", "예지 정비", "스핀들 베어링 교체 (AI 권고)", "정민호", "2026-07-04", { badge: "일정 확정", tone: "violet" }],
            ["MT-2607-03", "조립 라인 컨베이어", "돌발 정비", "구동 모터 교체", "설비보전팀", "2026-07-02", { badge: "진행중", tone: "blue" }],
            ["MT-2607-02", "PRS-01 프레스", "예방 정비", "슬라이드 급유·볼트 토크 점검", "이강토", "2026-07-03", { badge: "예정", tone: "slate" }],
            ["MT-2606-18", "CNC-01~04", "정기 정비", "월간 정도 검사·레벨 교정", "정민호", "2026-06-28", { badge: "완료", tone: "green" }],
          ],
        },
      },
    ],
  };
