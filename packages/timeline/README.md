# @nihon-zupzup/timeline

불변 Source Timeline(TTS/SRT)을 Insert/Pause가 반영된 Output Timeline으로 해석하는 순수 TypeScript 패키지다. 내부 시간은 `@nihon-zupzup/core`의 정수 `TimeUs`와 반열림 구간 `[startUs, endUs)`만 사용한다.

## Public API

```ts
import {
  getActiveSegments,
  outputTimeToSourceTime,
  resolveTimeline,
  sourceTimeToOutputTime,
  validateTimelineInput,
  type ResolveTimelineInput,
  type ResolvedTimeline,
  type TimelineOperation,
} from "@nihon-zupzup/timeline";
```

필요하면 `@nihon-zupzup/timeline/resolver`, `types`, `validator` 공개 하위 경로도 사용할 수 있다. 패키지 내부 `src/*` 경로는 공개 계약이 아니다.

## Resolver contract

- Caption은 `@nihon-zupzup/caption`의 공개 `CaptionDocument`만 받는다.
- Asset 구현에는 의존하지 않고 `resolveAsset(assetId)`로 양의 `durationUs`만 받는다.
- `insert`와 `pause`는 Source 재생을 멈추고 뒤 Output 시간을 누적해서 민다.
- `overlay`는 현재 Output 위에 겹치며 Source 진행, 이후 구간, 최종 `durationUs`를 밀지 않는다.
- Overlay가 최종 `durationUs`를 넘어가면 Resolver는 요청한 `outputRange`를 보존하고 `TIMELINE_OVERLAY_TRUNCATED` 경고를 낸다. 재생·활성 조회는 최종 영상의 반열림 끝점에서 잘리므로 영상 길이는 늘어나지 않는다. 끝점에 시작하는 Overlay는 결과에 남지만 활성 프레임은 없다.
- `caption_before`는 cue 또는 display unit의 `startUs`, `caption_after`는 `endUs`다.
- 긴 cue가 display unit으로 분할된 경우 각 display unit의 앞뒤 경계도 유효한 Caption 경계다.
- `source_time` 기반 Insert/Pause는 display unit의 엄격한 내부(`startUs < atUs < endUs`)에 놓을 수 없다. Overlay는 허용한다.
- Caption cue와 display unit의 원본 범위·문구는 읽기만 하며 절대 수정하지 않는다.
- `tts` 결과는 `sourceStartUs/sourceEndUs/outputStartUs/outputEndUs`를 제공하고, Insert 결과는 명세 호환 `insertId`와 공통 `operationId`를 함께 제공한다. 모든 결과에는 계산용 `sourceRange` 또는 `outputRange`도 포함된다.

## Same-anchor order and boundaries

같은 Source 앵커를 가진 작업은 `operations` 입력 배열 순서로 처리한다. Insert/Pause는 순서대로 출력 구간을 차지한다. Overlay는 자신의 순서 시점에서 시작하지만 누적 지연을 추가하지 않는다. 따라서 같은 앵커에서 Overlay가 첫 Insert보다 앞에 있으면 Insert 시작점과 같은 위치에서 시작하고, Insert 뒤에 있으면 그 Insert가 끝나는 위치에서 시작한다.

모든 구간은 반열림이다. `outputAtUs === segment.outputRange.endUs`일 때 해당 구간은 비활성이며 같은 시각에 시작하는 다음 구간이 활성이다. `sourceTimeToOutputTime(..., "before")`는 같은 앵커의 blocker 직전, 기본값 `"after"`는 모든 blocker 종료 후 Source 재개 시각을 반환한다.

## Validation errors

- 존재하지 않는 Caption cue/display unit
- 존재하지 않는 Asset 또는 0 이하·정수가 아닌 Asset 길이
- 0 이하·정수가 아닌 Pause 길이
- Source 범위를 벗어난 `source_time`
- display unit 중간의 Insert/Pause
- 중복되거나 빈 operation ID
- 안전한 정수 범위를 넘는 누적 Output 길이
- 안전한 정수 범위를 넘는 개별 Insert/Pause/Overlay 출력 종료 시각
- Source 길이 밖으로 나가는 Caption cue/display unit

`validateTimelineInput`은 전체 구조화 이슈를 반환하며 성공한 `resolveTimeline` 결과도 `warnings`를 보존한다. 영상 끝을 넘는 Overlay는 경고이고, 안전한 정수 범위를 넘는 시간은 오류다. `resolveTimeline`은 오류가 있으면 Core `Result`의 실패로 반환하며 입력을 부분 적용하거나 `RangeError`를 던지지 않는다.

## Scope boundary

현재 구현 범위는 Source/Output Resolver, Insert/Pause/Overlay, 양방향 시간 변환, 활성 구간 조회, 구조화 검증이다. `docs/timeline-contract.md`의 트랙/클립 편집 명령, 드래그, 스냅, Undo/Redo, 재생 UI 상태는 별도 단계이며 이 패키지에서 아직 구현하지 않았다.
