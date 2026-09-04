# Timeline Contract

이 문서는 니혼줍줍 편집기의 타임라인 데이터, 편집 명령, 재생 범위, 시간 기반 상태에 대한 공통 계약이다. UI 프레임워크나 영속화 방식과 무관하게 동일한 규칙을 사용한다.

원본 TTS/SRT의 Source Timeline은 불변이며, 이 문서의 편집 명령은 Insert/Pause와 장면 배치를 포함하는 출력 구성에 적용한다. 최종 Output Timeline은 Source Timeline과 출력 구성을 Resolver가 결합해 파생하며 원본 시간을 덮어쓰지 않는다.

## 1. 책임과 경계

타임라인 모듈이 소유하는 것:

- 트랙과 클립의 배치 순서 및 시간 범위
- 재생 헤드, 선택 범위, 반복 재생 범위
- 이동, 자르기, 분할, 삭제, 복제와 같은 시간 편집 명령
- 스냅, 겹침, 최소 길이, 프로젝트 길이 관련 검증
- 실행 취소와 다시 실행이 가능한 원자적 변경 기록

다른 모듈이 소유하는 것:

- `Scene`: 장면의 내용과 전환 설정
- `Caption`: 자막 문구, 번역, 스타일
- `Asset`: 원본 미디어와 메타데이터
- `Theme_Motion`: 시각 스타일과 애니메이션 프리셋
- `ReviewEditor`: 검토 의견과 승인 상태

타임라인 클립은 다른 도메인의 데이터를 복제하지 않고 `sourceRef`로 참조한다.

## 2. 시간 단위

- 저장과 계산의 기준 단위는 정수 마이크로초(`TimeUs`)다.
- 화면 표시와 입력에서만 초 또는 프레임으로 변환한다.
- 부동소수점 초 값을 상태에 저장하지 않는다.
- 모든 시간 범위는 반열림 구간 `[startUs, endUs)`이다.
- `durationUs = endUs - startUs`이며 끝점에 정확히 도달하면 해당 클립은 비활성이다.

```ts
type TimeUs = number; // 정수, 0 이상, Number.MAX_SAFE_INTEGER 이하
type TimelineId = string;
type TrackId = string;
type ClipId = string;

interface TimeRange {
  startUs: TimeUs;
  endUs: TimeUs;
}
```

프레임 정렬이 필요한 출력은 프로젝트의 유리수 프레임레이트를 사용한다.

```ts
interface FrameRate {
  numerator: number;   // 예: 30000
  denominator: number; // 예: 1001
}
```

프레임 번호 `n`의 시간은 `round(n * 1_000_000 * denominator / numerator)`로 계산한다. UI에서 시간과 프레임을 왕복 변환할 때는 이 공식을 한 곳에서만 사용한다.

## 3. 영속 데이터 모델

```ts
type TrackKind = "video" | "audio" | "caption" | "scene" | "overlay";
type ClipSourceKind = "asset" | "caption" | "scene" | "generated";

interface TimelineDocument {
  schemaVersion: 1;
  id: TimelineId;
  frameRate: FrameRate;
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
  durationUs: TimeUs;
  revision: number;
}

interface TimelineTrack {
  id: TrackId;
  kind: TrackKind;
  name: string;
  order: number;
  locked: boolean;
  muted: boolean;
  hidden: boolean;
  overlapPolicy: "forbid" | "allow";
  clipIds: ClipId[];
}

interface TimelineClip {
  id: ClipId;
  trackId: TrackId;
  sourceRef: {
    kind: ClipSourceKind;
    id: string;
  };
  range: TimeRange;
  sourceInUs: TimeUs;
  sourceOutUs: TimeUs;
  playbackRate: number;
  enabled: boolean;
  linkGroupId?: string;
  metadata?: Record<string, unknown>;
}

interface TimelineMarker {
  id: string;
  atUs: TimeUs;
  label: string;
  color?: string;
}
```

`TimelineDocument`에는 클립 ID 순서만 저장하고, 클립 본문은 `clipsById: Record<ClipId, TimelineClip>` 형태로 정규화해 보관한다. 트랙의 `clipIds`는 `range.startUs`, `range.endUs`, `id` 순으로 항상 정렬한다.

`durationUs`는 사용자가 고정한 길이가 아니라면 모든 활성 클립과 마커의 최대 끝점에서 파생한다. 빈 프로젝트의 길이는 `0`이다.

## 4. 재생 전용 상태

