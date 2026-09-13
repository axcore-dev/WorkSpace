-- 재고·물류 — 거래처 · 품목 · 발주 · 입출고 이력 · 기준.
--
-- 화면(FE/components/inventory)과 `FE/lib/inventory-api.ts` 가 이미 부르고 있는 `/api/workspace/inventory/*`
-- 의 저장소다. 모델은 `FE/data/inventory.ts` 를 그대로 옮겼다.
--
-- 결정
--   - **재고 수량을 저장하지 않는다.** `기초(as_of) + Σ 이력(as_of 이후)` 로 파생한다(FE `lib/inventory-state.ts`
--     `stockOf` 와 같은 계산). 수량 칸을 따로 두면 이력과 어긋난 순간 어느 쪽이 맞는지 알 수 없다.
--   - 발주 라인이 입고 누계(received)와 판정을 직접 갖는다. 검수 표를 따로 두지 않는다(스펙의 「검수 카드 없음」).
--   - 발주 라인은 발주 시점 표기 스냅샷(name_at_order …)을 갖는다 — 품목 마스터를 고쳐도 출력한 발주서와
--     화면이 어긋나면 안 된다.
--   - 이력 시각은 `timestamp`(타임존 없음)다. 화면이 분 단위 문자열(`2026-06-30T14:20`)을 그대로 주고받고,
--     timestamptz 로 두면 서버 · 브라우저 타임존에 따라 날짜가 하루 밀린다.
--   - 표 이름에 `inv_` 를 붙인다. 테넌트 스키마에 `vendors` · `items` 같은 흔한 이름을 그대로 두면 다음 모듈과
--     부딪힌다(경영지원이 `payroll_runs` 로 붙인 것과 같은 이유).
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙).

-- ─────────────────────────────────────────────── 거래처

