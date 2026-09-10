package com.axcore.workspace.management.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 인사 작업대의 조직도. 부서(departments)가 팀이고, 본부는 아직 한 층(회사)뿐이다 — 부서에 상하위가 없다.
 *
 * @param members 팀 이름 → 구성원. 부서가 없는 구성원은 "미지정" 팀에 든다
 */
public record OrgResponse(String company, List<Division> divisions, Map<String, List<Member>> members) {

    public record Division(String name, List<Team> teams) {}

    /** @param head 소유자 → 관리자 → 이름순 첫 사람. 아무도 없으면 "—" */
    public record Team(String name, String head, int size) {}

    /** @param rank 직급 이름 @param joined 이 회사에 합류한 날 */
    public record Member(String name, String rank, String email, LocalDate joined) {}
}
