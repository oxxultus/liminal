// src/main/plugins/localFilePlugin.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { McpPlugin, McpTool, McpToolResult } from '../mcp/types';

export class LocalFileMcpPlugin implements McpPlugin {
  id: string;
  name: string;
  enabled: boolean;
  private workspaceDir: string;

  constructor(id: string, name: string, workspaceDir: string) {
    this.id = id;
    this.name = name;
    this.workspaceDir = workspaceDir;
    this.enabled = true;
  }

  // LLM에게 제공할 로컬 파일 제어 도구 명세
  async listTools(): Promise<McpTool[]> {
    return [
      {
        name: 'write_text_file',
        description: '[로컬 파일 제어] 지정된 파일 이름으로 텍스트 내용을 저장하거나 새 파일을 생성합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: '저장할 파일명 (예: memo.txt, todo.txt)' },
            content: { type: 'string', description: '파일에 기록할 내용' }
          },
          required: ['filename', 'content']
        }
      },
      {
        name: 'read_text_file',
        description: '[로컬 파일 제어] 지정된 로컬 텍스트 파일의 내용을 읽어옵니다.',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: '읽어올 파일명 (예: memo.txt)' }
          },
          required: ['filename']
        }
      }
    ];
  }

  // LLM이 로컬 도구를 호출했을 때 실행할 실제 I/O 로직
  async callTool(name: string, args: Record<string, any>): Promise<McpToolResult> {
    const originalName = name.replace(`${this.id}__`, '');
    const filename = args.filename;
    const filePath = path.join(this.workspaceDir, filename);

    try {
      // 디렉토리 탈출 방지 보안 체크
      if (!filePath.startsWith(this.workspaceDir)) {
        throw new Error('지정된 작업 공간 외부의 파일에는 접근할 수 없습니다.');
      }

      // 1. 파일 쓰기
      if (originalName === 'write_text_file') {
        await fs.mkdir(this.workspaceDir, { recursive: true });
        await fs.writeFile(filePath, args.content, 'utf-8');
        return {
          content: [{ type: 'text', text: `📁 [로컬 플러그인] 파일 [${filename}]에 기록 성공!` }]
        };
      }

      // 2. 파일 읽기
      if (originalName === 'read_text_file') {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return {
          content: [{ type: 'text', text: `📖 [로컬 플러그인] 파일 [${filename}] 내용:\n\n${fileContent}` }]
        };
      }

      throw new Error(`알 수 없는 도구: ${originalName}`);
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ 로컬 파일 작업 실패: ${error.message}` }]
      };
    }
  }
}