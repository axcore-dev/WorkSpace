package com.axcore.workspace.workspace.admin.dto;

/**
 * 청구 한 건.
 *
 * <p><b>아직 이 값을 만드는 곳이 없다.</b> 청구 체계가 정해지지 않아 항상 빈 목록이 나간다.
 * 형태만 먼저 두는 이유는, 청구가 붙을 때 응답 계약이 바뀌지 않게 하려는 것이다 — 화면은
 * 지금도 "아직 청구 내역이 없어요" 로 정상 동작한다.
 *
 * @param period "2026-07" 형태
 * @param amount 원 단위 정수
 * @param state paid · due · overdue
 */
public record WorkspaceInvoiceResponse(
        String period, String plan, String usage, long amount, String state) {
}
