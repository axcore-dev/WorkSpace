package com.axcore.workspace.management;

import com.axcore.workspace.management.dto.OrgResponse;
import com.axcore.workspace.security.JwtPrincipal;
import com.axcore.workspace.workspace.settings.TenantContext;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인사 작업대 — 조직도. 새 표 없이 members · departments · roles 를 읽어 화면 모양(회사 › 본부 › 팀 › 구성원)으로 접는다.
 *
 * <p>부서에 상하위가 없어 본부는 "본사" 하나다. 부서가 없는 구성원은 "미지정" 팀으로 보인다(설정의 구성원 화면과 같은 말).
 * 연락처(전화)는 계정에 없어서 내려주지 않는다 — 화면은 "—" 로 그린다.
 */
@Service
public class HrService {

    static final String TAB = "hr";
    static final String DIVISION = "본사";
    static final String UNASSIGNED = "미지정";
    static final String NO_HEAD = "—";

    private final ManagementAccess access;
    private final JdbcTemplate jdbc;

    public HrService(ManagementAccess access, JdbcTemplate jdbc) {
        this.access = access;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public OrgResponse org(JwtPrincipal principal) {
        TenantContext ctx = access.open(principal, TAB);

        Map<String, List<OrgResponse.Member>> members = new LinkedHashMap<>();
        jdbc.query("select name from departments order by name", rs -> {
            members.put(rs.getString(1), new ArrayList<>());
        });

        record Row(String team, String name, String rank, String email, LocalDate joined) {}
        // 정렬이 팀장 규칙이다: 소유자 → 관리자 → 이름순. 팀의 첫 사람이 head 가 된다.
        List<Row> rows =
                jdbc.query(
                        """
                        select d.name, u.name, r.name, u.email, m.created_at::date
                          from members m
                          join shared.users u on u.id = m.user_id
                          left join roles r on r.id = m.role_id
                          left join departments d on d.id = m.department_id
                         where m.status <> 'left'
                         order by coalesce(r.code = 'owner', false) desc, coalesce(r.is_admin, false) desc, u.name, u.email
                        """,
                        (rs, i) ->
                                new Row(
                                        rs.getString(1),
                                        rs.getString(2),
                                        rs.getString(3),
                                        rs.getString(4),
                                        rs.getObject(5, LocalDate.class)));
        for (Row r : rows) {
            String team = r.team() == null ? UNASSIGNED : r.team();
            members.computeIfAbsent(team, k -> new ArrayList<>())
                    .add(new OrgResponse.Member(r.name(), r.rank() == null ? NO_HEAD : r.rank(), r.email(), r.joined()));
        }

        List<OrgResponse.Team> teams = new ArrayList<>();
        members.forEach(
                (team, list) ->
                        teams.add(new OrgResponse.Team(team, list.isEmpty() ? NO_HEAD : list.get(0).name(), list.size())));
        return new OrgResponse(
                ctx.workspaceName(), List.of(new OrgResponse.Division(DIVISION, teams)), members);
    }
}
