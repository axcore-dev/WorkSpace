package com.axcore.workspace.inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 거래처. {@code FE/data/inventory.ts} 의 {@code Vendor} 와 같은 이름·같은 형태다 — 응답이자 {@code PUT /vendors/{id}}
 * 의 요청 본문이다. 화면이 통째로 보내고 통째로 받으므로 둘을 갈라 두면 필드가 어긋나도 컴파일이 통과한다.
 *
 * @param leadTimeDays null 이면 기한 넘김을 판단하지 않는다
 */
public record VendorDto(
        @NotBlank @Size(max = 50) String id,
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Pattern(regexp = "parts|material|outsourcing|inhouse") String kind,
        @Size(max = 10) String initial,
        @Min(0) Integer leadTimeDays,
        @Size(max = 100) String owner,
        boolean active) {}
