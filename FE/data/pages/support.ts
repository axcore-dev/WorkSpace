import { CHART } from "@/lib/palette";
import type { DetailRecord, ModulePageData } from "../types";

/** 고객지원 모듈 화면 데이터 — 상세 페이지 구성 + 행 클릭 상세 */
export const PAGE: ModulePageData = {
    stats: [
      { label: "미처리 AS 티켓", value: "6건", delta: "-4", deltaTone: "green", sub: "평균 처리 1.8일" },
      { label: "이번 달 접수", value: "31건", sub: "AS 19 · 문의 9 · 불만 3" },
      { label: "고객 만족도", value: "4.5 / 5.0", delta: "+0.2", deltaTone: "green", sub: "최근 90일 설문" },
      { label: "재발 불량 비율", value: "6.5%", delta: "-1.2%p", deltaTone: "green", sub: "VOC 기준" },
    ],
    tabs: [
      {
        id: "tickets",
        label: "AS 접수",
        actions: ["filter", "create"],
        table: {
          columns: ["티켓번호", "고객사", "유형", "내용", "접수일", "우선순위"],
          rows: [
            ["CS-2607-06", "한빛모터스", "AS 요청", "샤프트 어셈블리 소음 발생 (로트 L-26058)", "2026-07-02", { badge: "높음", tone: "red" }],
            ["CS-2607-05", "세진전자", "문의", "브래킷 도금 사양 변경 가능 여부", "2026-07-02", { badge: "보통", tone: "slate" }],
            ["CS-2607-04", "대륙기계", "AS 요청", "감속 기어 백래시 과다 2EA", "2026-07-01", { badge: "보통", tone: "amber" }],
            ["CS-2607-03", "글로벌AT", "불만", "납품 포장 파손 재발", "2026-07-01", { badge: "높음", tone: "red" }],
          ],
        },
      },
      {
        id: "tracking",
        label: "AS 트래킹",
        actions: ["filter"],
        table: {
          columns: ["티켓번호", "담당", "현재 단계", "경과", "다음 액션", "상태"],
          rows: [
            ["CS-2607-06", "서준일", "원인 분석", "0.5일", "로트 추적 → 품질검사 연계", { badge: "진행", tone: "blue" }],
            ["CS-2607-04", "김하늘", "교체품 발송", "1.2일", "출고 완료 안내", { badge: "진행", tone: "blue" }],
            ["CS-2607-03", "서준일", "개선안 회신", "1.4일", "포장 사양 변경 확정", { badge: "진행", tone: "amber" }],
            ["CS-2606-28", "김하늘", "완료", "2.1일", "만족도 설문 발송됨", { badge: "완료", tone: "green" }],
          ],
        },
      },
      {
        id: "voc",
        label: "VOC 분석",
        actions: ["export"],
        chart: {
          type: "donut",
          title: "VOC 유형 분포 (최근 90일)",
          segments: [
            { name: "품질 (소음·치수)", value: 34, color: CHART.primary },
            { name: "납기·물류", value: 26, color: CHART.primary400 },
            { name: "포장 상태", value: 18, color: CHART.primary300 },
            { name: "문서·사양 문의", value: 14, color: CHART.primary200 },
            { name: "기타", value: 8, color: CHART.muted },
          ],
        },
      },
    ],
  };