재생 상태는 문서에 저장하지 않는다.

```ts
type PlaybackStatus = "stopped" | "playing" | "paused" | "scrubbing";

interface PlaybackState {
  status: PlaybackStatus;
  playheadUs: TimeUs;
  rate: number;
  range: TimeRange | null;
  loop: boolean;
  followPlayhead: boolean;
  lastTickAtMs: number | null;
}
```

규칙:

- 재생 시작점은 `range?.startUs ?? playheadUs`다.
- 재생 끝점은 `range?.endUs ?? document.durationUs`다.
- 끝점 도달 시 `loop=true`이면 시작점으로 이동하고, 아니면 끝점에 고정한 뒤 `paused`가 된다.
- 사용자가 드래그하는 동안 상태는 `scrubbing`이며 외부 플레이어 시간 갱신은 무시한다.
- 외부 플레이어의 실제 시각이 기준이며, 타이머 누적으로 재생 시간을 계산하지 않는다.
- 플레이어와 상태의 차이가 한 프레임보다 크면 플레이어 시각으로 보정한다.

## 5. 편집 전용 상태

```ts
interface TimelineUiState {
  selectedClipIds: ClipId[];
  selectedTrackId: TrackId | null;
  selectionRange: TimeRange | null;
  zoomPxPerSecond: number;
  scrollLeftPx: number;
  dragPreview: DragPreview | null;
}

interface DragPreview {
  clipIds: ClipId[];
  deltaUs: TimeUs;
  targetTrackId: TrackId;
  valid: boolean;
  reason?: string;
}
```

드래그 중에는 문서를 매 포인터 이동마다 수정하지 않는다. 미리보기 상태만 갱신하고, 포인터를 놓을 때 하나의 편집 명령으로 확정한다.

## 6. 편집 명령

모든 변경은 직렬화 가능한 명령 한 개로 표현한다.

```ts
type TimelineCommand =
  | { type: "clip/add"; clip: TimelineClip }
  | { type: "clip/move"; clipIds: ClipId[]; targetTrackId: TrackId; deltaUs: number; ripple: boolean }
  | { type: "clip/trim"; clipId: ClipId; edge: "start" | "end"; atUs: TimeUs; ripple: boolean }
  | { type: "clip/split"; clipIds: ClipId[]; atUs: TimeUs }
  | { type: "clip/delete"; clipIds: ClipId[]; ripple: boolean }
  | { type: "clip/duplicate"; clipIds: ClipId[]; offsetUs: TimeUs }
  | { type: "track/add"; track: TimelineTrack }
  | { type: "track/update"; trackId: TrackId; patch: Partial<Pick<TimelineTrack, "name" | "order" | "locked" | "muted" | "hidden">> }
  | { type: "track/delete"; trackId: TrackId; deleteClips: boolean }
  | { type: "marker/add"; marker: TimelineMarker }
  | { type: "marker/move"; markerId: string; atUs: TimeUs }
  | { type: "marker/delete"; markerId: string };
```

명령 실행 결과는 성공 또는 구조화된 거절로 반환한다.

```ts
type CommandResult =
  | { ok: true; document: TimelineDocument; clipsById: Record<ClipId, TimelineClip>; inverse: TimelineCommand[] }
  | { ok: false; code: TimelineErrorCode; message: string; details?: Record<string, unknown> };

type TimelineErrorCode =
  | "INVALID_RANGE"
  | "TRACK_LOCKED"
  | "TRACK_KIND_MISMATCH"
  | "OVERLAP_FORBIDDEN"
  | "SOURCE_BOUNDS_EXCEEDED"
  | "CLIP_NOT_FOUND"
  | "TRACK_NOT_FOUND";
```

## 7. 편집 동작 규칙

### 이동

- 여러 클립 이동은 그룹 전체의 상대 간격을 보존한다.
- 결과 시작점이 0보다 작으면 전체 이동량을 보정한다.
- 잠긴 트랙에서는 시작하거나 도착할 수 없다.
- 소스 종류와 대상 트랙 종류가 호환되지 않으면 거절한다.
- `overlapPolicy=forbid`인 트랙에서 겹침이 생기면 거절한다.

### 자르기

- 최소 클립 길이는 기본 한 프레임이다.
- 시작점 자르기는 `sourceInUs`를 함께 이동한다.
- 끝점 자르기는 `sourceOutUs`를 함께 이동한다.
- 소스 범위를 벗어나는 확장은 원본 길이가 확인된 경우 거절한다.

