package com.axcore.workspace.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * {@code POST /orders} — 발주서 위저드가 발주처별로 나눈 발주들. 번호는 서버가 정한다.
 *
 * <p>한 트랜잭션이다 — 세 건 중 하나가 막히면 셋 다 만들지 않는다. 절반만 들어가면 화면이 위저드를 다시 열어도
 * 무엇이 들어갔는지 알 수 없다.
 */
public record CreateOrdersRequest(@NotEmpty @Valid List<PurchaseOrderDto> orders) {}
