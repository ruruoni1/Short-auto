# @nihon-zupzup/caption

SRT를 불변 source cue와 렌더 가능한 표시 단위로 변환하는 Caption 도메인 패키지다. 내부 시간은 `@nihon-zupzup/core`의 정수 `TimeUs`와 반열림 범위 `[startUs, endUs)`만 사용한다.

## Public API

```ts
import {
  parseSrt,
  splitCaptionDisplayUnits,
  validateCaptionDocument,
  type CaptionDocument,
  type CaptionDisplayUnit,
  type CaptionMode,
} from "@nihon-zupzup/caption";
```

필요하면 `@nihon-zupzup/caption/parser`, `split`, `validator`, `types` 공개 하위 경로도 사용할 수 있다. 패키지 내부 `src/*` 경로는 공개 계약이 아니다.

## Integration contract

- `CaptionCue.source`는 파싱한 SRT의 cue ID, 원문 타임코드, 원문 텍스트와 source range를 보존한다.
- `CaptionDisplayUnit`은 화면 표시용 파생 데이터다. 긴 cue를 나누어도 `source.cueId`, `source.cueRange`, `source.textRange`, `source.sourceText`로 원본을 추적한다.
- Timeline은 `CaptionDisplayUnit.id`를 `sourceRef.id`로 사용하고 `CaptionDisplayUnit.range`을 배치 기준으로 사용한다.
- Scene은 `CaptionCue.id` 범위와 `CaptionMode`를 사용하고, 문구·번역·독음은 Caption 모듈이 계속 소유한다.
- `CaptionTextSet`은 primary, 한국어, 일본어, 독음을 지원하고 `CaptionKind`는 TTS와 원작 clip caption을 구분한다.
- 파서와 분할기는 Core `Result`를 반환하며 Validator 이슈는 Core `ErrorContract`와 호환된다.
