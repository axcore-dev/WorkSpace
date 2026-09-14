package com.axcore.workspace.user.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.axcore.workspace.user.entity.User;
import org.junit.jupiter.api.Test;

/** 순수 규칙만 — 설정 유무와 계정 대조. DB 없이 돈다. */
class DemoAccountTest {

    @Test
    void 둘_중_하나라도_비면_꺼진_것이다() {
        assertFalse(new DemoAccount("", "").configured());
        assertFalse(new DemoAccount("demo@example.com", "").configured());
        assertFalse(new DemoAccount("", "Pa55word!").configured());
        assertTrue(new DemoAccount("demo@example.com", "Pa55word!").configured());
    }

    @Test
    void 이메일은_정규화해_대조한다() {
        DemoAccount demo = new DemoAccount("  Demo@Example.COM ", "Pa55word!");
        assertEquals(User.normalizeEmail("Demo@Example.COM"), demo.email());
        assertTrue(demo.is(User.create(User.normalizeEmail("demo@example.com"), "hash", "데모")));
        assertFalse(demo.is(User.create("other@example.com", "hash", "다른 사람")));
    }

    @Test
    void 설정이_없으면_누구도_데모_계정이_아니다() {
        assertFalse(new DemoAccount("", "").is(User.create("demo@example.com", "hash", "데모")));
    }
}
