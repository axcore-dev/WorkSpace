-- 경영지원 — 급여 · 회계 표. 인사는 기존 members · departments · roles 를 그대로 읽는다(표를 더 만들지 않는다).
--
-- 결정(2026-09-10):
--   - 화면(FE/components/management)이 이미 그리는 것만 표로 만든다. 계정과목 표 · 원장 · 근태 · 휴가는 아직 없다.
--   - 상태 · 종류는 영문 코드로 저장하고 화면 표기(처리 대기 …)는 서버가 붙인다(members.status 와 같은 방식).
--   - 금액은 원 단위 bigint. 회차의 총액 · 공제 · 실지급은 항목(payroll_items)에서 계산한다 — 두 벌로 두지 않는다.
--   - 전표 작성자는 이름 스냅샷(owner_name)이다. 구성원이 회사를 떠나도 전표는 그대로 남아야 한다.
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙).

-- ─────────────────────────────────────────────── 급여

CREATE TABLE payroll_runs (
    id          varchar(30)  PRIMARY KEY,          -- '2026-07' · '2026-07-2' · '2026-h1-bonus'
    name        varchar(100) NOT NULL,
    headcount   integer      NOT NULL CHECK (headcount >= 0),
    pay_date    date         NOT NULL,
    status      varchar(20)  NOT NULL CHECK (status IN ('pending', 'vouchered', 'rejected', 'paid')),
    voucher_no  varchar(20),                       -- 회차에서 만든 전표. FK 는 vouchers 뒤에 건다
    paid_at     date,
    created_by  uuid REFERENCES shared.users (id) ON DELETE SET NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE payroll_runs IS '급여 회차. status: pending(처리 대기) → vouchered(전표 생성) → paid(지급 완료). 전표가 반려되면 rejected(전표 반려) → 재산출로 pending.';

CREATE TABLE payroll_items (
    id      bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id  varchar(30)  NOT NULL REFERENCES payroll_runs (id) ON DELETE CASCADE,
    label   varchar(50)  NOT NULL,
    amount  bigint       NOT NULL,                 -- 공제는 음수
    note    varchar(200) NOT NULL DEFAULT '',
    sort    integer      NOT NULL DEFAULT 0
);
CREATE INDEX ix_payroll_items_run ON payroll_items (run_id, sort);

-- ─────────────────────────────────────────────── 회계

CREATE TABLE vouchers (
    no                  varchar(20)  PRIMARY KEY,  -- V-YYMM-NNN, 달마다 001 부터
    voucher_date        date         NOT NULL,
    kind                varchar(20)  NOT NULL CHECK (kind IN ('purchase', 'sales', 'payroll')),
    counterparty        varchar(100) NOT NULL,
    summary             varchar(200) NOT NULL,
    amount              bigint       NOT NULL,
    vat                 bigint,
    account             varchar(50)  NOT NULL,     -- 대표 계정과목 이름
    owner_name          varchar(100) NOT NULL,
    status              varchar(20)  NOT NULL CHECK (status IN ('review', 'approved', 'rejected')),
    run_id              varchar(30)  REFERENCES payroll_runs (id) ON DELETE SET NULL,
    reject_reason       varchar(200),
    purchase_item       varchar(100),              -- 매입 전표의 품목(선택)
    purchase_code       varchar(50),
    purchase_qty        numeric(14, 3),
    purchase_unit       varchar(20),
    purchase_unit_price bigint,
    created_by          uuid REFERENCES shared.users (id) ON DELETE SET NULL,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now()
);
COMMENT ON TABLE vouchers IS '회계 전표. status: review(검토중) → approved(승인) | rejected(반려). 급여 전표는 run_id 로 회차를 가리킨다.';

CREATE TABLE voucher_lines (
    id          bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    voucher_no  varchar(20)  NOT NULL REFERENCES vouchers (no) ON DELETE CASCADE,
    account     varchar(50)  NOT NULL,
    debit       bigint,
    credit      bigint,
    memo        varchar(200) NOT NULL DEFAULT '',
    sort        integer      NOT NULL DEFAULT 0,
    CONSTRAINT ck_voucher_lines_one_side CHECK ((debit IS NULL) <> (credit IS NULL))
);
CREATE INDEX ix_voucher_lines_voucher ON voucher_lines (voucher_no, sort);

ALTER TABLE payroll_runs
    ADD CONSTRAINT fk_payroll_runs_voucher FOREIGN KEY (voucher_no) REFERENCES vouchers (no) ON DELETE SET NULL;

-- 월별 손익 요약. 전표에서 집계하지 않고 따로 든다 — 지금 전표는 검토 흐름용이고 매출 · 비용 전체를 담지 않는다.
CREATE TABLE monthly_pl (
    month  date    PRIMARY KEY CHECK (month = date_trunc('month', month)::date),
    sales  bigint  NOT NULL,
    cost   bigint  NOT NULL
);
