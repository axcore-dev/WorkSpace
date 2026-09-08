package com.axcore.workspace.workspace.settings;

import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.dto.DepartmentRequest;
import com.axcore.workspace.workspace.settings.dto.DepartmentResponse;
import com.axcore.workspace.workspace.settings.dto.RoleCreateRequest;
import com.axcore.workspace.workspace.settings.dto.RoleResponse;
import com.axcore.workspace.workspace.settings.dto.RoleUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 회사 조직 — 부서와 직급. 설정 › 회사 › 권한 관리 화면의 API 다.
 *
 * <p>{@link WorkspaceSettingsController} 와 같은 입구({@link TenantAccess})를 쓴다. 누가 무엇까지 할 수 있는지는
 * {@link RoleService} 의 클래스 주석에 있다 — 소유자는 전부, 관리자는 자기 권한 안에서, 고정 직급은 아무도.
 */
@RestController
@RequestMapping("/api/workspace")
public class OrganizationSettingsController {

    private final DepartmentService departments;
    private final RoleService roles;

    public OrganizationSettingsController(DepartmentService departments, RoleService roles) {
        this.departments = departments;
        this.roles = roles;
    }

    // ---------------------------------------------------------------- 부서

    @GetMapping("/departments")
    public List<DepartmentResponse> departments(@AuthenticationPrincipal Jwt jwt) {
        return departments.list(JwtPrincipal.of(jwt));
    }

    @PostMapping("/departments")
    public ResponseEntity<DepartmentResponse> createDepartment(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DepartmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(departments.create(JwtPrincipal.of(jwt), request));
    }

    @PatchMapping("/departments/{id}")
    public DepartmentResponse renameDepartment(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody DepartmentRequest request) {
        return departments.rename(JwtPrincipal.of(jwt), id, request);
    }

    /** 직급이 남아 있으면 {@code moveRolesTo} 로 옮길 부서를 함께 준다. 없으면 409 {@code DEPARTMENT_NOT_EMPTY}. */
    @DeleteMapping("/departments/{id}")
    public ResponseEntity<Void> deleteDepartment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long id,
            @RequestParam(required = false) Long moveRolesTo) {
        departments.delete(JwtPrincipal.of(jwt), id, moveRolesTo);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- 직급

    @GetMapping("/roles")
    public List<RoleResponse> roles(@AuthenticationPrincipal Jwt jwt) {
        return roles.list(JwtPrincipal.of(jwt));
    }

    @PostMapping("/roles")
    public ResponseEntity<RoleResponse> createRole(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody RoleCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roles.create(JwtPrincipal.of(jwt), request));
    }

    /** 이름 · 부서 · 회사 권한 · 범위 · 탭을 통째로 저장한다. 화면의 「저장하기」다. */
    @PutMapping("/roles/{id}")
    public RoleResponse updateRole(
            @AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody RoleUpdateRequest request) {
        return roles.update(JwtPrincipal.of(jwt), id, request);
    }

    /** 구성원이 있으면 {@code moveMembersTo} 로 옮길 직급을 함께 준다. 없으면 409 {@code ROLE_HAS_MEMBERS}. */
    @DeleteMapping("/roles/{id}")
    public ResponseEntity<Void> deleteRole(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable long id,
            @RequestParam(required = false) Long moveMembersTo) {
        roles.delete(JwtPrincipal.of(jwt), id, moveMembersTo);
        return ResponseEntity.noContent().build();
    }
}
