# 브랜치 명명 규칙

## 기준 브랜치

| 브랜치 | 역할 |
| --- | --- |
| `main` | 릴리스 브랜치. 직접 커밋하지 않는다. |
| `dev` | **기본(default) 브랜치.** 모든 작업 브랜치는 여기서 따고, 여기로 병합한다. |

## 형식

```
<최상위 폴더>/<작업 유형>/<기능 내용>
```

- **최상위 폴더** — 작업하는 최상위 디렉터리 이름을 그대로 쓴다. 대문자.
  - `FE` / `BE` / `INFRA` / `AI`
  - `ROOT` — 위 네 폴더 안이 하나도 바뀌지 않고 저장소 루트 파일만 고칠 때 쓴다.
    `CLAUDE.md`, `.gitignore`, `.github/`, `docs/`, `.claude/` 같은 것들이다.
    폴더 이름이 아니라 "루트"라는 위치를 가리키는 예외값이다.
  - 여러 영역에 걸치면 변경의 무게중심이 있는 쪽을 쓴다.
- **작업 유형** — 소문자. 커밋 타입(`docs/commit/commit-convention.md`)과 같은 어휘를 쓴다.
  - `feature` / `fix` / `refactor` / `docs` / `style` / `test` / `chore` / `hotfix`
  - 커밋의 `feat`에 대응하는 브랜치 유형은 `feature`로 쓴다.
- **기능 내용** — 영문 소문자 + 하이픈(kebab-case). 무엇을 하는 브랜치인지 알 수 있게 2~4 단어.

## 예시

```
BE/feature/purchase-order-api
AI/refactor/graph-query-pipeline
FE/fix/inventory-tab-overflow
FE/feature/safety-stock-view
INFRA/chore/github-actions-setup
ROOT/docs/claude-md-team-rules
ROOT/chore/gitignore-cleanup
```

## 브랜치 생성 절차

브랜치를 만들기 전에 **항상** 원격을 먼저 당긴다. 낡은 로컬 `dev` 위에서 브랜치를 따면 나중에 불필요한 충돌·머지 커밋이 생긴다.

```bash
git checkout dev
git pull origin dev
git checkout -b FE/feature/safety-stock-view
```

## 현재 상태 메모

- 2026-08-26 기준 원격(`origin`)에 `dev`가 있고 GitHub default 브랜치로 지정돼 있다. 위 규칙대로 운영 가능한 상태다.
- 저장소는 `axcore-dev/WorkSpace`다. 이전 URL(`Paaaaang/axpoint-demo`)로 remote가 잡혀 있으면 아래로 갱신한다.

  ```bash
  git remote set-url origin https://github.com/axcore-dev/WorkSpace.git
  ```
