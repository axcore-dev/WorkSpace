package com.axcore.workspace.design.dto;

import java.util.List;

/**
 * 도면 하나 = 도면번호 + 리비전. {@code FE/data/drawings.ts} 의 {@code Drawing} 과 같다. 같은 code 의 다음 리비전은 앞
 * 리비전에서 파생된 별도 도면이다 — 화면이 {@code rev} 가 가장 큰 것을 「지금 도면」으로 고른다.
 *
 * @param parent    파생(가공도)이면 근거 도면 code. 원본은 null
 * @param parentRev 파생이 근거로 삼은 상위 리비전
 * @param vehicle   원본만. 파생은 null 이라 화면이 상위의 값을 대신 보인다
 * @param excel     정제 엑셀 첨부 여부
 * @param updated   이 리비전을 등록한 날 YYYY-MM-DD
 * @param status    승인 · 확인 필요 · 폐기 (화면 리터럴)
 * @param change    이 리비전의 변경 내용
 * @param requester 요청 주체
 */
public record DrawingDto(
        String code,
        String rev,
        String name,
        String parent,
        String parentRev,
        String vehicle,
        String projectCode,
        boolean excel,
        String author,
        String updated,
        String status,
        String change,
        String requester,
        List<BomLine> bom) {

    /** @param itemCode 매핑된 재고 품목. null = 미매핑 */
    public record BomLine(long id, String item, String spec, String size, int qty, String itemCode) {}
}
