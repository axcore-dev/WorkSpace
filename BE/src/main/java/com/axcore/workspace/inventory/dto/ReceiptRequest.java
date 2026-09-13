package com.axcore.workspace.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * {@code POST /orders/{poNo}/receipts} — 이번에 받은 몫만 보낸다.
 *
 * <p><b>증분이다.</b> 화면이 계산한 누계를 보내지 않는다 — 두 사람이 같은 발주를 등록하면 나중 값이 앞의 등록을
 * 덮어써서 한 번의 입고가 사라진다.
 *
 * @param complete 잔량이 남아도 마감한다(「검수 완료」)
 */
public record ReceiptRequest(@NotEmpty @Valid List<Line> lines, boolean complete) {

    /**
     * @param received 이번에 받은 수량. 0 이면 판정만 남긴다(전량 불합격)
     */
    public record Line(
            @NotBlank @Size(max = 10) String no,
            @Min(0) int received,
            @NotBlank @Pattern(regexp = "pass|fail") String judgement,
            @Size(max = 200) String note) {}
}
