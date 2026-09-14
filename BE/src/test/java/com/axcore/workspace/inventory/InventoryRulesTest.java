package com.axcore.workspace.inventory;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * 순수 규칙만 — 발주번호 채번과 입고 한 줄의 계산. DB 없이 돈다.
 *
 * <p>입고 표는 화면 리듀서({@code FE/lib/inventory-state.test.ts} {@code receive})와 같은 숫자다. 두 쪽이 갈라지면
 * 데모 폴백 화면과 서버 화면이 달라지고 원인을 찾기 어렵다.
 */
class InventoryRulesTest {

    @Test
    void 발주_번호는_그_달_최대에_하나를_더한다() {
        String sep = InventoryOrderService.noPrefix(LocalDate.of(2026, 9, 14));
        assertEquals("PO-2609-", sep);
        assertEquals("PO-2609-0001", InventoryOrderService.nextNo(sep, ""));
        assertEquals("PO-2609-0004", InventoryOrderService.nextNo(sep, "PO-2609-0003"));
        assertEquals("PO-2609-0100", InventoryOrderService.nextNo(sep, "PO-2609-0099"));
        // 달이 바뀌면 0001 로 돌아간다 — 지난달 최댓값은 접두어가 달라 무시된다
        String oct = InventoryOrderService.noPrefix(LocalDate.of(2026, 10, 1));
        assertEquals("PO-2610-0001", InventoryOrderService.nextNo(oct, "PO-2609-0042"));
        assertEquals("PO-2601-", InventoryOrderService.noPrefix(LocalDate.of(2026, 1, 31)));
    }

    @Test
    void 합격은_누계에_더하고_메모는_정리해_남긴다() {
        var r = InventoryOrderService.Receipt.of(100, 30, 50, "pass", "  1차 입고 ");
        assertEquals(50, r.increment());
        assertEquals("1차 입고", r.note());
        assertEquals("1차 입고", r.movementNote());
    }

    @Test
    void 불합격은_누계에_세지_않는다_잔량이_남아_다시_받는다() {
        var r = InventoryOrderService.Receipt.of(100, 30, 50, "fail", "치수 불량");
        assertEquals(0, r.increment());
        assertEquals("치수 불량", r.movementNote());
        // 불합격은 초과로도 세지 않는다
        assertEquals("", InventoryOrderService.Receipt.of(10, 10, 5, "fail", null).movementNote());
    }

    @Test
    void 초과_입고는_막지_않고_이력_메모에_남긴다() {
        // 잔량 70 에 80 이 들어왔다 → 초과 10
        assertEquals("초과 +10", InventoryOrderService.Receipt.of(100, 30, 80, "pass", null).movementNote());
        assertEquals("추가분 · 초과 +10", InventoryOrderService.Receipt.of(100, 30, 80, "pass", "추가분").movementNote());
        // 이미 다 받은 줄(잔량 0)에 또 받으면 전부 초과다
        assertEquals("초과 +5", InventoryOrderService.Receipt.of(10, 10, 5, "pass", "").movementNote());
        // 누계는 그래도 받은 만큼 오른다 — 잔량 계산은 화면이 max(0, ·) 로 한다
        assertEquals(80, InventoryOrderService.Receipt.of(100, 30, 80, "pass", null).increment());
    }
}
