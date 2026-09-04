# Asset System v1.0

## Media Kind

- image
- video
- audio

`anime_clip`, `drama_clip`, `illustration`, `screenshot`, `graphic`은 파일 형식이 아니라 `organization.tags`의 사용자 태그로 표현한다.

## Status

- importing
- processing
- ready
- failed
- missing
- trashed

기획 단계에서 필요한 에셋의 `required/rejected` 여부는 에셋 파일의 생명주기 상태와 분리해 Planner/Review가 관리한다.

## Role

- primary
- background
- reference
- overlay
- decorative

## Visual Strategy

- none
- asset
- generated_graphic
- text_only
- auto

## 기본 구조

```json
{
  "ast_01JABCDEFGHJKMNPQRSTVWXYZ": {
    "schemaVersion": 1,
    "assetId": "ast_01JABCDEFGHJKMNPQRSTVWXYZ",
    "projectId": "NZ001",
    "kind": "video",
    "status": "ready",
    "displayName": "애니 클립 01",
    "content": {
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "byteSize": 1234567,
      "mimeType": "video/mp4",
      "extension": "mp4",
      "storageKey": "originals/sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.mp4"
    },
    "source": {
      "type": "local",
      "originalFileName": "clip01.mp4"
    },
    "organization": { "tags": ["anime_clip"] },
    "createdAt": "2026-09-04T00:00:00Z",
    "updatedAt": "2026-09-04T00:00:00Z"
  }
}
```

## AI 생성 Asset

```json
{
  "ast_01KABCDEFGHJKMNPQRSTVWXYZ": {
    "schemaVersion": 1,
    "assetId": "ast_01KABCDEFGHJKMNPQRSTVWXYZ",
    "projectId": "NZ001",
    "kind": "image",
    "status": "ready",
    "displayName": "대화 일러스트",
    "content": {
      "sha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "byteSize": 234567,
      "mimeType": "image/webp",
      "extension": "webp",
      "storageKey": "originals/sha256/cc/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.webp"
    },
    "source": {
      "type": "generated",
      "generator": {
        "description": "친구 두 명이 자연스럽게 대화하는 일본 일상 상황",
        "aspectRatio": "16:9"
      }
    },
    "organization": { "tags": ["illustration"] },
    "createdAt": "2026-09-04T00:00:00Z",
    "updatedAt": "2026-09-04T00:00:00Z"
  }
}
```

## Resolver 우선순위

1. 기존 지정 Asset
2. generated_graphic
3. text_only
4. 새 Asset 생성/수집

## Placeholder

Asset이 없어도 Preview는 가능해야 한다.
Missing/Required Asset은 Placeholder로 표시한다.

## 폴더

assets/
- originals/sha256/
- derivatives/
- records/
- staging/
- trash/

프로젝트 문서는 절대 경로나 저장소 내부 경로 대신 `assetId`를 저장한다. 외부 패키징 시 실제 사용 중인 에셋만 프로젝트 상대 경로로 수집한다.

필드와 상태의 최종 기계 계약은 `05_asset/asset-record.schema.json`을 따른다.
