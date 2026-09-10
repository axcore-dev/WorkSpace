package com.axcore.workspace.workspace.settings;

import java.util.UUID;

/**
 * 설정 API 한 요청이 "누가 · 어느 회사에서 · 어떤 자격으로" 왔는지. {@link TenantAccess#open} 이 만든다.
 *
 * <p>이 객체가 존재한다는 것은 이미 <b>소속이 확인되고 그 회사의 스키마가 이 트랜잭션에 열려 있다</b>는 뜻이다.
 * 권한 검사는 여기 메서드로 한다 — 컨트롤러가 {@code isAdmin} 을 직접 비교하기 시작하면 빠뜨린 자리가
 * 조용히 열린다. 예외는 {@link SettingsForbiddenException} 하나로 403 이 된다.
 *
 * @param memberId    테넌트 {@code members.id}. 소속 없이 들어온 서버 운영자는 null 이다
 * @param roleId      {@code roles.id}. 소속 없는 서버 운영자는 null
 * @param roleCode    {@code roles.code}. 소속 없는 서버 운영자는 {@code internal_admin}
 * @param admin       회사 설정(기능 관리)을 다룰 수 있는가 ({@code roles.is_admin}). 소속 없는 서버 운영자는 true
 * @param owner       회사에 한 명인 소유자({@code roles.code = 'owner'})인가. 부서 · 직급 · 구성원 · 초대는 이 사람만
 * @param canInvite   {@code roles.can_invite}. 화면 표시용으로 남긴다 — 지금 초대는 소유자만이다
 * @param internalAdmin 서버 운영자(shared.users.is_internal_admin). 구성원이면 그 회사의 직급이 우선이고 이 표시만 함께 붙는다.
 *                      소속이 없으면 위 합성 값으로 들어온다
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

    /** 회사 설정(기능 관리)을 바꿀 수 있어야 한다. */
    public void requireAdmin() {
        if (!admin) {
            throw new SettingsForbiddenException("이 작업은 관리자만 할 수 있습니다");
        }
    }

    /** 부서 · 직급 · 권한 · 구성원 소속 · 초대 · 초대 링크 — 회사를 대표하는 한 사람만. */
    public void requireOwner() {
        if (!owner) {
            throw new SettingsForbiddenException("이 작업은 소유자만 할 수 있습니다");
        }
    }
}