export const DETAILS: Record<string, DetailRecord[]> = {
    tickets: [
      {
        title: "CS-2607-06 · 한빛모터스",
        subtitle: "AS 요청 · 접수 2026-07-02",
        status: { label: "높음", tone: "red" },
        statusLabel: "우선순위",
        fields: [
          { label: "제품", value: "샤프트 어셈블리 (로트 L-26058)" },
          { label: "증상", value: "조립 후 이음(소음) 발생" },
          { label: "요청 유형", value: "현장 점검 + 교체" },
          { label: "연락처", value: "고객 담당 김과장 010-2211-0058" },
          { label: "담당", value: "서준일 · 고객지원팀" },
          { label: "연계", value: "품질검사 불량 분석(RCA) 연계 요청" },
        ],
      },
      {
        title: "CS-2607-05 · 세진전자",
        subtitle: "문의 · 접수 2026-07-02",
        status: { label: "보통", tone: "slate" },
        statusLabel: "우선순위",
        fields: [
          { label: "문의 내용", value: "브래킷 도금 사양 변경 가능 여부" },
          { label: "요청 유형", value: "기술 문의" },
          { label: "연락처", value: "구매팀 이대리 010-7788-1020" },
          { label: "담당", value: "서준일 · 고객지원팀" },
        ],
      },
      {
        title: "CS-2607-04 · 대륙기계",
        subtitle: "AS 요청 · 접수 2026-07-01",
        status: { label: "보통", tone: "amber" },
        statusLabel: "우선순위",
        fields: [
          { label: "제품", value: "감속 기어 2 EA" },
          { label: "증상", value: "백래시 과다 (규격 초과)" },
          { label: "요청 유형", value: "교체" },
          { label: "연락처", value: "품질팀 010-3040-7788" },
          { label: "담당", value: "김하늘 · 고객지원팀" },
        ],
      },
      {
        title: "CS-2607-03 · 글로벌AT",
        subtitle: "불만 · 접수 2026-07-01",
        status: { label: "높음", tone: "red" },
        statusLabel: "우선순위",
        fields: [
          { label: "내용", value: "납품 포장 파손 재발 (2회차)" },
          { label: "요청 유형", value: "재발 방지 대책 요청" },
          { label: "연락처", value: "입고팀 010-9090-0301" },
          { label: "담당", value: "서준일 · 고객지원팀" },
          { label: "연계", value: "재고·물류 포장 사양 개선 검토" },
        ],
      },
    ],
    tracking: [
      {
        title: "CS-2607-06 처리 이력",
        subtitle: "샤프트 어셈블리 소음 · 담당 서준일",
        status: { label: "진행 · 원인 분석", tone: "blue" },
        fields: [
          { label: "현재 단계", value: "원인 분석 (0.5일 경과)" },
          { label: "다음 액션", value: "로트 추적 → 품질검사 연계" },
          { label: "고객 안내", value: "현장 점검 일정 협의 중" },
        ],
        tableTitle: "처리 타임라인",
        table: {
          columns: ["단계", "일시", "담당"],
          rows: [
            ["접수", "07-02 09:10", "자동"],
            ["할당", "07-02 09:25", "서준일"],
            ["원인 분석", "07-02 13:40", "서준일"],
          ],
        },
      },
      {
        title: "CS-2607-04 처리 이력",
        subtitle: "감속 기어 백래시 · 담당 김하늘",
        status: { label: "진행 · 교체품 발송", tone: "blue" },
        fields: [
          { label: "현재 단계", value: "교체품 발송 (1.2일 경과)" },
          { label: "다음 액션", value: "출고 완료 안내" },
          { label: "고객 안내", value: "택배 송장 공유 예정" },
        ],
      },
      {
        title: "CS-2607-03 처리 이력",
        subtitle: "포장 파손 재발 · 담당 서준일",
        status: { label: "진행 · 개선안 회신", tone: "amber" },
        fields: [
          { label: "현재 단계", value: "개선안 회신 (1.4일 경과)" },
          { label: "다음 액션", value: "포장 사양 변경 확정" },
          { label: "고객 안내", value: "완충재 사양 개선안 송부" },
        ],
      },
      {
        title: "CS-2606-28 처리 이력",
        subtitle: "완료 건 · 담당 김하늘",
        status: { label: "완료", tone: "green" },
        fields: [
          { label: "처리 결과", value: "교체 완료 · 고객 확인" },
          { label: "총 소요", value: "2.1일" },
          { label: "후속", value: "만족도 설문 발송됨" },
        ],
      },
    ],
  };
