import type { ModulePageData } from "../types";

/** 재고·물류 모듈 화면 데이터 — 상세 페이지 구성 + 행 클릭 상세 */
export const PAGE: ModulePageData = {
    stats: [
      {
        label: "입고 대기",
        value: "3건",
        deltaTone: "amber",
        sub: "부분 입고 2 · 미입고 1",
        cta: { label: "검수하기", tabId: "receiving" },
      },
      {
        label: "미입고 잔량",
        value: "17 EA",
        sub: "관리번호 3건에 걸침",
        cta: { label: "확인하기", tabId: "receiving" },
      },
      {
        label: "진행 중 발주",
        value: "5건",
        sub: "발주 1 · 부분 입고 2 · 완료 2",
        cta: { label: "발주 보기", tabId: "purchasing" },
      },
      { label: "등록 품목", value: "261품목", delta: "+9", deltaTone: "green", sub: "단종 1 포함" },
    ],
    tabs: [
      {
        id: "items",
        label: "품목 마스터",
        actions: ["filter", "upload", "create"],
        rowAction: {
          label: "단종 처리",
          statusCol: 7,
          activeWhen: "활성",
          resultBadge: { text: "단종", tone: "slate" },
          confirm: {
            title: "품목 단종 처리",
            message: "을(를) 단종 처리합니다. 이후 신규 발주·입고에서 선택할 수 없으며, 기존 재고와 이력은 그대로 남습니다.",
            cta: "단종 처리",
          },
        },
        table: {
          columns: ["품목 코드", "품목명", "사양/시리즈", "규격", "단위", "위치(창고)", "인식 표기", "상태"],
          rows: [
            ["ITM-GS-0014", "GAS SPRING", "PX", "1500-80-MH", "EA", "공구실 A-1", "—", { badge: "활성", tone: "green" }],
            ["ITM-GS-0021", "GAS SPRING", "MH", "1500", "EA", "공구실 A-1", "—", { badge: "활성", tone: "green" }],
            ["ITM-WP-0003", "WEAR PLATE", "STW", "38-100", "EA", "공구실 B-2", "—", { badge: "활성", tone: "green" }],
            ["ITM-GP-0007", "GUIDE PIN", "SGPH", "20-120", "EA", "공구실 B-1", "PIN (SGPH)", { badge: "활성", tone: "green" }],
            ["ITM-GB-0004", "GUIDE BUSH", "SGBT", "25-25", "EA", "공구실 B-1", "BUSH (SGBT)", { badge: "활성", tone: "green" }],
            ["ITM-SP-0001", "SPRING (D25이상)", "SWF", "12-50", "EA", "공구실 C-1", "SWF", { badge: "활성", tone: "green" }],
            ["ITM-GP-0032", "GUIDE POST", "MYKP", "Φ32-140L", "EA", "공구실 A-3", "—", { badge: "활성", tone: "green" }],
            ["ITM-ER-0009", "END RETAINER", "DP-AN", "16", "EA", "공구실 D-1", "—", { badge: "단종", tone: "slate" }],
          ],
        },
      },
      {
        id: "stock",
        label: "현재 재고",
        actions: ["filter", "export"],
        drilldown: { toTabId: "movements", colIndex: 0 },
        table: {
          columns: ["품목명", "사양/시리즈", "규격", "기초 재고", "입고", "출고", "조정", "현재 재고"],
          rows: [
            ["GAS SPRING", "PX", "1500-80-MH", "2", "0", "1", "0", "1"],
            ["GAS SPRING", "PX", "500-100-MH", "0", "4", "0", "0", "4"],
            ["GAS SPRING", "PX", "2400-80", "0", "1", "0", "0", "1"],
            ["GAS SPRING", "MH", "1500", "29", "0", "2", "0", "27"],
            ["GAS SPRING", "MH", "2500", "33", "2", "0", "0", "35"],
            ["GUIDE PIN", "SGPH", "20-120", "4", "8", "0", "0", "12"],
            ["WEAR PLATE", "STW", "38-100", "7", "4", "0", "0", "11"],
            ["WEAR PLATE", "STW", "28-100", "16", "0", "0", "−1", "15"],
            ["GUIDE BUSH", "SGBT", "25-25", "6", "0", "0", "0", "6"],
          ],
        },
      },
      {
        id: "safety",
        label: "안전 재고",
        actions: ["filter", "export"],
        table: {
          columns: ["품목", "안전 재고 기준", "현재고", "충족률", "기준 산정 방식", "최적 주문량 (EOQ)", "상태"],
          rows: [
            ["알루미늄 합금 6061", "4,000 kg", "3,420 kg", "85.5%", "리드타임 7일 × 일평균 소요", "2,000 kg", { badge: "기준 미달", tone: "red" }],
            ["베어링 608ZZ", "10,000 EA", "8,240 EA", "82.4%", "리드타임 10일 × 일평균 소요", "5,000 EA", { badge: "기준 미달", tone: "red" }],
            ["절삭유 20L", "40 통", "36 통", "90.0%", "담당자 수기 지정", "30 통", { badge: "기준 미달", tone: "amber" }],
            ["스테인리스강 304", "3,500 kg", "5,180 kg", "148.0%", "리드타임 5일 × 일평균 소요", "—", { badge: "충족", tone: "green" }],
            ["황동봉 C3604", "—", "1,120 kg", "—", "미설정", "—", { badge: "기준 미설정", tone: "slate" }],
          ],
        },
      },
      {
        id: "receiving",
        label: "입고·수입검사",
        custom: "receiving-inspection",
      },
      {
        id: "movements",
        label: "입출고 이력",
        actions: ["filter", "export", "create"],
        createLabel: "조정 추가",
        table: {
          columns: ["일시", "품목명", "사양", "규격", "구분", "수량", "담당자", "귀속(관리번호)"],
          rows: [
            ["06-30 14:20", "GUIDE PIN", "SGPH", "20-120", { badge: "입고", tone: "green" }, "+8", "구매 담당", "26PNQ-S16 OP10"],
            ["06-30 14:05", "WEAR PLATE", "STW", "38-100", { badge: "입고", tone: "green" }, "+4", "구매 담당", "26PNQ-S16 OP10"],
            ["06-30 11:40", "GAS SPRING", "PX", "500-100-MH", { badge: "입고", tone: "green" }, "+4", "구매 담당", "26PNQ-S17 OP20"],
            ["06-29 16:10", "GAS SPRING", "MH", "2500", { badge: "입고", tone: "green" }, "+2", "공구실 담당", "26MSX-S03 OP20"],
            ["06-29 15:30", "GAS SPRING", "MH", "1500", { badge: "출고", tone: "slate" }, "−2", "공구실 담당", "26MSX-S03 OP20"],
            ["06-29 15:05", "GAS SPRING", "PX", "1500-80-MH", { badge: "출고", tone: "slate" }, "−1", "공구실 담당", "26MSX-S03 OP20"],
            ["06-29 10:00", "GAS SPRING", "PX", "2400-80", { badge: "입고", tone: "green" }, "+1", "구매 담당", "26MSX-S04 OP20"],
            ["06-25 09:00", "WEAR PLATE", "STW", "28-100", { badge: "조정", tone: "amber" }, "−1", "공구실 담당", "실사 차이 반영"],
          ],
        },
      },
      {
        id: "purchasing",
        label: "구매(발주) 관리",
        custom: "purchase-order",
      },
    ],
  };
