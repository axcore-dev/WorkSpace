package com.axcore.workspace.design;

import com.axcore.workspace.workspace.settings.SettingsValidationException;
import java.util.Map;

/**
 * DB 코드 ↔ 화면 리터럴. 화면({@code FE/data/drawings.ts})은 한글 리터럴(승인·확인 필요·폐기)을 타입으로 쓰고, DB 는
 * 영문 코드다. 바꾸는 자리는 여기 하나다. 원본 · 파생 구분은 parent_code 유무라 코드가 없다.
 */
final class DesignCodes {

    static final String MODULE = "design";
    static final String TAB_DRAWINGS = "drawings";
    static final String TAB_BOM = "bom";

    static final String FIRST_REV = "Rev.A";
    static final String STATUS_APPROVED = "approved";
    static final String STATUS_REVIEW = "review";
    static final String STATUS_DISCARDED = "discarded";

    private static final Map<String, String> STATUS_LABEL =
            Map.of(STATUS_APPROVED, "승인", STATUS_REVIEW, "확인 필요", STATUS_DISCARDED, "폐기");

    private DesignCodes() {}

    static String statusLabel(String code) {
        return STATUS_LABEL.get(code);
    }

    /** Rev.A → Rev.B. 화면({@code nextRev})과 같은 규칙. Rev.Z 다음은 없다 — 그 전에 도면을 새로 딴다. */
    static String nextRev(String rev) {
        if (rev == null || !rev.matches("^Rev\\.[A-Y]$")) {
            throw new SettingsValidationException("리비전은 Rev.A ~ Rev.Y 에서만 올릴 수 있습니다: " + rev);
        }
        return "Rev." + (char) (rev.charAt(4) + 1);
    }
}
