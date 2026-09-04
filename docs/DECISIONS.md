# DECISIONS

## 2026-09-05 Timeline Resolver

- Source/Output 변환은 `@nihon-zupzup/timeline` 공개 API를 사용한다.
- 같은 anchor의 작업은 입력 순서를 유지한다. before는 삽입 직전, after는 모든 삽입 후의 Source 재개 시각이다.
- Overlay는 영상 길이를 늘리지 않는다. 요청 범위는 보존하되 최종 길이 초과 경고를 제공하고 활성 조회는 영상 끝에서 종료한다.
- 모든 출력 끝점의 안전 정수 범위를 사전 검증한다.
- Resolver 완료와 편집 명령·Undo/Redo·재생 UI 완료는 별도 추적한다.

## 2026-09-05 Caption 연결

- `@nihon-zupzup/caption`을 공통 workspace와 TypeScript 빌드에 등록한다.
- 원본 cue는 불변으로 보존하고 표시 단위는 원본 ID·시간·텍스트 위치를 참조한다.
- 최대 줄 수는 실제 단어 줄바꿈 결과로 확인하며 필요하면 표시 단위를 더 분할한다.

## 2026-09-04

### v1 제품은 니혼줍줍 전용 운영 툴
영상 생성뿐 아니라 콘텐츠 플랜, 제작, 검수, 파생 Shorts, YouTube 업로드까지 관리한다.

### 내부 Core는 범용 구조
향후 여러 채널/주제에 재사용하기 위해
Channel Pack / Content Profile을 분리한다.

### 콘텐츠 포맷은 4종
- discovery_long
- training_long
- discovery_short
- learning_short

### Long→Shorts는 독립 기능
단순 Crop이 아니라 Hook/Scene/Layout을 Shorts용으로 재구성한다.

### Content Manager 도입
8주 플랜, 주간 일정, 제작 상태, Long/Short 관계, 선제 제작 상태를 관리한다.

### YouTube Publishing 도입
최종 렌더 이후 프로그램 안에서 메타데이터 검수와 업로드까지 이어진다.

### Remotion은 메인 영상 엔진
### Electron은 데스크톱 Shell
### production.json과 overrides.json은 분리
### ANIME_CLIP/DRAMA_CLIP은 Insert
### Windows 우선 + 크로스플랫폼 호환
### GitHub 공개 + 자동 업데이트
### Codex 멀티쓰레드 개발

### 내부 시간 계약은 정수 microsecond
모든 내부 시간 범위는 `TimeUs`와 반열림 구간 `[startUs, endUs)`을 사용한다. millisecond/second/frame 변환은 입출력 또는 렌더 경계에서만 수행한다.

### 에셋 스키마는 단일 기계 계약 사용
`05_asset/asset-record.schema.json`을 기준으로 `kind`, 생명주기 `status`, `source.generator`를 사용한다. 애니 클립·스크린샷 등의 의미 분류는 `semanticType` 또는 태그로 분리한다.

### 상태 필드는 소유 영역별로 분리
Content Manager의 `contentStatus`, 제작 파일의 `productionStatus`, YouTube 원격 게시 상태를 서로 다른 필드와 이력으로 관리한다.

### Long→Shorts 부모 관계는 parentLongId
파생 프로젝트는 `parentLongId`, `derivativeIndex`, `derivativeReason`을 보관한다.

### Desktop v1 기준 확정
Electron Shell, Windows 11 x64 우선, GitHub Releases 배포를 사용한다. 세부 패키징·업데이트 라이브러리는 앱 골격 이후 선택한다.

### 모노레포는 npm workspaces 사용
`apps/*`와 `packages/*`를 workspace로 관리하고 잠금 파일을 추적해 재현 가능한 설치 기준을 유지한다.

### 공통 계약의 단일 공개 패키지는 @nihon-zupzup/core
후속 모듈은 루트 또는 `ids`, `errors`, `events`, `documents`, `status`, `time`, `channel-packs` 공개 하위 경로로만 공통 계약을 가져온다.

### Core ID는 prefix가 붙은 ULID 사용
프로젝트·이벤트·장면·자막·에셋 등은 의미 있는 prefix와 26자리 Crockford ULID 본문을 사용한다.

### 프로젝트 문서는 정수 schemaVersion과 revision 사용
저장은 `revision` 기반 낙관적 동시성 검사를 수행하고, 마이그레이션은 명시적인 전진 단계만 등록한다.

### 도메인 이벤트는 envelope와 멱등 전달 계약 사용
이벤트는 ID, 타입, aggregate, 발생 시각, producer, payload를 포함하며 같은 event ID의 중복·동시 수신은 한 번만 처리한다.