CREATE TABLE inv_vendors (
    id             varchar(50)  PRIMARY KEY,           -- 'v-powertec'. 화면이 만드는 slug 라 서버가 바꾸지 않는다
    name           varchar(100) NOT NULL,
    kind           varchar(20)  NOT NULL CHECK (kind IN ('parts', 'material', 'outsourcing', 'inhouse')),
    initial        varchar(10)  NOT NULL DEFAULT '',   -- 관리번호 조각. 자체 제작은 빈 문자열
    lead_time_days integer      CHECK (lead_time_days >= 0),  -- null = 기한 넘김을 판단하지 않는다
    owner_name     varchar(100) NOT NULL DEFAULT '',
    active         boolean      NOT NULL DEFAULT true,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    updated_at     timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE inv_vendors IS '거래처. kind: parts(자재·부품) · material(소재) · outsourcing(외주 가공) · inhouse(자체 제작).';
COMMENT ON COLUMN inv_vendors.lead_time_days IS '발주 → 입고 기대 일수. null 이면 기한 넘김 판단을 하지 않는다(「만들기」로 생긴 거래처).';

-- ─────────────────────────────────────────────── 품목

CREATE TABLE inv_items (
    code         varchar(50)  PRIMARY KEY,             -- 'ITM-GS-0014'
    name         varchar(100) NOT NULL,
    spec         varchar(100) NOT NULL DEFAULT '',
    size_text    varchar(100) NOT NULL DEFAULT '',     -- 'size' 는 예약어가 아니지만 함수명과 겹쳐 혼동을 준다
    unit         varchar(20)  NOT NULL DEFAULT 'EA',
    category     varchar(50)  NOT NULL DEFAULT '',
    location     varchar(100) NOT NULL DEFAULT '',     -- 자유 입력 한 칸. 창고·거점 개념은 없다
    discontinued boolean      NOT NULL DEFAULT false,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now()
);

-- 품목 ↔ 거래처. sort 0 이 기본 거래처다 — 순서가 뜻이라 집합이 아니라 목록으로 둔다.
CREATE TABLE inv_item_vendors (
    item_code varchar(50) NOT NULL REFERENCES inv_items (code) ON DELETE CASCADE,
    vendor_id varchar(50) NOT NULL REFERENCES inv_vendors (id) ON DELETE CASCADE,
    sort      integer     NOT NULL DEFAULT 0,
    CONSTRAINT pk_inv_item_vendors PRIMARY KEY (item_code, vendor_id)
);
CREATE INDEX ix_inv_item_vendors_item ON inv_item_vendors (item_code, sort);

-- ─────────────────────────────────────────────── 발주

CREATE TABLE inv_purchase_orders (
    po_no        varchar(30)  PRIMARY KEY,             -- PO-YYMM-NNNN, 달마다 0001 부터. 서버가 정한다
    ordered_on   date         NOT NULL,
    vendor_id    varchar(50)  NOT NULL REFERENCES inv_vendors (id),
    project_code varchar(100) NOT NULL DEFAULT '',     -- 귀속 관리번호
    drawing      varchar(100) NOT NULL DEFAULT '',
    rev          varchar(20)  NOT NULL DEFAULT '',
    requester    varchar(100) NOT NULL DEFAULT '',
    closed_on    date,                                 -- 잔량을 남긴 채 마감한 날. 있으면 입고 완료로 본다
    created_by   uuid         REFERENCES shared.users (id) ON DELETE SET NULL,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_inv_purchase_orders_vendor ON inv_purchase_orders (vendor_id);

CREATE TABLE inv_po_lines (
    id            bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    po_no         varchar(30)  NOT NULL REFERENCES inv_purchase_orders (po_no) ON DELETE CASCADE,
    line_no       varchar(10)  NOT NULL,               -- 발주서의 줄 번호('30'). 회사마다 체계가 달라 문자열이다
    item_code     varchar(50)  NOT NULL REFERENCES inv_items (code),
    name_at_order varchar(100) NOT NULL DEFAULT '',
    spec_at_order varchar(100) NOT NULL DEFAULT '',
    size_at_order varchar(100) NOT NULL DEFAULT '',
    ordered       integer      NOT NULL CHECK (ordered > 0),
    received      integer      NOT NULL DEFAULT 0 CHECK (received >= 0),  -- 합격 입고 누계. 불합격은 세지 않는다
    judgement     varchar(10)  CHECK (judgement IN ('pass', 'fail')),
    note          varchar(200) NOT NULL DEFAULT '',
    sort          integer      NOT NULL DEFAULT 0,
    CONSTRAINT uq_inv_po_lines_no UNIQUE (po_no, line_no)
);
CREATE INDEX ix_inv_po_lines_po ON inv_po_lines (po_no, sort, id);
CREATE INDEX ix_inv_po_lines_item ON inv_po_lines (item_code);

-- ─────────────────────────────────────────────── 입출고 이력

-- 서버가 만드는 이력 id 의 일련번호. 시드가 넣는 고정 id('m-0101')와 섞이지 않게 접두어를 달리한다('mv-').
CREATE SEQUENCE inv_movement_seq START 1;

CREATE TABLE inv_movements (
    id        varchar(30)  PRIMARY KEY,
    moved_at  timestamp(0) NOT NULL,                   -- 분 단위. 타임존 없음(위 결정 참고)
    item_code varchar(50)  NOT NULL REFERENCES inv_items (code) ON DELETE CASCADE,
    kind      varchar(10)  NOT NULL CHECK (kind IN ('in', 'out', 'adjust', 'baseline')),
    qty       integer      NOT NULL,                   -- 부호 있는 증감. baseline 은 새 기초값이라 합산하지 않는다
    actor     varchar(100) NOT NULL DEFAULT '',
    ref       varchar(100) NOT NULL DEFAULT '',        -- 관리번호 · 발주번호 · 사유
    note      varchar(200) NOT NULL DEFAULT '',
    po_no     varchar(30)  REFERENCES inv_purchase_orders (po_no) ON DELETE SET NULL,
    judgement varchar(10)  CHECK (judgement IN ('pass', 'fail')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_inv_movements_item ON inv_movements (item_code, moved_at DESC);
CREATE INDEX ix_inv_movements_at ON inv_movements (moved_at DESC, id DESC);

-- ─────────────────────────────────────────────── 기준

CREATE TABLE inv_item_standards (
    item_code varchar(50) PRIMARY KEY REFERENCES inv_items (code) ON DELETE CASCADE,
    baseline  integer     NOT NULL DEFAULT 0,
    -- 이 날 이후의 이력만 기초 위에 쌓인다. null 은 「처음부터」 — 화면은 빈 문자열로 받고
    -- 이력 전체를 센다(FE lib/inventory-state.ts stockOf 의 문자열 비교와 같은 뜻이다).
    as_of     date,
    safety    integer     CHECK (safety >= 0)          -- null = 담당자 미설정
);

-- 회사에 하나뿐인 설정. 한 행만 있게 id 로 못 박는다(경영지원의 monthly_pl 처럼 표를 따로 두는 대신).
CREATE TABLE inv_settings (
    id              boolean     PRIMARY KEY DEFAULT true CHECK (id),
    safety_method   varchar(20) NOT NULL DEFAULT 'manual' CHECK (safety_method IN ('leadTimeAvg', 'manual')),
    avg_window_days integer     NOT NULL DEFAULT 30 CHECK (avg_window_days > 0),
    -- 문서 규칙은 조각 순서 · 구분자 · 양식 목록이 통째로 한 덩어리다. 칸으로 쪼개면 화면이 쓰는 모양으로
    -- 되돌리는 코드만 늘어난다. 값의 형태는 서버(DocRulesDto)가 검증한다.
    doc_rules       jsonb       NOT NULL,
    updated_by      uuid        REFERENCES shared.users (id) ON DELETE SET NULL,
    updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE inv_settings IS '회사 하나의 재고 기준. 행이 없으면 서버가 기본값(수동 · 30일 · 기본 문서 규칙)을 돌려준다.';
