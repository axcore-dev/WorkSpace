# WorkSpace 디자인 시스템

WorkSpace 데모의 시각 언어와 공용 컴포넌트 규칙. 코드가 단일 소스이며, 이 문서는 그 인덱스다.

| 소스 | 역할 |
| --- | --- |
| `app/globals.css` | 디자인 토큰 (색·폰트), 전역 스타일 |
| `components/ui.tsx` | 공용 컴포넌트 + `FIELD`/`TONE_TEXT` 공유 상수 |
| `lib/palette.ts` | 차트 시리즈 색상 팔레트 |
| `components/modal.tsx`, `record-modal.tsx` | 다이얼로그 — `Modal` / `RecordModal`·`MembersModal` |
| `components/charts.tsx` | 순수 SVG 차트 |
| `components/icons.tsx`, `brand-icons.tsx`, `logo.tsx` | 인라인 아이콘 + `ICON_MAP` / 외부 서비스 아이콘 / 브랜드 로고 |

## 원칙 — 무채색 우선

기본은 무채색(slate). 메인 컬러(블루)는 **주요 액션·링크·강조 등 중요한 순간에만** 사용한다.

- 상태/심각도는 **옅은 색 텍스트로만** 구분한다. 배경 채움·알약(pill) 배지를 쓰지 않는다.
- 아이콘·배지에 컬러 배경을 넣지 않는다. (`AiBadge`는 무채색 외곽선 태그)
- 토글 ON, 프로그레스 바 등 중립 상태 표시는 다크 슬레이트를 쓴다. 블루 아님.

## 색 토큰

브랜드: **AXCORE Electric Blue `#0A50FF`** = `primary-600`. `globals.css`의 `@theme`에 `primary-50 ~ 950` 단계가 정의되어 있고 Tailwind 클래스(`bg-primary-600` 등)로 사용한다.

무채색은 Tailwind `slate` 스케일을 그대로 쓴다. 관례:

| 용도 | 클래스 |
| --- | --- |
| 본문/제목 텍스트 | `text-slate-900` |
| 보조 텍스트 | `text-slate-500` ~ `600` |
| 뮤트 텍스트·테이블 헤더 | `text-slate-400` |
| 카드·모달 테두리 | `border-slate-200` (모달 내부 구분선은 `slate-100`) |
| 입력 필드 테두리 | `border-slate-300`, focus 시 `slate-400` |
| 본문(페이지) 배경 | `bg-white` — 카드는 테두리로만 구분 |
| 사이드 패널 배경 | `bg-slate-100` (활성 메뉴는 `bg-white` + `ring-slate-200`) |
| 인증 카드 화면 배경 | `bg-slate-50` |

### 상태 톤 (`Tone`)

`data/types.ts`의 `Tone` 타입과 `ui.tsx`의 `TONE_TEXT` 맵이 단일 소스.

| Tone | 렌더링 | 의미 |
| --- | --- | --- |
| `green` | `text-emerald-600` | 정상·완료·증가(긍정) |
| `amber` | `text-amber-600` | 경고·지연·주의 |
| `red` | `text-red-600` | 이상·중단·실패 |
| `slate` | `text-slate-500` | 중립 |
| `violet`, `blue` | `text-slate-600` | 카테고리성 → 무채색으로 강등 |

### 차트 팔레트 (`lib/palette.ts`)

차트 컴포넌트는 색을 props로만 받으므로, 데이터 정의에서 hex를 직접 쓰지 말고 `CHART`를 참조한다.

| 키 | 값 | 용도 |
| --- | --- | --- |
| `CHART.primary` | `#0a50ff` | 주 시리즈 (실적 등) |
| `CHART.primary400/300/200` | 밝기 단계 | 도넛 등 다중 세그먼트 |
| `CHART.neutral` | `#cbd5e1` | 비교·계획 시리즈 |
| `CHART.muted` | `#e2e8f0` | 잔여·기타 세그먼트 |
| `CHART.neutral400` | `#94a3b8` | 스파크라인 등 소형 차트 라인 |
| `CHART.amber` / `CHART.red` | amber/red-500 | 경고·이상 상태 시리즈 |

## 타이포그래피

