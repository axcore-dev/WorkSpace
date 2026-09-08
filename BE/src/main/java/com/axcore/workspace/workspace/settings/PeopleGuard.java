package com.axcore.workspace.workspace.settings;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 초대 · 초대 링크 · 소속 변경이 함께 쓰는 검증 — 줄 직급·부서가 존재하는가, 그리고 <b>소유자 직급은 아무도 줄 수 없다</b>
 * (소유자는 회사에 한 명이고 담당자 규칙으로만 옮겨 간다). 부르는 쪽은 이미 {@link TenantContext#requireOwner} 를 통과한 소유자다.
 *
 * <p><b>테넌트 스키마가 열린 트랜잭션 안에서만 부를 수 있다.</b>
 */
@Component
public class PeopleGuard {

    private final JdbcTemplate jdbc;

    public PeopleGuard(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 검증을 통과한 직급 id 를 돌려준다. */
    public long requireAssignableRole(Long roleId) {
        if (roleId == null) {
            throw new SettingsValidationException("직급을 골라 주세요");
        }
        String code =
                jdbc.query("select code from roles where id = ?", (rs, i) -> rs.getString(1), roleId).stream()
                        .findFirst()
                        .orElseThrow(() -> new SettingsNotFoundException("직급을 찾을 수 없습니다"));
        if ("owner".equals(code)) {
            throw new SettingsForbiddenException("소유자 직급은 줄 수 없습니다");
        }
        return roleId;
    }

    /** 검증을 통과한 부서 id(없음이면 null)를 돌려준다. */
    public Long requireAssignableDepartment(Long departmentId) {
        if (departmentId != null) {
            Integer n = jdbc.queryForObject("select count(*) from departments where id = ?", Integer.class, departmentId);
            if (n == null || n == 0) {
                throw new SettingsNotFoundException("부서를 찾을 수 없습니다");
            }
        }
        return departmentId;
    }

    /** 직급 id → 이름. 초대·링크 목록이 shared 의 id 를 테넌트 이름으로 바꿀 때 쓴다. */
    public Map<Long, String> roleNames() {
        Map<Long, String> m = new HashMap<>();
        jdbc.query("select id, name from roles", rs -> {
            m.put(rs.getLong(1), rs.getString(2));
        });
        return m;
    }

    public Map<Long, String> departmentNames() {
        Map<Long, String> m = new HashMap<>();
        jdbc.query("select id, name from departments", rs -> {
            m.put(rs.getLong(1), rs.getString(2));
        });
        return m;
    }
}
