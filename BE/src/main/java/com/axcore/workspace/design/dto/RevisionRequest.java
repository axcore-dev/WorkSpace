package com.axcore.workspace.design.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 새 리비전. 번호는 서버가 올린다(Rev.C → Rev.D). BOM 은 통째로 이 리비전의 것으로 바뀐다. */
public record RevisionRequest(
        @Size(max = 200) String change,
        @Size(max = 100) String requester,
        boolean excel,
        @NotNull List<@Valid BomLineRequest> lines) {}
