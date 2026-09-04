# Timeline Engine v1.0

## 1. 두 시간축

### Source Timeline
TTS/SRT 원본 시간.

### Output Timeline
Insert와 Pause가 반영된 최종 영상 시간.

공식:
Output Time = Source Time + 이전 Insert/Pause 총 Duration

## 2. 기본 원칙

- 원본 SRT 시간은 수정하지 않는다.
- TTS 파일은 물리적으로 여러 조각으로 자르지 않는다.
- 내부 시간은 0 이상의 정수 microsecond(`TimeUs`).
- 시간 범위는 반열림 구간 `[startUs, endUs)`을 사용한다.
- 외부 millisecond 입력은 경계에서만 `TimeUs`로 변환한다.
- Remotion 렌더 직전에 frame 변환.
- Pause Insert는 Caption 경계에서만 허용하는 것을 기본으로 한다.

## 3. Timing Mode

- overlay: TTS 계속
- insert: TTS 정지 + 외부 미디어
- pause: TTS 정지 + 정적 연출/여백

## 4. resolved-timeline.json

production.json + captions.json + asset duration
→ Timeline Resolver
→ resolved-timeline.json

예:
```json
{
  "durationUs": 328400000,
  "segments": [
    {
      "type": "tts",
      "sourceStartUs": 0,
      "sourceEndUs": 32200000,
      "outputStartUs": 0,
      "outputEndUs": 32200000
    },
    {
      "type": "insert",
      "insertId": "anime_001",
      "outputStartUs": 32200000,
      "outputEndUs": 35400000
    }
  ]
}
```

## 5. Validator

ERROR:
- 없는 Caption ID
- 없는 Asset
- Caption 중간 Insert
- 음수 Duration
- 잘못된 Anchor

WARNING:
- Scene 범위 중첩
- 미할당 TTS 구간
- 과도한 Insert
