package com.axcore.workspace.workspace.admin;

/**
 * 같은 사업자등록번호로 이미 워크스페이스가 열려 있다.
 *
 * <p>{@code ux_workspaces_biz_number} 를 미리 확인해서 던진다. 그냥 저장하면 제약 위반이
 * DataIntegrityViolationException 으로 올라오고, 그건 "이미 존재하는 값입니다" 라는 뜻 없는
 * 문구로 나간다.
 *
 * <p>운영자만 보는 화면이라 어느 회사인지 함께 알려 준다. 고객용 API 였다면 감춰야 할
 * 정보지만, 여기서는 "이미 열려 있으니 그 회사를 여세요" 가 필요한 안내다.
 */
public class DuplicateBizNumberException extends RuntimeException {

    public DuplicateBizNumberException(String bizNumber, String existingName) {
        super("이미 개설된 사업자등록번호입니다: %s (%s)".formatted(bizNumber, existingName));
    }
}
