package com.axcore.workspace.workspace.settings;

import java.util.UUID;

/**
 * 설정 API 한 요청이 "누가 · 어느 회사에서 · 어떤 자격으로" 왔는지. {@link TenantAccess#open} 이 만든다.
 *
 * <p>이 객체가 존재한다는 것은 이미 <b>소속이 확인되고 그 회사의 스키마가 이 트랜잭션에 열려 있다</b>는 뜻이다.
 * 권한 검사는 여기 메서드로 한다 — 컨트롤러가 {@code isAdmin} 을 직접 비교하기 시작하면 빠뜨린 자리가
 * 조용히 열린다. 예외는 {@link SettingsForbiddenException} 하나로 403 이 된다.
 *
 * @param memberId    테넌트 {@code members.id}. 서버 운영자는 구성원이 아니라 null 이다
 * @param roleId      {@code roles.id}. 자기 직급을 고치는 요청을 막을 때 쓴다. 서버 운영자는 null
 * @param roleCode    {@code roles.code}. 서버 운영자는 {@code internal_admin}
 * @param admin       회사 설정·구성원을 다룰 수 있는가 ({@code roles.is_admin}). 서버 운영자는 true
 * @param owner       회사에 한 명인 소유자({@code roles.code = 'owner'})인가. 고정 직급의 권한은 이 사람만 고친다
 * @param canInvite   구성원을 부를 수 있는가 ({@code roles.can_invite})
 * @param internalAdmin 서버 운영자(shared.users.is_internal_admin). 소속 없이 들어온다
 */
public record TenantContext(
        UUID userId,
        Long workspaceId,
        String workspaceName,
        String schemaName,
        Long memberId,
        Long roleId,
        String roleCode,
        String roleName,
        boolean admin,
        boolean owner,
        boolean canInvite,
        Long departmentId,
        String departmentName,
        String title,
        boolean internalAdmin) {

    /** 회사 설정(기능 · 부서)과 구성원을 바꿀 수 있어야 한다. */
    public void requireAdmin() {
        if (!admin) {
            throw new SettingsForbiddenException("이 작업은 관리자만 할 수 있습니다");
        }
    }

    /**
     * 직급·권한 편집. 소유자, 그리고 <b>자기 권한 범위 안에서 편집하는 관리자</b>가 대상이다.
     * 범위 검사는 {@code RoleService} 가 대상 직급을 알 때 한다. 여기서는 문 앞에서 둘 중 하나인지만 본다.
     */
    public void requireRoleEditor() {
        if (!owner && !admin) {
            throw new SettingsForbiddenException("직급과 권한은 소유자와 관리자만 편집할 수 있습니다");
        }
    }
}
