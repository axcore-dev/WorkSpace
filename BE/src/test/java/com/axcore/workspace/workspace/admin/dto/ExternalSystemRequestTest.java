package com.axcore.workspace.workspace.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** 외부 시스템 등록 본문의 접속 정보 규칙 — 전부 있거나 전부 없거나, 비밀번호는 저장된 것이 있으면 비워도 된다. */
class ExternalSystemRequestTest {

    private static ExternalSystemRequest req(String host, String db, String user, String pw) {
        return new ExternalSystemRequest("생산 MES", "Supabase", "MES", host, null, db, user, pw, null);
    }

    @Test
    void 접속_정보가_없으면_표시만_하는_시스템이고_문제_없음() {
        var r = req(null, null, null, null);
        assertFalse(r.linked());
        assertTrue(r.connectionProblem(false).isEmpty());
        assertEquals(5432, r.portOrDefault());
        assertEquals("require", r.sslmodeOrDefault());
    }

    @Test
    void 호스트만_적으면_짝이_안_맞아_거절() {
        var r = req("db.example.com", null, null, "x");
        assertTrue(r.linked());
        assertTrue(r.connectionProblem(false).orElseThrow().contains("모두"));
    }

    @Test
    void 등록_때는_비밀번호가_필수이고_수정_때는_저장된_것이_있으면_비워도_됨() {
        var r = req("db.example.com", "postgres", "mes_reader", "");
        assertTrue(r.connectionProblem(false).orElseThrow().contains("비밀번호"));
        assertTrue(r.connectionProblem(true).isEmpty());
    }
}