### 분할

- `range.startUs < atUs < range.endUs`일 때만 실행한다.
- 왼쪽 클립은 기존 ID를 유지하고 오른쪽 클립은 새 ID를 받는다.
- 연결 그룹, 활성 상태, 메타데이터는 양쪽에 복사한다.
- 소스 위치는 재생 속도를 반영해 나눈다.

### 삭제과 리플

- 일반 삭제는 다른 클립의 위치를 바꾸지 않는다.
- 리플 삭제는 삭제된 구간 뒤의 같은 트랙 클립만 왼쪽으로 이동한다.
- 여러 삭제 구간은 합집합으로 정규화한 뒤 한 번만 리플 계산한다.

### 스냅

스냅 후보는 우선순위 순으로 평가한다.

1. 재생 헤드
2. 선택 범위 양끝
3. 마커
4. 같은 트랙의 다른 클립 양끝
5. 프레임 경계

화면상 거리 기준 임계값을 시간으로 환산한다. 확대/축소와 무관하게 기본 8px 이내에서만 스냅한다.

## 8. 불변 조건

명령 처리 후 다음을 모두 만족해야 한다.

- 모든 시간 값은 유한한 0 이상의 정수다.
- 모든 범위는 `startUs < endUs`다.
- 모든 클립은 존재하는 트랙 하나에만 속한다.
- 트랙의 `clipIds`에는 중복이나 유실된 ID가 없다.
- 트랙 종류와 클립 소스 종류가 호환된다.
- 금지된 겹침이 없다.
- 소스 범위는 `sourceInUs < sourceOutUs`다.
- 문서 `revision`은 성공한 명령마다 정확히 1 증가한다.

## 9. Undo/Redo 및 저장

- 드래그 한 번, 분할 한 번, 다중 삭제 한 번을 각각 단일 히스토리 항목으로 기록한다.
- 히스토리 항목은 실행 전 문서 전체가 아니라 역명령 목록을 저장한다.
- 새 명령이 성공하면 redo 스택을 비운다.
- 저장은 `revision`을 기준으로 낙관적 동시성 검사를 한다.
- 자동 저장은 마지막 성공 명령 후 짧은 지연을 두되 재생 헤드와 UI 상태는 저장 대상에서 제외한다.

## 10. 모듈 공개 인터페이스

최초 구현은 다음 순수 함수 중심 API를 제공한다.

```ts
validateTimeline(document, clipsById): TimelineValidationResult
applyTimelineCommand(document, clipsById, command): CommandResult
getActiveClips(document, clipsById, atUs): TimelineClip[]
getPlaybackBounds(document, playback): TimeRange
normalizePlaybackState(document, playback): PlaybackState
secondsToUs(seconds): TimeUs
usToSeconds(timeUs): number
frameToUs(frame, frameRate): TimeUs
usToFrame(timeUs, frameRate): number
```

UI는 이 함수들을 우회해 타임라인 문서를 직접 수정하지 않는다.

## 11. 최소 검증 시나리오

- 경계 시간에서 이전 클립은 비활성, 다음 클립은 활성
- 29.97fps에서 프레임과 시간 왕복 변환
- 0초 이전으로 다중 클립 이동 시 상대 간격 유지
- 금지 트랙 겹침 거절 및 문서 무변경
- 시작/끝 자르기 시 소스 범위 동기화
- 연결된 영상·오디오 클립 동시 이동
- 분할 후 두 클립의 총 길이와 소스 범위 보존
- 여러 구간 리플 삭제 시 이중 이동 방지
- 반복 범위 끝 도달 시 정확한 시작점 복귀
- 재생 중 외부 플레이어 드리프트 보정
- 드래그 미리보기 취소 시 문서 무변경
- 명령 실행 후 undo/redo 왕복 시 원본과 동일

## 12. 초기 통합 결정

- 장면은 `scene` 트랙의 클립으로 배치한다.
- 자막은 `caption` 트랙의 클립으로 배치한다.
- 원본 영상과 오디오는 별도 트랙을 사용하며 `linkGroupId`로 함께 편집할 수 있다.
- 장면 또는 에셋 삭제는 참조 중인 클립을 자동 삭제하지 않고 먼저 참조 오류를 반환한다.
- 내보내기 모듈은 타임라인 문서를 직접 해석하지 않고 시간순 활성 클립 조회 API를 사용한다.
