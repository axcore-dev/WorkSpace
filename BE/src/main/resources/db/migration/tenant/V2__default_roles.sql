-- 기본 역할 · 기본 부서 심기.
--
-- 프로비저닝 흐름의 "기본 데이터 심기" 단계다. 코드가 아니라 마이그레이션으로 두는 이유는
-- 프로비저닝과 순회 배포가 같은 스크립트를 쓴다는 성질을 지키기 위해서다. 심는 일을 코드로
-- 빼면 신규 회사와 기존 회사가 갈라진다.
--
-- 회사를 연 직후 관리자가 없으면 아무도 구성원을 초대할 수 없다. 그래서 최소 세 역할을
-- 미리 만들어 둔다. 이름은 회사가 바꿀 수 있고(is_system 은 삭제만 막는다), 필요하면 역할을
-- 더 만들 수 있다.

INSERT INTO roles (code, name, is_admin, can_invite, is_system, created_at, updated_at)
VALUES
    -- 회사를 연 사람이 받는 역할. 관리자 권한과 초대 권한을 모두 갖는다.
    ('owner',  '소유자',   true,  true,  true, now(), now()),
    -- 관리자. 소유자와 권한은 같지만 소유자는 회사당 한 명이라는 뜻을 남기려고 나눠 둔다.
    ('admin',  '관리자',   true,  true,  true, now(), now()),
    -- 일반 구성원. 초대할 수 없다 — "초대는 관리자·팀장만" 이 기본값이고, 팀장 역할이
    -- 필요하면 회사가 can_invite 만 켠 역할을 따로 만든다.
    ('member', '구성원',   false, false, true, now(), now());

-- 부서를 하나도 만들지 않으면 구성원 등록 화면의 부서 선택이 빈 목록이 된다. 회사가 실제
-- 조직을 넣기 전까지 쓸 자리를 하나 둔다.
INSERT INTO departments (name, created_at, updated_at)
VALUES ('미지정', now(), now());
