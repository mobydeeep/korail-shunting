# KORAIL · 3D 입환작업

A browser-based, Korean-language 3D shunting game. Static ES modules with a vendored Three.js 0.180.0 runtime. No account system, remote application APIs, or persistent player data.

## Play

- WASD / arrow keys: walk in screen-relative directions.
- Click the yard floor or action marker: walk to the chosen location, avoiding vehicles.
- E: couple at a nearby stationary coupler.
- R: uncouple at a nearby stationary coupler.
- J / L: radio left / right movement; Space or K: stop.
- C: switch overview / worker camera. Drag: orbit. Scroll: zoom.
- P: pause. Touch controls are included.

The four-stage mission requires coupling three wagons, moving them to the marked area, uncoupling B201, and extracting the remaining consist by four metres. Free practice unlocks all three coupling boundaries. Timers and scores are session-only. The simplified game automatically stops at coupler contact and destination, prevents coupling during movement, and stops movements when the worker occupies the vehicle path. This is a themed game, not an official training or operating-procedure simulator.

## Verify

Run `node --test tests/simulation.test.mjs` for mission completion, coupling guards, safety stops, detached vehicle behaviour, track boundaries, pause, walking collision, and resets. Serve `dist/` using any static HTTP server to play. JavaScript modules require HTTP rather than directly opening a file URL.

The Sites identity and static output location are stored in `.openai/hosting.json`.


## GitHub 실행 구조

- `index.html`: 게임 시작 파일
- `style.css`: 화면/UI 스타일
- `game.js`: Three.js 기반 3D 작업장 및 조작 로직
- `simulation.js`: 입환 연결·분리·이동 시뮬레이션 로직
- `tests/simulation.test.mjs`: 핵심 입환 로직 테스트

브라우저에서 `index.html`을 열면 실행됩니다. GitHub Pages를 켜면 웹에서도 바로 플레이할 수 있습니다.