- 폰트: **Pretendard Variable** (CDN), `--font-sans`으로 등록. 숫자는 `font-feature-settings: "tnum"`으로 고정폭.
- 페이지 제목 `text-2xl font-bold tracking-tight`, 섹션 제목 `text-[15px] font-semibold`(`SectionHeader`), 본문 `text-sm`, 보조 `text-xs`.

## 모양·간격 컨벤션

- 카드 `rounded-xl`, 모달 `rounded-2xl`, 버튼·입력 `rounded-lg`.
- 그림자는 모달(`shadow-2xl`)에만. 카드는 테두리로만 구분한다.
- 카드 패딩 `p-5`, 모달 헤더/푸터 `px-5`.
- 전환은 `transition-colors duration-200` 수준의 절제된 효과만. `prefers-reduced-motion` 대응이 전역에 있다.

## 공용 컴포넌트 (`components/ui.tsx`)

| 컴포넌트 | 용도 | 비고 |
| --- | --- | --- |
| `Button` | 액션 버튼 | `primary`(블루) / `secondary` / `ghost` / `danger` × `sm/md/lg` |
| `Card` | 콘텐츠 컨테이너 | `padding=false`로 내부 직접 제어 |
| `Badge` | 상태 텍스트 | `Tone` 기반, 배경 없음 |
| `AiBadge` | AI 기능 표기 | 무채색 외곽선 태그 |
| `Stat` | KPI 숫자 카드 | delta 화살표 + 톤 |
| `DataTable` | 데이터 테이블 | `onRowClick`으로 행 상세(`RecordModal`) 연결 |
| `WizardSteps` | 다단계 폼 진행 표시 | 완료 = 다크 슬레이트, 현재 = `primary-600` |
| `Toggle` | 스위치 | ON = 다크 슬레이트 |
| `ProgressBar` | 진행률 | 톤별 색, 중립은 다크 슬레이트 |
| `SectionHeader` | 섹션 제목/설명/액션 | |
| `EmptyState` | 빈 상태 | 점선 테두리 |
| `FIELD` (상수) | 입력 필드 공용 클래스 | 로그인·설정·모달 폼에서 import해 사용 |
| `isPersonalEmail` (유틸) | 개인 메일 도메인 판별 | 업무용 메일 지향 안내 (로그인·회원가입) |

보조 — 다이얼로그: `Modal`(sm~xl, ESC 닫기 · `modal.tsx`), `RecordModal`(행 상세)·`MembersModal`(둘 다 `record-modal.tsx`).

차트(`charts.tsx`, 의존성 없는 순수 SVG): `LineChart`·`BarChart`(막대별 색 `perBarColors` — 예측 구간 연하게)·`ComboChart`(막대+선 혼합)·`DonutChart`·`GaugeChart`·`Sparkline`(KPI 카드용 미니 라인 — `color` **필수**, 기본값 없음)·`ChartFromSpec`(`ChartSpec.type`으로 위 차트를 분기 렌더).

브랜드·아이콘: `Logo`(PNG, 종횡비 3.87:1 — height 기준 지정, flex 컨테이너에서 stretch되지 않게 주의), `Icon*` + `ICON_MAP`(인라인 SVG, `icons.tsx`), `BrandIcon` + `BRANDS`(외부 서비스 로고, `brand-icons.tsx`).

AI 표현(전역 CSS, `globals.css`): `.shimmer-text`(추론 로딩 쉬머). AI 관련 표면에만 사용한다. AI대화는 프로필/아바타 없이 텍스트만으로 표현한다(ChatGPT·Gemini식 심플 레이아웃).

## 접근성

- 포커스는 `focus-visible:outline-2 focus-visible:outline-offset-2`로 표시.
- 토글은 `role="switch"` + `aria-checked`, 모달은 `role="dialog"` + `aria-modal`, 차트 SVG는 `role="img"` + `aria-label`.
- 새 인터랙션 요소를 만들 때 이 패턴을 따른다.

## 새 화면을 만들 때

1. 색은 slate + `Tone`으로 시작하고, 블루는 화면당 1~2곳(주 CTA·핵심 링크)으로 제한한다.
2. 컴포넌트는 `ui.tsx`에서 먼저 찾고, 없으면 여기에 추가한 뒤 이 문서에 한 줄 등록한다.
3. 폼 입력은 `FIELD`, 차트 색은 `CHART`를 import한다 — 클래스 문자열·hex 복붙 금지.
