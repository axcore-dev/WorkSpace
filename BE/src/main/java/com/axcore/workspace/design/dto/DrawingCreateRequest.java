package com.axcore.workspace.design.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 도면 등록 — 첫 리비전은 언제나 Rev.A 다. {@code parent} 가 있으면 파생(가공도), 없으면 원본.
 *
 * @param parent    파생이면 근거 도면 code. 원본은 비운다
 * @param parentRev 근거 도면의 리비전. 비우면 그 도면의 지금 리비전
 */
public record DrawingCreateRequest(
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 100) String name,
        @Size(max = 50) String parent,
        @Size(max = 20) String parentRev,
        @Size(max = 100) String vehicle,
        @Size(max = 100) String projectCode,
        boolean excel,
        @Size(max = 200) String change,
        @Size(max = 100) String requester,
        @NotNull List<@Valid BomLineRequest> lines) {}
