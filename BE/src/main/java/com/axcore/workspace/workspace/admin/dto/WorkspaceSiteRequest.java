package com.axcore.workspace.workspace.admin.dto;

import com.axcore.workspace.workspace.entity.WorkspaceSite;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 본사 외 사업장.
 *
 * <p>본사는 워크스페이스 본체의 값이라 여기 넣지 않는다. 사업자번호는 본사와 같을 수 있어
 * (종된 사업장) 유일성을 검사하지 않는다.
 */
public record WorkspaceSiteRequest(
        @NotBlank(message = "사업장 이름은 필수입니다") @Size(max = 200) String name,
        @Pattern(regexp = "^[0-9]{10}$", message = "사업장 사업자등록번호는 하이픈 없이 10자리 숫자여야 합니다")
                String bizNumber,
        @Size(max = 300) String address,
        @Size(max = 100) String bizType,
        @Size(max = 100) String bizItem) {

    public WorkspaceSite toEntity() {
        return WorkspaceSite.of(name, bizNumber, address, bizType, bizItem);
    }
}
