-- AI 문서 검색 품질 — 부분 일치 색인 · 문서 요약 · 임베딩 모델 기록.
--
-- 세 가지를 더한다. 셋 다 기존 데이터를 지우지 않고, 채워지지 않은 값은 검색이 알아서 건너뛴다.
--
-- 1) trigram 색인 — 조사가 붙은 낱말과 품번 일부를 잡는다. `to_tsvector('simple', ...)` 은 형태소 분석이 없어
--    "단가는" 과 "단가" 가 다른 토큰이다. 세 글자 단위 색인은 낱말 경계를 보지 않는다.
--
-- 2) 문서 요약 — "이 문서 뭐야" 같은 질문은 조각 단위 검색과 맞지 않는다. 색인할 때 모델이 한 번 만들어 두고,
--    답변 문맥의 문서 머리말로 쓴다. 만들지 못하면 NULL 이고 화면·검색은 그대로 동작한다.
--
-- 3) 임베딩 모델 기록 — 모델이 다르면 벡터를 비교할 수 없다. 어떤 모델로 만든 벡터인지 적어 두고, 검색은 지금
--    쓰는 모델로 만든 것만 벡터 비교에 넣는다. 모델을 바꿔도 옛 문서가 엉뚱하게 잡히지 않고, 재색인 전까지는
--    전문 검색·부분 일치로 계속 찾힌다. **모델 교체가 조용한 품질 저하가 되지 않게 하는 장치다.**
--
-- 이 파일에 스키마 이름을 적지 않는다(V1 규칙).

CREATE INDEX ix_ai_source_chunks_trgm ON ai_source_chunks USING gin (content public.gin_trgm_ops);

ALTER TABLE ai_source_docs
    ADD COLUMN summary         text,
    ADD COLUMN embedding_model varchar(100);

COMMENT ON COLUMN ai_source_docs.summary IS '색인 때 모델이 만든 두세 문장 요약. 답변 문맥의 문서 머리말로 쓴다. 실패하면 NULL.';
COMMENT ON COLUMN ai_source_docs.embedding_model IS '이 문서 조각의 벡터를 만든 임베딩 모델. 지금 모델과 다르면 벡터 검색에서 빠지고 전문 검색·부분 일치로만 찾힌다.';

-- 이미 색인된 문서는 text-embedding-3-small 로 만들어졌다(V3 주석의 기본값). 조각이 없는 문서는 비워 둔다.
UPDATE ai_source_docs
   SET embedding_model = 'text-embedding-3-small'
 WHERE chunk_count > 0;
