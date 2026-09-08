package com.axcore.workspace.workspace.settings.dto;

import java.util.List;

/**
 * 이메일 초대 결과 — 주소마다 보냈는지, 왜 건너뛰었는지. 한 줄이 잘못됐다고 전체를 막지 않고, 몰래 건너뛰지도 않는다.
 *
 * @param status {@code sent} · {@code skipped}
 * @param reason 건너뛴 이유. {@code sent} 면 null
 */
public record MemberInviteResult(List<Line> results) {

    public record Line(String email, String status, String reason) {}
}
