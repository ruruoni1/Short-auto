# CHANGELOG

## 2026-09-05

- Timeline Source/Output Resolver, Insert/Pause/Overlay와 양방향 시간 변환 추가.
- Overlay overflow 및 원본 길이 밖 자막 검증 보완. 전체 테스트 30개 통과.

- Caption SRT 파싱·표시 단위 분할·Validator와 공개 패키지 추가.
- 단어 줄바꿈으로 최대 자막 줄 수를 초과하는 문제 수정.
- Caption workspace 연결 및 전체 테스트 20개 통과.

## Unreleased - 2026-09-04

### Changed
- 내부 시간 계약을 정수 microsecond와 반열림 범위로 통일
- 에셋 기계 계약을 공통 JSON Schema와 `source.generator` 기준으로 통일
- 콘텐츠·제작·YouTube 게시 상태를 별도 필드로 분리
- Long→Shorts 부모 관계 필드를 `parentLongId`로 통일
- Electron, Windows 11 x64, GitHub Releases를 Desktop v1 기준으로 명시

### Added
- npm workspaces 기반 TypeScript·React·Electron·Remotion 초기 실행 골격
- `@nihon-zupzup/core` 공통 ID·오류·이벤트·프로젝트 문서·상태·시간·Channel Pack 계약
- `@nihon-zupzup/channel-pack`의 니혼줍줍 4개 콘텐츠 유형과 17개 프로필
- Electron 최소 renderer/main과 Remotion `CoreSmoke` composition
- Core 단위 테스트와 재현 가능한 typecheck·build·smoke 명령

## v1.1 - 2026-09-04

### Added
- Content Manager
- 8주/주간 콘텐츠 플랜 관리
- Channel Pack Architecture
- Content Profiles
- Long-form → Shorts 자동 파생
- YouTube Publishing
- Long/Shorts 관계 데이터
- 범용 Core / 니혼줍줍 Pack 분리
- Codex thread 09_Content_Manager
- Codex thread 10_YouTube
- Desktop/Integration thread renumbering

### Changed
- 제품 범위를 영상 자동 생성기에서 니혼줍줍 운영·제작·업로드 관리 툴로 확대
- 최종 쓰레드 구조를 00~12로 개편

## v1.0 - 2026-09-04
- 최초 Remotion 자동화 아키텍처
- Review Editor
- Timeline/Caption/Scene/Asset/Motion
- GitHub/자동 업데이트 방향
