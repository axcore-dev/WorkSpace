package com.axcore.workspace.workspace.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;

import org.junit.jupiter.api.Test;

/**
 * 담당자 = 소유자 규칙의 기준이 되는 이메일 판정. DB 없이 돈다.
 *
 * <p>초대 수락 시 소유자를 줄지({@code WorkspaceInvitationService#accept})와 담당자 변경 감지
 * ({@code WorkspaceContactService#update})가 전부 이 두 메서드에 걸려 있다.
 */
class WorkspaceContactEmailTest {

    private static Workspace workspace(String linkEmail, String contactEmail) {
        Workspace w = Workspace.open("주식회사 테스트", "1234567890");
        w.updateContacts("링크담당", linkEmail, "연락담당", contactEmail, "010-0000-0000", Set.of());
        return w;
    }

    @Test
    void 접속_링크_담당_이메일이_있으면_그쪽이_담당자다() {
        Workspace w = workspace(" Link@Example.com ", "contact@example.com");
        assertEquals("link@example.com", w.contactEmailNormalized());
    }

    @Test
    void 접속_링크_담당이_비면_연락_담당으로_넘어간다() {
        assertEquals("contact@example.com", workspace(null, "Contact@Example.com").contactEmailNormalized());
        assertEquals("contact@example.com", workspace("   ", "contact@example.com").contactEmailNormalized());
    }

    @Test
    void 둘_다_비면_담당자가_없다() {
        assertNull(workspace(null, null).contactEmailNormalized());
        assertNull(workspace("", " ").contactEmailNormalized());
    }

    @Test
    void 대소문자와_공백을_무시하고_담당자인지_판정한다() {
        Workspace w = workspace(null, "owner@example.com");
        assertTrue(w.isContactEmail("Owner@Example.COM"));
        assertTrue(w.isContactEmail("  owner@example.com "));
        assertFalse(w.isContactEmail("someone@example.com"));
        assertFalse(w.isContactEmail(null));
    }

    @Test
    void 담당자가_없으면_아무도_담당자가_아니다() {
        Workspace w = workspace(null, null);
        assertFalse(w.isContactEmail("anyone@example.com"));
        assertFalse(w.isContactEmail(null));
    }
}
