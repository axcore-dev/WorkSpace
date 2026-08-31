package com.axcore.workspace.workspace.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Set;

/**
 * 워크스페이스 개설 요청. 운영자가 개설 화면에서 입력한 값이다.
 *
 * <p>고객이 사업자번호로 검색해 직접 만드는 방식(PRD 2.2)을 쓰지 않는다. 계약이 끝난 회사를
 * 우리가 대신 열고 접속 링크를 보내는 방식이라, 화면이 받는 값이 그대로 이 요청이 된다.
 *
 * <p>숫자만 받는 필드는 하이픈을 <b>서버가 지우지 않는다.</b> 화면이 이미 형식을 잡아 보내고,
 * 여기서 관대하게 받아들이면 "어떤 형태로 저장되는가" 가 호출부마다 달라진다. 사업자번호는
 * 유일 제약이 걸린 값이라 그 흔들림이 곧 중복 개설이 된다.
 *
 * @param name       상호. 표시용이며 스키마 이름에 영향을 주지 않는다
 * @param bizNumber  사업자등록번호 10자리. 같은 회사가 두 번 열리는 것을 막는 키다
 * @param plan       요금제. 값 목록은 아직 고정하지 않아 문자열로 받는다
 */
public record WorkspaceCreateRequest(
        @NotBlank(message = "상호는 필수입니다")
                @Size(max = 200, message = "상호가 너무 깁니다")
                String name,
        @NotBlank(message = "사업자등록번호는 필수입니다")
                @Pattern(regexp = "^[0-9]{10}$", message = "사업자등록번호는 하이픈 없이 10자리 숫자여야 합니다")
                String bizNumber,
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
        @Valid ContactsRequest contacts,
        @Valid List<WorkspaceSiteRequest> sites) {

    /**
     * 담당자.
     *
     * <p>접속 링크를 받는 사람과 평소 연락 담당을 나눈다. 실무자가 링크를 받고 계약·정산
     * 연락은 다른 사람에게 가는 경우가 있다.
     *
     * @param linkName  접속 링크를 받는 사람. 이 사람이 첫 관리자가 된다
     * @param linkEmail 링크가 나가는 주소
     * @param ccEmails  발송 메일의 참조 수신. 같은 주소를 두 번 넣을 수 없어 Set 이다
     */
    public record ContactsRequest(
            @Size(max = 100) String linkName,
            @Email(message = "접속 링크 수신 이메일 형식이 올바르지 않습니다")
                    @Size(max = 255)
                    String linkEmail,
            @Size(max = 100) String contactName,
            @Email(message = "연락 담당 이메일 형식이 올바르지 않습니다") @Size(max = 255) String contactEmail,
            @Size(max = 30) String contactPhone,
            Set<@Email(message = "참조 수신 이메일 형식이 올바르지 않습니다") String> ccEmails) {}
}
