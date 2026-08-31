package com.axcore.workspace.workspace.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 워크스페이스 수정.
 *
 * <p><b>{@code bizNumber} 를 받지 않는다.</b> 회사의 유일성을 보장하는 키라 사실상 불변이다.
 * 바꿔야 하는 상황은 애초에 잘못 개설한 경우이고, 그때는 수정이 아니라 해지 후 재개설이
 * 맞는다 — 사업자번호가 바뀌면 그 스키마 안의 데이터가 다른 회사 것이 된다.
 *
 * <p>{@code status} 도 받지 않는다. 중지·재개·해지는 각자 전용 엔드포인트가 있다. 상태를
 * 일반 수정에 섞으면 상호를 고치려다 실수로 회사를 닫는 요청이 만들어진다.
 *
 * <p>부분 수정이 아니라 <b>전체 교체</b>다. 화면이 상세 폼 전체를 들고 저장을 누르므로,
 * null 을 "바꾸지 않음" 으로 해석하면 값을 비우는 조작을 표현할 수 없다.
 */
public record WorkspaceUpdateRequest(
        @NotBlank(message = "상호는 필수입니다") @Size(max = 200) String name,
        @Pattern(regexp = "^[0-9]{13}$", message = "법인등록번호는 하이픈 없이 13자리 숫자여야 합니다")
                String corpNumber,
        @Size(max = 100) String ceoName,
        @Size(max = 100) String bizType,
        @Size(max = 100) String bizItem,
        @Size(max = 300) String address,
        @Size(max = 300) String website,
        @Email(message = "세금계산서 이메일 형식이 올바르지 않습니다") @Size(max = 255) String taxEmail,
        @Size(max = 30) String plan,
        @Size(max = 100) String operatorName,
        String memo,
        @Valid WorkspaceCreateRequest.ContactsRequest contacts,
        @Valid List<WorkspaceSiteRequest> sites) {}
