package com.axcore.workspace.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

/**
 * 발주 한 건. {@code FE/data/inventory.ts} 의 {@code PurchaseOrder} 와 같다.
 *
 * <p>{@code poNo} 는 <b>서버가 정한다.</b> 발주 생성 요청에도 이 형태가 그대로 오지만(위저드가 미리보기 번호를 채워
 * 둔다) 서버는 그 값을 버리고 {@code PO-YYMM-NNNN} 을 새로 매긴다 — 두 사람이 동시에 만들면 미리보기가 겹친다.
 *
 * @param closedOn 잔량을 남긴 채 마감한 날. 있으면 입고 완료로 본다
 */
public record PurchaseOrderDto(
        @Size(max = 30) String poNo,
        @NotNull LocalDate orderedOn,
        @NotBlank @Size(max = 50) String vendorId,
        @Size(max = 100) String projectCode,
        @Size(max = 100) String drawing,
        @Size(max = 20) String rev,
        @Size(max = 100) String requester,
        @NotEmpty @Valid List<Line> lines,
        LocalDate closedOn) {

    /**
     * 발주 라인. 발주 시점 표기 스냅샷을 갖는다 — 품목 마스터를 고쳐도 출력한 발주서와 화면이 어긋나면 안 된다.
     *
     * @param received 합격 입고 누계. 생성 요청에서는 무시한다(항상 0 에서 시작한다)
     */
    public record Line(
            @NotBlank @Size(max = 10) String no,
            @NotBlank @Size(max = 50) String itemCode,
            @Size(max = 100) String nameAtOrder,
            @Size(max = 100) String specAtOrder,
            @Size(max = 100) String sizeAtOrder,
            @Min(1) int ordered,
            @Min(0) int received,
            @Pattern(regexp = "pass|fail") String judgement,
            @Size(max = 200) String note) {}
}
