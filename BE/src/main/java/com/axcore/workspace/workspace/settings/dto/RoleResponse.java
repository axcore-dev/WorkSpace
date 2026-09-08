package com.axcore.workspace.workspace.settings.dto;

import java.util.List;

/**
 * 직급 한 줄 — 권한 관리 화면의 가운데·오른쪽 열.
 *
 * @param system      고정 직급(owner · member). 이름·부서를 바꾸거나 지울 수 없다
 * @param departmentId 소유자는 null(「전사」)
 * @param admin       회사 설정 · 구성원 관리 (화면 ws:settings)
 * @param canInvite   구성원 초대 위임
 * @param canManageIntegrations 연동 관리 (화면 ws:integrations)
 * @param tabs        볼 수 있는 기능 탭 id. 소유자는 카탈로그 전부가 그대로 온다
 * @param memberCount 이 직급을 가진 구성원 수. 0 이 아니면 지울 때 옮길 곳이 필요하다
 * @param editable    <b>지금 부른 사람이</b> 이 직급을 고칠 수 있는가. 서버 규칙(소유자 직급 불가 · 관리자는 자기 권한 안 ·
 *                    자기 직급 불가)을 미리 계산해 준다. 화면은 이 값으로 잠근다 — 보안 경계는 서버의 PUT 검사다
 * @param assignable  <b>지금 부른 사람이</b> 이 직급을 남에게 줄 수 있는가(초대 · 소속 변경). 소유자 직급은 아무도 못 주고,
 *                    관리자·위임받은 사람은 자기 권한 안의 직급만. 초대 팝업의 직급 목록이 이 값으로 걸러진다
 */
public record RoleResponse(
        Long id,
        String code,
        String name,
        boolean system,
        Long departmentId,
        String departmentName,
        boolean admin,
        boolean canInvite,
        boolean canManageIntegrations,
        String dataScope,
        boolean showAmounts,
        List<String> tabs,
        int memberCount,
        boolean editable,
        boolean assignable) {}
