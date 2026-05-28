> ⚠️ 본 시스템의 플러그인 규격은 공식 MCP 표준과 호환되지 않는 독자 구현입니다.
# Liminal Desktop

> 다중 LLM 엔진과 MCP 플러그인을 하나의 워크스페이스에서 운용하는 AI 데스크탑 클라이언트

![Liminal Desktop Screenshot](./docs/assets/screenshot-main.png)

<br>

## 목차

- [소개](#소개)
- [화면 미리보기](#화면-미리보기)
- [호환성](#호환성)
- [설치](#설치)
- [엔진 등록](#엔진-등록)
- [플러그인 작성 가이드](#플러그인-작성-가이드)
- [라이선스](#라이선스)

<br>

## 소개

Liminal Desktop은 OpenAI, Anthropic, Google 등 다양한 LLM 공급자를 단일 인터페이스에서 전환하며 사용할 수 있는 Electron 기반 데스크탑 앱입니다. 독자적인 MCP(Model Context Protocol) 플러그인 시스템을 통해 AI가 외부 도구와 로컬/원격 시스템에 직접 접근할 수 있습니다.

**주요 기능**

- 다중 LLM 엔진 등록 및 실시간 전환
- 채팅 세션 관리 및 대화 히스토리 압축 요약
- MCP 플러그인 에코시스템 (원격 / 로컬 스크립트 / 다운로드)
- 파일 작업 공간(`workspaceDir`) 선택적(Optional) 연동 및 샌드박싱 제어
- 슬래시 커맨드(`/clear`, `/summary`, `/engine` 등)
- 다크 / 라이트 테마 전환

<br>

## 화면 미리보기

| 채팅 워크스페이스 | 엔진 설정 | 플러그인 매니저 |
|:-:|:-:|:-:|
| ![Chat](./docs/assets/screenshot-chat.png) | ![Settings](./docs/assets/screenshot-settings.png) | ![Plugins](./docs/assets/screenshot-plugins.png) |

| 라이트 모드 | 다크 모드 |
|:-:|:-:|
| ![Light](./docs/assets/screenshot-light.png) | ![Dark](./docs/assets/screenshot-dark.png) |

<br>

## 호환성

### 운영체제

| OS | 버전 | 지원 여부 |
|---|---|:---:|
| macOS | 13 Ventura 이상 | ✅ |
| Windows | 10 / 11 (x64) |  |
| Linux | Ubuntu 22.04 이상 |  |

### LLM 공급자

| Provider | 확인된 모델 | 비고 |
|---|---|---|
| **OpenAI** | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | Function Calling 지원 |
| **Anthropic** | claude-opus-4, claude-sonnet-4, claude-haiku-4 | Tool Use 지원 |
| **Google** | gemini-2.0-flash, gemini-1.5-pro | Function Declaration 지원 |
| **기타** | OpenAI 호환 API | `v1/chat/completions` 엔드포인트 사용 가능 |

### 런타임

| 항목 | 요구 버전 |
|---|---|
| Node.js | 22.x 이상 |
| Electron | 28.x 이상 |
| npm | 9.x 이상 |

<br>

## 설치

```bash
# 저장소 클론
git clone [https://github.com/yourname/liminal-desktop.git](https://github.com/yourname/liminal-desktop.git)
cd liminal-desktop

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

```

## 엔진 등록

1. 우측 상단 **Add Engine** 버튼 클릭
2. Provider, 엔진 이름, 엔드포인트 URL, 모델 식별자, API Key 입력
3. **Activate Engine** 으로 저장
4. Settings > Core Engine Selection 에서 기본 엔진 지정

```
Provider:  openai
Name:      GPT-4o
URL:       [https://api.openai.com/v1](https://api.openai.com/v1)
Model:     gpt-4o
API Key:   sk-...

```

## 플러그인 작성 가이드

Liminal Desktop의 로컬형 플러그인은 공식 `@modelcontextprotocol/sdk` 모듈 및 `zod`를 활용하여 작성할 수 있는 Node.js 자바스크립트 스크립트 파일(`.mjs`, `.js`)입니다. 시스템과 플러그인은 표준 입출력(Stdio `stdin`/`stdout`) 채널을 통해 비동기 JSON-RPC 2.0 프로토콜 방식으로 통신합니다.

### 플러그인 유형

| 유형 | 설명 | 작업 공간(`workspaceDir`) 요구 여부 |
| --- | --- | --- |
| `remote` | HTTP 엔드포인트로 외부 서버(FastAPI 등)에 연결 | 불필요 |
| `custom` | URL에서 `.mjs`, `.js` 스크립트를 다운로드하여 실행 | 선택적 주입 (`useWorkspace` 토글) |
| `custom` | 로컬 환경의 `.mjs`, `.js` 파일을 시스템에 직접 연결 | 선택적 주입 (`useWorkspace` 토글) |

---

### 표준 템플릿 (`*.mjs`)

새로운 로컬 플러그인을 정의할 때 아래 가이드라인 구조를 참고하여 비즈니스 로직을 구현하세요. 메인 클라이언트 앱과의 키워드 연동을 위해 `stdout.write` 통로를 제어하는 전용 인터셉터 로직이 하단에 결합되어야 합니다.

```javascript
// my-mcp-plugin.mjs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';

// ====================== 1. 서버 초기화 ======================
const pluginVersion = '1.0.0'; // 해당 버전이 로드시 버전으로 등록됩니다.
const server = new McpServer({
  name: 'advanced-file-plugin',
  version: pluginVersion
});

// 시스템(StdioMcpPlugin)이 선택적으로 주입한 환경변수 바인딩
const workspaceDir = process.env.WORKSPACE_DIR ? path.resolve(process.env.WORKSPACE_DIR) : null;

// ====================== 2. 고유 키워드 정의 ======================
// 메인 앱의 동적 문맥 필터링 스위치로 사용될 고유 키워드 리스트
const keywords = ['파일', '메모', '저장', 'file', 'memo', 'save', 'txt'];

// Safe Path Helper: 샌드박스(Directory Traversal) 방어
const resolveSafePath = (filename) => {
  if (!workspaceDir) {
    throw new Error('이 도구를 실행하려면 플러그인 설정에서 Workspace 경로를 연동해야 합니다.');
  }
  const fullPath = path.resolve(workspaceDir, filename);
  if (!fullPath.startsWith(workspaceDir)) {
    throw new Error('보안 오류: 작업 공간 외부 경로에는 접근할 수 없습니다.');
  }
  return fullPath;
};

// ====================== 3. 도구 등록 ======================
server.tool(
  'write_text_file',
  '지정된 작업 공간에 텍스트 파일을 생성하고 데이터를 기록합니다.',
  {
    filename: z.string().describe('생성할 파일명 (예: memo.txt)'),
    content: z.string().describe('파일에 기록할 본문 데이터')
  },
  async ({ filename, content }) => {
    try {
      const safePath = resolveSafePath(filename);

      await fs.mkdir(path.dirname(safePath), { recursive: true });
      await fs.writeFile(safePath, content, 'utf-8');

      return {
        content: [{
          type: 'text',
          text: `파일 작성 완료: ${filename}`
        }]
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `❌ 실행 실패: ${error.message}` }]
      };
    }
  }
);

// ====================== 4. 핵심: 독자 규격 키워드 인터셉터 바인딩 ======================
// 공식 SDK 호환성을 깨지 않으면서, 메인 앱의 getAllToolsForLlm 필터링 메커니즘과 연동하는 핵심 허브
const originalWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  try {
    const rawText = chunk.toString();
    const lines = rawText.split('\n');
    const processedLines = lines.map(line => {
      if (!line.trim()) return line;
      try {
        const packet = JSON.parse(line);
        // 메인 프로세스가 tools/list 조회를 요청한 정상 응답 패킷 구조인 경우
        if (packet.result && packet.result.tools && !packet.error) {
          // 키워드 정보와 버전 정보
          packet.result.keywords = keywords;
          packet.result.version = pluginVersion;
        }
        return JSON.stringify(packet);
      } catch (e) {
        return line; // JSON 포맷이 아닌 일반 console 로그 스트림 등은 바이패스
      }
    });
    return originalWrite(processedLines.join('\n'), encoding, callback);
  } catch (err) {
    return originalWrite(chunk, encoding, callback);
  }
};

// ====================== 5. 서버 시작 ======================
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

### 핵심 아키텍처 메커니즘

#### 1. 동적 문맥 필터링 (토큰 절약)

플러그인의 `tools/list` 방출 시 인터셉터로 가로채 주입한 `keywords` 배열과 유저 프롬프트를 실시간 대조하여, 관련성이 높은 문맥의 도구 세트만 최적화하여 AI 엔진 주입 레이어에 노출시킵니다.

```
유저: "사양 체크해줘"  →  keywords에 '사양' 또는 '시스템'이 명시된 플러그인만 필터 활성화
유저: "파일 저장해줘"  →  keywords에 '파일' 또는 '저장'이 명시된 플러그인만 필터 활성화
Keywords 미선언       →  상시 활성화 상태로 대기 (모든 대화 문맥에 도구 포함)

```

#### 2. 파괴적 명령 관문 제어 (Confirm 인터셉터)

도구 이름이 `write_text_file` 또는 `delete_file`로 끝나는 명령 판정이 감지되면, 실행 직전 Electron 메인 컨텍스트 수준에서 네이티브 컨펌 알림창(`dialog.showMessageBox`)을 트리거합니다. 최종 사용자가 물리적으로 승인(Execute)을 확정해야만 서브 프로세스로 데이터 파이프가 연결되는 안전장치가 작동합니다.

#### 3. 유연한 작업 공간(Workspace) 정책

로컬 파일 시스템 입출력이 불필요한 연동형 플러그인(예: 웹 스크래퍼, 하드웨어 사양 조회 등)의 경우 UI 단의 **'파일 작업 디렉토리(Workspace) 연동하기' 체크박스를 해제**하여 샌드박싱 환경변수 주입 단계가 생략된 컴팩트한 격리 권한 상태로 구동할 수 있습니다.

#### 4. 런타임 프로세스 리로드 (핫 리로드)

스크립트 내부 구문을 리팩토링한 뒤 전체 메인 애플리케이션을 껐다 켤 필요가 없습니다. Plugin Manager 화면에서 대상을 **삭제(Delete)** 처리한 후 재연동(**Link & Activate**)을 실행하면, 메인 매니저가 기존 하위 프로세스를 온전하게 `kill`한 후 `require.cache` 버퍼 라인을 밀어내어 실시간 변경 지점을 반영합니다.

---

### `inputSchema` 파라미터 타입 레퍼런스

`McpServer.tool` 정의 시 `zod` 컴포넌트 구조를 사용하여 스키마 객체를 형성하면 아래 명세 구조로 정밀 가공되어 기계학습 엔진 아규먼트로 치환됩니다.

```javascript
// Zod 스키마 구성 예시 명세
{
  filename: z.string().describe('파일명 (확장자 포함)'),
  count: z.number().optional().default(10).describe('최대 처리 항목 수'),
  overwrite: z.boolean().describe('덮어쓰기 수행 여부'),
  format: z.enum(['json', 'csv', 'txt']).describe('출력 데이터 포맷'),
  tags: z.array(z.string()).describe('태그 식별 목록')
}

```

---

### 등록 방법 (Local Script File 타입 기준)

1. **MCP Ecosystem** 대시보드 우측 상단 **Add Plugin** 버튼을 클릭합니다.
2. **Plugin Type**에서 `Local Script File`을 선택합니다.
3. 작성한 파일이 자바스크립트 표준 모듈 형식을 따르도록 확장자를 `*.js`,`*.mjs`로 변경한 뒤, **파일 탐색** 버튼을 통해 경로를 지정합니다.
4. 해당 툴이 로컬 파일 저장 및 가공 역할을 수행한다면 **'파일 작업 디렉토리(Workspace) 연동하기'** 체크박스를 활성화하고 경로를 주입합니다. 단순 조회/원격 연동용 툴이라면 체크박스를 비활성화합니다.
5. 트리거 컨텍스트 단어(쉼표로 구분)를 입력합니다. (비워둘 시 전체 문맥 상시 활성화)
6. **Link & Activate** 버튼을 클릭하여 적용합니다.

---

### 작성 체크리스트

* [ ] 구현된 스크립트 확장자가 명확히 ES Module 사양의 `*.js`,`*.mjs` 형식으로 지정되어 있는가
* [ ] 공식 `@modelcontextprotocol/sdk` 규격 모듈과 `zod` 체인이 정상 연동되어 있는가
* [ ] 메인 클라이언트 앱의 필터 체인 연동을 위한 stdout 인터셉터 코드와 플러그인 전용 `keywords` 맵이 제대로 바인딩되어 있는가
* [ ] 파일 트래버설 공격 방어(`startsWith`) 및 주입되지 않은 `WORKSPACE_DIR` 상태 분기 예외 설계가 되어 있는가
* [ ] 예외 처리를 위해 내부 비즈니스 로직 단위가 안정적인 구조로 마감되어 있는가

## 라이선스

MIT License © 2025 oxxultus