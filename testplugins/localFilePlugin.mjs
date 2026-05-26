// localFilePlugin.mjs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// ====================== 설정 ======================
const server = new McpServer({
  name: 'local-file-manager',
  version: '1.2.0'
});

// WORKSPACE_DIR 우선순위: 환경변수 → 기본값
const DEFAULT_WORKSPACE = './workspace';
const WORKSPACE_DIR = process.env.WORKSPACE_DIR 
  ? path.resolve(process.env.WORKSPACE_DIR) 
  : path.resolve(DEFAULT_WORKSPACE);

console.error(`[local-file-manager] 시작됨 | Workspace: ${WORKSPACE_DIR}`);

// ====================== 안전한 경로 처리 헬퍼 ======================
const resolveSafePath = (filename, customWorkspace = null) => {
  const baseDir = customWorkspace 
    ? path.resolve(customWorkspace) 
    : WORKSPACE_DIR;

  const fullPath = path.resolve(baseDir, filename);

  // 보안: 작업 공간 외부 접근 차단
  if (!fullPath.startsWith(baseDir)) {
    throw new Error('❌ 보안 오류: 작업 공간 외부 접근이 차단되었습니다.');
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
    content: z.string().describe('파일에 저장할 내용'),
    workspaceDir: z.string().optional().describe('사용할 작업 공간 경로 (선택)')
  },
  async ({ filename, content, workspaceDir }) => {
    const safePath = resolveSafePath(filename, workspaceDir);

    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content, 'utf-8');

    return {
      content: [{
        type: 'text',
        text: `✅ 파일 저장 완료\n📁 ${safePath}`
      }]
    };
  }
);

// 2. 파일 읽기
server.tool(
  'read_text_file',
  '작업 공간의 텍스트 파일 내용을 읽어옵니다.',
  {
    filename: z.string().describe('읽을 파일명'),
    workspaceDir: z.string().optional().describe('사용할 작업 공간 경로 (선택)')
  },
  async ({ filename, workspaceDir }) => {
    const safePath = resolveSafePath(filename, workspaceDir);

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
    workspaceDir: z.string().optional().describe('사용할 작업 공간 경로 (선택)'),
    recursive: z.boolean().optional().default(false).describe('하위 폴더까지 조회')
  },
  async ({ workspaceDir, recursive = false }) => {
    const baseDir = workspaceDir 
      ? path.resolve(workspaceDir) 
      : WORKSPACE_DIR;

    try {
      const entries = await fs.readdir(baseDir, { 
        withFileTypes: true,
        recursive 
      });

      if (entries.length === 0) {
        return {
          content: [{ 
            type: 'text', 
            text: `📁 작업 공간이 비어 있습니다.\n📂 ${baseDir}` 
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
          text: `📂 작업 공간 내용 (${baseDir}):\n\n${list}`
        }]
      };
    } catch (err) {
      if (err.code === 'ENOENT') {
        // 폴더가 없으면 자동 생성
        await fs.mkdir(baseDir, { recursive: true });
        return {
          content: [{ 
            type: 'text', 
            text: `📁 작업 공간을 새로 생성했습니다.\n📂 ${baseDir}` 
          }]
        };
      }
      throw new Error(`❌ 목록 조회 실패: ${err.message}`);
    }
  }
);

// ====================== 서버 시작 ======================
const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`[local-file-manager] 서버가 성공적으로 시작되었습니다.`);