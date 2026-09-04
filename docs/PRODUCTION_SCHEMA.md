# production.json Schema v1.0

## 최상위 구조

```json
{
  "schemaVersion": "1.0",
  "project": {},
  "audio": {},
  "captions": {},
  "settings": {},
  "assets": {},
  "scenes": [],
  "inserts": [],
  "ending": {}
}
```

## project

```json
{
  "id": "NZ001",
  "title": "애니 일본어를 현실에서 쓰면 왜 이상할까?",
  "series": "애니 말투 줍줍",
  "contentType": "discovery_long",
  "language": "ko",
  "productionStatus": "draft"
}
```

`productionStatus` (제작 파일 내부 상태):
- draft
- auto_generated
- reviewing
- approved
- rendered

## audio

```json
{
  "tts": "audio/tts.wav",
  "volume": 1.0
}
```

## captions

```json
{
  "source": "audio/tts.srt",
  "parsed": "data/captions.json",
  "show": true
}
```

## settings

```json
{
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "theme": "nihon-discovery-v1",
  "captionStyle": "default",
  "transitionStyle": "default"
}
```

## scenes

```json
{
  "id": "scene_001",
  "type": "EXPLAIN",
  "locked": false,
  "confidence": 0.94,
  "captionRange": {
    "start": 12,
    "end": 14
  },
  "captionMode": "normal",
  "content": {
    "mainText": "뜻보다 관계",
    "subText": null,
    "jpText": null,
    "emphasis": ["관계"]
  },
  "visual": {
    "strategy": "generated_graphic",
    "assetId": null
  },
  "motion": null
}
```

## inserts

```json
{
  "id": "insert_001",
  "type": "ANIME_CLIP",
  "anchor": {
    "type": "caption_after",
    "captionId": 8
  },
  "assetId": "anime01"
}
```

anchor type:
- caption_before
- caption_after
- source_time

## ending

```json
{
  "enabled": true,
  "durationUs": 15000000,
  "type": "discovery_end",
  "message": "다음 일본어도 하나 더 줍고 가세요."
}
```

콘텐츠 운영 전체 생명주기는 Content Manager의 `contentStatus`가 소유한다. `productionStatus`는 자동 생성부터 렌더까지의 제작 상태만 나타내며 YouTube 원격 게시 상태와도 분리한다.
