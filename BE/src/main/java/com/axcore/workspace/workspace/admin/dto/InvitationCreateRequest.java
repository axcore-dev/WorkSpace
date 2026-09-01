package com.axcore.workspace.workspace.admin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * 접속 링크 발송 요청.
 *
 * @param email 링크를 받을 주소. 비우면 워크스페이스에 등록된 접속 링크 담당자
 *              ({@code contacts.linkEmail})로 보낸다. 담당자 외에 다른 직원을 더 넣을 때만
 *              값을 채우면 된다.
 */
public record InvitationCreateRequest(
        @Email(message = "이메일 형식이 아닙니다") @Size(max = 255, message = "이메일은 255자를 넘을 수 없습니다")
                String email) {
}
