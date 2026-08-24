import type { ModulePageData } from "../types";

/** 제품설계 모듈 화면 데이터 — 상세 페이지 구성 + 행 클릭 상세 */
export const PAGE: ModulePageData = {
    stats: [
      { label: "등록 도면", value: "412건", delta: "+18", deltaTone: "green", sub: "원본 168 · 파생 244" },
      {
        label: "확인 필요 파생 도면",
        value: "1건",
        deltaTone: "amber",
        sub: "원본 개정 영향",
        cta: { label: "확인하기", tabId: "drawings" },
      },
      {
        label: "미매핑 BOM 항목",
        value: "2건",
        deltaTone: "red",
        sub: "발주 진행 차단",
        cta: { label: "매핑하기", tabId: "bom" },
      },
      { label: "정제 엑셀 미첨부", value: "1건", sub: "도면 단독 등록분" },
    ],
    tabs: [
      {
        id: "drawings",
        label: "도면 관리",
        custom: "drawing-manager",
      },
      {
        id: "specs",
        label: "설계 관리",
        actions: ["create"],
        table: {
          columns: ["변경번호", "대상", "변경 내용", "요청자", "일자", "상태"],
          rows: [
            ["ECO-2607-02", "정밀 샤프트 Ø12", "열처리 사양 HRC50→HRC52 상향", "윤성민", "2026-07-01", { badge: "승인 대기", tone: "amber" }],
            ["ECO-2607-01", "브래킷 어셈블리", "체결부 볼트 M4→M5 변경", "김다혜", "2026-06-30", { badge: "검토중", tone: "amber" }],
            ["ECO-2606-11", "하우징 케이스", "방열 슬릿 4→6개 추가", "박준영", "2026-06-26", { badge: "반영 완료", tone: "green" }],
            ["ECO-2606-10", "감속 기어", "재질 SCM415→SCM420 변경", "윤성민", "2026-06-22", { badge: "반영 완료", tone: "green" }],
          ],
        },
      },
      {
        id: "bom",
        label: "BOM 관리",
        actions: ["filter", "export"],
        tree: [
          {
            name: "26MSX-S03-20 · S03 OP20 (FO) LH",
            meta: "Rev.C 기준 · 확정 스냅샷 · 부품 6종",
            children: [
              { name: "GUIDE POST · MYKP", meta: "Φ32-140L · 4 EA" },
              { name: "SPRING-LIFT · SWF", meta: "12-50 · 3 EA" },
              { name: "LIFT PIN · LP", meta: "10-58 · 3 EA" },
              { name: "GAUGE · HMD", meta: "20*65*35t · 7 EA", badge: { text: "미매핑", tone: "red" } },
              {
                name: "현장 제작",
                meta: "2종",
                children: [
                  { name: "UPPER HEIGHT BLOCK · S45C", meta: "Φ40-95L · 2 EA", badge: { text: "미매핑", tone: "red" } },
                  { name: "LOWER HEIGHT BLOCK · S45C", meta: "Φ40-95L · 2 EA" },
                ],
              },
            ],
          },
        ],
        table: {
          columns: ["도면번호", "리비전", "BOM 표기", "매핑 품목", "규격", "수량", "매핑 상태"],
          rows: [
            ["26MSX-S03-20", "Rev.C", "GUIDE POST / MYKP", "ITM-GP-0032 GUIDE POST", "Φ32-140L", "4 EA", { badge: "매핑 완료", tone: "green" }],
            ["26MSX-S03-20", "Rev.C", "SPRING-LIFT / SWF", "ITM-SP-0001 SPRING (D25이상)", "12-50", "3 EA", { badge: "매핑 완료", tone: "green" }],
            ["26MSX-S03-20", "Rev.C", "LIFT PIN / LP", "ITM-LP-0010 LIFT PIN", "10-58", "3 EA", { badge: "매핑 완료", tone: "green" }],
            ["26MSX-S03-20", "Rev.C", "GAUGE / HMD", "—", "20*65*35t", "7 EA", { badge: "미매핑", tone: "red" }],
            ["26MSX-S03-20", "Rev.C", "UPPER HEIGHT BLOCK / S45C", "—", "Φ40-95L", "2 EA", { badge: "미매핑", tone: "red" }],
            ["26MSX-S04-20", "Rev.B", "GUIDE POST / MYKP", "ITM-GP-0032 GUIDE POST", "Φ32-140L", "4 EA", { badge: "자동 매핑", tone: "blue" }],
          ],
        },
        rowAction: {
          label: "매핑",
          statusCol: 6,
          activeWhen: "미매핑",
          resultBadge: { text: "매핑 완료", tone: "green" },
          pick: {
            title: "품목 마스터에서 선택",
            options: [
              "ITM-GS-0014 GAS SPRING PX 1500-80-MH",
            "ITM-GS-0021 GAS SPRING MH 1500",
            "ITM-WP-0003 WEAR PLATE STW 38-100",
            "ITM-GP-0007 GUIDE PIN SGPH 20-120",
            "ITM-GB-0004 GUIDE BUSH SGBT 25-25",
            "ITM-SP-0001 SPRING (D25이상) SWF 12-50",
            "ITM-GP-0032 GUIDE POST MYKP Φ32-140L",
            ],
            targetCol: 3,
          },
        },
      },
    ],
  };
