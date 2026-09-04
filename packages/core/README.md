# @nihon-zupzup/core

범용 영상 자동화 모듈이 공유하는 안정적인 공개 계약이다. 채널별 콘텐츠 값과 규칙은 이 패키지에 추가하지 않고 별도 Channel Pack에서 등록한다.

## Public API

후속 모듈은 `packages/core/src/*` 같은 내부 경로를 참조하지 않는다.

```ts
import {
  ChannelPackRegistry,
  InMemoryDomainEventBus,
  ProjectRepository,
  generateEntityId,
  timeRange,
  type ContentStatus,
  type DomainEventEnvelope,
  type ProductionStatus,
  type TimeUs,
  type YouTubeRemoteState,
} from "@nihon-zupzup/core";
```

필요하면 다음 공개 하위 경로도 사용할 수 있다.

- `@nihon-zupzup/core/ids`
- `@nihon-zupzup/core/errors`
- `@nihon-zupzup/core/events`
- `@nihon-zupzup/core/documents`
- `@nihon-zupzup/core/status`
- `@nihon-zupzup/core/time`
- `@nihon-zupzup/core/channel-packs`

프로젝트 저장 구현은 `ProjectStorageAdapter`를 구현해야 한다. 저장 문서는 절대 경로를 포함하지 않으며, `revision`을 사용한 낙관적 동시성 검사를 우회하지 않는다.
