# CURRENT_STATUS

작성일: 2026-09-04
문서 버전: v1.1

## 설계

- Master spec cross-check: COMPLETE
- Contract conflicts (time, asset, status, relation, desktop): RESOLVED

- Generic Core architecture: COMPLETE
- Nihon ZupZup Channel Pack architecture: COMPLETE
- 4 Content Types: COMPLETE
- Content Profiles initial mapping: COMPLETE
- Scene System: COMPLETE
- Timeline Engine: COMPLETE
- Asset System: COMPLETE
- Caption/Typography: COMPLETE
- Motion System: COMPLETE
- Auto Scene Planner: COMPLETE
- Review Editor: COMPLETE
- Long→Shorts: COMPLETE
- Content Manager: COMPLETE
- YouTube Publishing: COMPLETE
- Desktop/GitHub/Auto Update: COMPLETE

## 구현

- 00_Master: READY
- 01_Core: COMPLETE
- 02_Caption: IN_PROGRESS
- 03_Timeline: BLOCKED_BY_CAPTION
- 04_Scene: BLOCKED
- 05_Asset: WAITING_PHASE
- 06_Theme_Motion: WAITING_PHASE
- 07_AutoPlanner: BLOCKED
- 08_ReviewEditor: BLOCKED
- 09_Content_Manager: BLOCKED
- 10_YouTube: BLOCKED
- 11_Desktop_Release: BLOCKED_BY_CORE
- 12_Integration: BASELINE_READY / APP_CODE_BLOCKED

## 확정 공통 계약

- 기술 스택: Node.js + TypeScript + React + Remotion + Electron
- 1차 실행 환경: Windows 11 x64
- 배포 채널: GitHub Releases
- 내부 시간: 정수 microsecond(`TimeUs`), 반열림 범위 `[startUs, endUs)`
- 에셋 기계 계약: `05_asset/asset-record.schema.json`
- 콘텐츠/제작/YouTube 상태: `contentStatus` / `productionStatus` / 원격 게시 상태로 분리
- Long→Shorts 부모 관계 필드: `parentLongId`
- 프로젝트 데이터와 앱 설치 위치 분리

## Core 검증 결과

- npm workspaces 프로젝트 골격: PASS
- TypeScript typecheck: PASS
- Core 단위 테스트: PASS (1 file, 8 tests)
- Electron renderer/main 및 Remotion bundle build: PASS
- Remotion `CoreSmoke`: PASS (30fps, 1920x1080, 90 frames)
- 통합 계약 검사: PASS (62 checks)
- 공개 패키지 import smoke: PASS (`nihon_zupzup`, 17 profiles, 30 frames = 1,000,000us)
- npm audit: PASS (0 vulnerabilities)
- GUI 런타임 E2E, 실제 디스크 저장·복구, 설치 검증: 미실시

## 다음 실행

02_Caption이 SRT 파싱, Caption JSON, 표시 단위 분할과 Validator를 구현한다. 원본 SRT 시간은 변경하지 않고 Core의 `TimeUs`·오류·ID·프로젝트 계약을 사용한다.

02_Caption 완료 관문:

1. 표준 SRT 파싱과 구조화된 Caption JSON
2. 정수 `TimeUs`와 반열림 범위 유지, 원본 cue 시간 불변
3. 긴 cue의 내부 표시 단위 분할과 원본 연결 보존
4. 겹침·역전·빈 텍스트·과도한 줄/길이에 대한 오류·경고 Validator
5. 한국어/일본어/독음과 Caption Mode를 확장할 공개 타입
6. 단위 테스트, 타입검사, 빌드와 통합 계약 검사 통과
