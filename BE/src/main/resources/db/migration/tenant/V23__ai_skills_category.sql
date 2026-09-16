-- 회사 스킬의 분야 — 모달이 분야별로 묶어 보인다. 값은 FE `SKILL_CATEGORIES` 의 slug(doc · data · production · purchase · other).
-- 목록은 코드가 단일 소스라 여기서는 모양만 본다. 이미 있는 행은 「기타」 로 둔다.
ALTER TABLE ai_skills ADD COLUMN category varchar(30) NOT NULL DEFAULT 'other';
ALTER TABLE ai_skills ADD CONSTRAINT ck_ai_skills_category CHECK (category ~ '^[a-z]{1,30}$');

COMMENT ON COLUMN ai_skills.category IS '분야 slug (FE SKILL_CATEGORIES). 모달이 이 값으로 묶는다.';
