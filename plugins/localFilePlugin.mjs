// localFilePlugin.mjs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// ====================== 서버 초기화 ======================
const server = new McpServer({
  name: 'local-file-manager',
  version: '1.2.0'
});

// 💡 메인 앱(StdioMcpPlugin)에서 선택적으로 주입한 환경변수를 받아옵니다.
const workspaceDir = process.env.WORKSPACE_DIR ? path.resolve(process.env.WORKSPACE_DIR) : null;

console.error(`[local-file-manager] 시작됨 | Workspace: ${workspaceDir || '연동 안 됨 (🔓 제한 없음)'}`);

// ====================== 안전한 경로 처리 헬퍼 ======================
const resolveSafePath = (filename) => {
  // 🛡️ 보안: 작업 공간 체크박스가 해제된 상태에서 파일 입출력 도구를 호출한 경우 차단
  if (!workspaceDir) {
    throw new Error('❌ 보안 오류: 이 도구를 사용하려면 환경 설정에서 파일 작업 디렉토리(Workspace)를 반드시 연동해야 합니다.');
  }

  const fullPath = path.resolve(workspaceDir, filename);

  // 🛡️ 보안: Directory Traversal Attack(상위 경로 탈출) 방어
  if (!fullPath.startsWith(workspaceDir)) {
    throw new Error('❌ 보안 오류: 지정된 작업 공간 외부 경로에는 접근할 수 없습니다.');
  }

  return fullPath;
};

// ====================== 도구 등록 ======================

// 1. 파일 쓰기
server.tool(
  'write_text_file',
  '작업 공간에 텍스트 파일을 생성하거나 내용을 덮어씁니다.',
  {
    filename: z.string().describe('파일명 (예: memo.txt, docs/idea.md)'),
    content: z.string().describe('파일에 저장할 내용')
  },
  async ({ filename, content }) => {
    const safePath = resolveSafePath(filename);

    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content, 'utf-8');

    return {
      content: [{
        type: 'text',
        text: `✅ 파일 저장 완료\n📁 경로: ${safePath}`
      }]
    };
  }
);

// 2. 파일 읽기
server.tool(
  'read_text_file',
  '작업 공간의 텍스트 파일 내용을 읽어옵니다.',
  {
    filename: z.string().describe('읽을 파일명')
  },
  async ({ filename }) => {
    const safePath = resolveSafePath(filename);

    try {
      const content = await fs.readFile(safePath, 'utf-8');
      return {
        content: [{
          type: 'text',
          text: `📖 파일 내용 [${filename}]:\n\n${content}`
        }]
      };
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`❌ 파일을 찾을 수 없습니다: ${filename}`);
      }
      throw new Error(`❌ 파일 읽기 실패: ${err.message}`);
    }
  }
);

// 3. 파일 목록 조회
server.tool(
  'list_files',
  '작업 공간 내 파일과 폴더 목록을 보여줍니다.',
  {
    recursive: z.boolean().optional().default(false).describe('하위 폴더까지 조회')
  },
  async ({ recursive = false }) => {
    if (!workspaceDir) {
      throw new Error('❌ 보안 오류: Workspace 디렉토리가 연동되어 있지 않아 목록 조회가 불가능합니다.');
    }

    try {
      const entries = await fs.readdir(workspaceDir, { 
        withFileTypes: true,
        recursive 
      });

      if (entries.length === 0) {
        return {
          content: [{ 
            type: 'text', 
            text: `📁 작업 공간이 비어 있습니다.\n📂 경로: ${workspaceDir}` 
          }]
        };
      }

      const list = entries
        .map(entry => {
          const type = entry.isDirectory() ? '📁' : '📄';
          return `${type} ${entry.name}`;
        })
        .join('\n');

      return {
        content: [{
          type: 'text',
          text: `📂 작업 공간 내용 (${workspaceDir}):\n\n${list}`
        }]
      };
    } catch (err) {
      if (err.code === 'ENOENT') {
        await fs.mkdir(workspaceDir, { recursive: true });
        return {
          content: [{ 
            type: 'text', 
            text: `📁 기존 공간이 없어 작업 공간을 새로 생성했습니다.\n📂 경로: ${workspaceDir}` 
          }]
        };
      }
      throw new Error(`❌ 목록 조회 실패: ${err.message}`);
    }
  }
);

// ====================== 💡 핵심: 독자 규격 키워드 인터셉터 바인딩 ======================
const originalWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  try {
    const rawText = chunk.toString();
    const lines = rawText.split('\n');
    const processedLines = lines.map(line => {
      if (!line.trim()) return line;
      try {
        const packet = JSON.parse(line);
        if (packet.result && packet.result.tools && !packet.error) {
          // 메인 앱의 동적 키워드 필터링을 위한 플러그인 고유 고정 키워드 맵 결합
          packet.result.keywords = ['파일', '메모', '로그', 'file', 'memo', 'log', 'txt'];
        }
        return JSON.stringify(packet);
      } catch (e) {
        return line;
      }
    });
    return originalWrite(processedLines.join('\n'), encoding, callback);
  } catch (err) {
    return originalWrite(chunk, encoding, callback);
  }
};

// ====================== 서버 시작 ======================
const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`[local-file-manager] 서버가 성공적으로 시작되었습니다.`);