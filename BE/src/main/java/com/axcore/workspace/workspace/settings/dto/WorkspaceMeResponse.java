package com.axcore.workspace.workspace.settings.dto;

import com.axcore.workspace.workspace.settings.TenantContext;

import java.util.List;

/**
 * "지금 이 회사에서 나는 누구인가" — 사이드바·설정 화면이 처음 한 번 받아 두는 값.
 *
 * <p>화면이 무엇을 보이고 무엇을 잠글지가 여기서 갈린다. 다만 <b>보안 경계는 아니다.</b> 잠근 버튼을 우회해
 * 요청을 보내면 각 API 의 {@link TenantContext} 검사가 막는다. 여기 값은 그 검사의 결과를 미리 알려 주는 것뿐이다.
 *
 * @param modules  이 사람이 쓸 수 있는 모듈 slug. 회사가 켠 것 ∩ 직급·개인 권한. introspect 가 AI 서버에 주는 값과 같다
 * @param features 회사가 켠 기능 탭 전부. 관리자가 아니어도 본다 — 사이드바가 "회사가 무엇을 쓰나" 를 알아야 한다
 */
public record WorkspaceMeResponse(
        Long workspaceId,
        String workspaceName,
        Member member,
        List<String> modules,
        List<FeatureModuleResponse> features) {

    public record Member(
            Long id,
            String roleCode,
            String roleName,
            boolean admin,
            boolean owner,
            boolean canInvite,
            Long departmentId,
            String departmentName,
            String title,
            boolean internalAdmin) {

        public static Member from(TenantContext ctx) {
            return new Member(
                    ctx.memberId(),
                    ctx.roleCode(),
                    ctx.roleName(),
                    ctx.admin(),
                    ctx.owner(),
                    ctx.canInvite(),
                    ctx.departmentId(),
                    ctx.departmentName(),
                    ctx.title(),
                    ctx.internalAdmin());
        }
    }
}
