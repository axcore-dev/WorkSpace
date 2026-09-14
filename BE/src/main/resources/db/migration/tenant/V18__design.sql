-- 제품설계 — 도면 · BOM.
--
-- 화면(FE/components/design)과 `FE/lib/design-api.ts` 가 부르는 `/api/workspace/design/*` 의 저장소다.
-- 모델은 `FE/data/drawings.ts` 의 `Drawing` 을 그대로 옮겼다.
--
-- 결정
--   - **리비전 하나가 도면 하나다** (2026-09-14). 키는 (code, rev). `26MSX-S03-20 Rev.B` 와 `Rev.C` 는 다른 행이고
--     Rev.C 는 Rev.B 에서 파생된 것으로 본다 — 앞 리비전은 글자 순으로 정해지므로 별도 링크는 두지 않는다. 그래서 리비전
--     표가 따로 없고, 변경 내용 · 요청 주체 · 등록일은 행마다 있으며, 옛 리비전의 BOM 도 그대로 남는다.
--     「지금 도면」은 같은 code 중 rev 가 가장 큰 행이다(`max(rev)` — 'Rev.A' < 'Rev.B' 문자열 비교로 충분하다).
--   - `docs/db/schema-draft-v2.md` 의 4표(projects · drawings · drawing_revisions · bom_lines) 중 `projects` 는 두지
--     않는다. 재고(`inv_purchase_orders.project_code`)가 이미 관리번호를 텍스트로 갖고 있어 표를 하나 더 두면
--     같은 값이 두 곳에 산다. 관리번호 허브가 필요해지는 날 `project_code` 를 FK 로 바꾼다.
--   - **`dsg_bom_lines.item_code` 가 설계 ↔ 재고의 다리다.** null 이면 「미매핑」 — 발주서 작성이 그 도면을 막는다
--     (FE `validateDraft`). 품목이 지워지면 null 로 돌아간다(다시 매핑하라는 뜻).
--   - 파생 도면(가공도)은 `parent_code` + `parent_rev` 로 근거 도면의 **특정 리비전**을 가리킨다. 원본이 개정되면 파생의
--     지금 리비전은 `review`(확인 필요)가 되고, 확인하면 `parent_rev` 가 원본의 지금 리비전으로 올라간다(FR-DR-08 역추적).
--     원본 · 파생 구분은 parent_code 가 있느냐로 정해지므로 열을 따로 두지 않는다.
--   - status 는 영문 코드다. 화면은 한글 리터럴(승인·확인 필요·폐기)을 쓰므로 서버 DTO 가 바꿔 준다.
--   - 표 이름에 `dsg_` 를 붙인다(재고의 `inv_` 와 같은 이유).
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙).

CREATE TABLE dsg_drawings (
    code         varchar(50)  NOT NULL,                -- '26MSX-S03-20'. 화면이 정한다
    rev          varchar(20)  NOT NULL,                -- 'Rev.C'. 첫 리비전은 언제나 Rev.A, 다음은 서버가 한 글자 올린다
    name         varchar(100) NOT NULL,
    parent_code  varchar(50),                          -- 파생만. 근거 도면의 code · 리비전
    parent_rev   varchar(20),
    vehicle      varchar(100) NOT NULL DEFAULT '',     -- 원본만. 다음 리비전이 이어 받는다
    project_code varchar(100) NOT NULL DEFAULT '',     -- 관리번호. 재고 발주의 project_code 와 같은 값
    has_excel    boolean      NOT NULL DEFAULT false,  -- 정제 엑셀 첨부 여부. 도면 단독 등록을 허용한다(FR-DR-01)
    author       varchar(100) NOT NULL DEFAULT '',
    status       varchar(10)  NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'review', 'discarded')),
    change_note  varchar(200) NOT NULL DEFAULT '',     -- 이 리비전의 변경 내용(FR-DR-03)
    requester    varchar(100) NOT NULL DEFAULT '',     -- 요청 주체 — 고객사 / 사내 설계
    revised_on   date         NOT NULL DEFAULT current_date,  -- 이 리비전을 등록한 날
    created_by   uuid         REFERENCES shared.users (id) ON DELETE SET NULL,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (code, rev),
    FOREIGN KEY (parent_code, parent_rev) REFERENCES dsg_drawings (code, rev),
    CONSTRAINT ck_dsg_drawings_parent CHECK ((parent_code IS NULL) = (parent_rev IS NULL))
);
CREATE INDEX ix_dsg_drawings_parent ON dsg_drawings (parent_code, parent_rev);
COMMENT ON TABLE dsg_drawings IS '도면. 리비전 하나가 한 행 — (code, rev) 가 키. parent_code 가 있으면 파생(가공도). status: approved(승인) · review(확인 필요 — 근거 도면 개정 영향) · discarded(폐기).';

CREATE TABLE dsg_bom_lines (
    id           bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    drawing_code varchar(50)  NOT NULL,
    drawing_rev  varchar(20)  NOT NULL,
    item_name    varchar(100) NOT NULL,                -- 도면 · 정제 엑셀의 표기 그대로('GUIDE POST')
    spec         varchar(100) NOT NULL DEFAULT '',     -- 호칭('MYKP')
    size_text    varchar(100) NOT NULL DEFAULT '',     -- 규격('Φ32-140L')
    qty          integer      NOT NULL CHECK (qty > 0),
    item_code    varchar(50)  REFERENCES inv_items (code) ON DELETE SET NULL,  -- 매핑된 품목. null = 미매핑
    sort         integer      NOT NULL DEFAULT 0,
    FOREIGN KEY (drawing_code, drawing_rev) REFERENCES dsg_drawings (code, rev) ON DELETE CASCADE
);
CREATE INDEX ix_dsg_bom_lines_drawing ON dsg_bom_lines (drawing_code, drawing_rev, sort, id);
CREATE INDEX ix_dsg_bom_lines_item ON dsg_bom_lines (item_code);
COMMENT ON COLUMN dsg_bom_lines.item_code IS '설계 ↔ 재고 다리. 발주서 작성은 그 도면(지금 리비전)의 미매핑 줄이 0 일 때만 진행한다.';
