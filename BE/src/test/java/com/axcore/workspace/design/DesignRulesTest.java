package com.axcore.workspace.design;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.axcore.workspace.workspace.settings.SettingsValidationException;
import org.junit.jupiter.api.Test;

/** 순수 규칙만 — 리비전 번호와 코드 ↔ 화면 리터럴. DB 없이 돈다. 화면 `nextRev`(FE/lib/design-state.ts) 와 같은 표다. */
class DesignRulesTest {

    @Test
    void 리비전은_한_글자씩_오른다() {
        assertEquals("Rev.B", DesignCodes.nextRev(DesignCodes.FIRST_REV));
        assertEquals("Rev.D", DesignCodes.nextRev("Rev.C"));
        assertEquals("Rev.Z", DesignCodes.nextRev("Rev.Y"));
    }

    @Test
    void 규칙_밖의_리비전은_올리지_않는다() {
        assertThrows(SettingsValidationException.class, () -> DesignCodes.nextRev("Rev.Z"));
        assertThrows(SettingsValidationException.class, () -> DesignCodes.nextRev("C"));
        assertThrows(SettingsValidationException.class, () -> DesignCodes.nextRev(null));
    }

    @Test
    void 리비전_문자열은_글자_순으로_비교해도_최신이_크다() {
        // 읽기 · 쓰기 서비스가 max(rev) · order by rev desc 로 「지금 도면」을 고르는 전제
        assertEquals(true, "Rev.B".compareTo("Rev.A") > 0);
        assertEquals(true, DesignCodes.nextRev("Rev.C").compareTo("Rev.C") > 0);
    }

    @Test
    void 상태_코드는_화면_리터럴로_바뀐다() {
        assertEquals("승인", DesignCodes.statusLabel("approved"));
        assertEquals("확인 필요", DesignCodes.statusLabel("review"));
        assertEquals("폐기", DesignCodes.statusLabel("discarded"));
    }
}
