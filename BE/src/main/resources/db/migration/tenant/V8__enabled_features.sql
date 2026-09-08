-- 회사가 켠 기능(모듈)과 그 하위 탭.
--
-- 설정 › 워크스페이스 › 기능 관리 화면의 저장소다. 지금까지는 브라우저 localStorage 에만 있어서
-- 브라우저를 바꾸면 사라졌고, 사이드바·AI 답변 범위(ModuleAccessReader)가 회사의 설정을 알 길이 없었다.
--
-- 한 행이 탭 하나다. 모듈 ON/OFF 는 따로 저장하지 않는다 — "그 모듈의 탭이 하나라도 켜져 있는가" 로
-- 파생한다. 화면(FE components/module-provider.tsx)이 이미 그렇게 계산하고 있고, 두 값을 따로 두면
-- 모듈은 켜졌는데 탭은 전부 꺼진 상태가 생긴다.
--
-- 행이 없는 탭은 기본값이다. 기본 ON 집합은 코드(FeatureCatalog)가 정한다 — 카탈로그(모듈·탭 목록)를
-- DB 에 두지 않기로 했으므로 기본값도 같은 자리에 둔다. 그래서 회사를 새로 열 때 심는 데이터가 없다.
--
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙). AI 서버 역할(axcore_ai)에는 권한을 주지 않는다 —
-- 이 표는 BE 만 읽고, AI 서버는 introspect 응답의 modules 로 결과만 받는다.

CREATE TABLE enabled_features (
    module_slug    varchar(50)                 NOT NULL,
    subfunction_id varchar(50)                 NOT NULL,
    enabled        boolean                     NOT NULL DEFAULT true,
    -- 마지막으로 바꾼 사람. 감사 로그가 생기기 전까지의 최소 기록이다. 계정이 지워져도 행은 남는다.
    updated_by     uuid,
    updated_at     timestamp(6) with time zone NOT NULL,
    CONSTRAINT pk_enabled_features PRIMARY KEY (module_slug, subfunction_id),
    CONSTRAINT fk_enabled_features_updated_by FOREIGN KEY (updated_by)
        REFERENCES shared.users (id) ON DELETE SET NULL,
    -- slug 는 코드의 카탈로그가 검증하지만, 형태만은 DB 도 본다.
    CONSTRAINT ck_enabled_features_module CHECK (module_slug ~ '^[a-z][a-z0-9_-]*$'),
    CONSTRAINT ck_enabled_features_tab    CHECK (subfunction_id ~ '^[a-z][a-z0-9_-]*$')
);

COMMENT ON TABLE  enabled_features IS '회사가 켠 기능 탭. 행이 없는 탭은 코드의 기본값(FeatureCatalog)을 따른다. 모듈 ON/OFF 는 탭에서 파생한다.';
COMMENT ON COLUMN enabled_features.module_slug    IS 'FE/data/modules.ts · BE FeatureCatalog 의 모듈 slug (management · design · …).';
COMMENT ON COLUMN enabled_features.subfunction_id IS '그 모듈 안의 탭 id (hr · payroll · drawings · …).';
