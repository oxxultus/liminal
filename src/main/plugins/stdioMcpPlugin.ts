// src/main/plugins/stdioMcpPlugin.ts
import { spawn, ChildProcess } from 'child_process';
import { McpPlugin, McpTool, McpToolResult } from '../mcp/types';
import path from 'path';

export class StdioMcpPlugin implements McpPlugin {
  id: string;
  name: string;
  enabled: boolean;
  public filePath: string;
  public workspaceDir?: string;   // ← 선택적(optional)으로 변경

  private process: ChildProcess | null = null;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private messageId = 0;
  private buffer = '';

  constructor(
    id: string, 
    name: string, 
    filePath: string, 
    workspaceDir?: string   // ← 선택적 파라미터
  ) {
    this.id = id;
    this.name = name;
    this.filePath = filePath;
    this.workspaceDir = workspaceDir;
    this.enabled = true;
    this.startProcess();
  }

  private startProcess() {
    const isMjs = this.filePath.endsWith('.mjs');

    const env: NodeJS.ProcessEnv = {
      ...process.env,   // 기존 환경변수 모두 유지
    };

    // workspaceDir이 있을 때만 환경변수로 전달
    if (this.workspaceDir) {
      env.WORKSPACE_DIR = this.workspaceDir;
    }

    const spawnOptions: any = {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env,
      cwd: path.dirname(this.filePath),    // 플러그인 파일 위치를 working directory로 설정
    };

    // ES Module (.mjs) 지원
    if (isMjs) {
      spawnOptions.execArgv = ['--experimental-modules'];
    }

    this.process = spawn('node', [this.filePath], spawnOptions);

    // stdout 처리 (JSON-RPC 응답)
    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            this.pendingRequests.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(msg.error.message || 'Unknown error'));
            } else {
              pending.resolve(msg.result);
            }
          }
        } catch (e) {
          // JSON 파싱 실패는 무시
        }
      }
    });

    this.process.stderr?.on('data', (d: Buffer) => {
      console.error(`[${this.name}] stderr:`, d.toString().trim());
    });

    this.process.on('error', (err) => {
      console.error(`[${this.name}] Process spawn error:`, err);
    });

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[${this.name}] Process exited with code: ${code}`);
      }
    });
  }

  // JSON-RPC 요청 전송
  private sendRequest(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pendingRequests.set(id, { resolve, reject });

      const payload = JSON.stringify({ 
        jsonrpc: '2.0', 
        id, 
        method, 
        params 
      }) + '\n';

      this.process?.stdin?.write(payload);

      // 타임아웃 처리
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 15000); // 15초로 증가
    });
  }

  async listTools(): Promise<McpTool[]> {
    try {
      const result = await this.sendRequest('tools/list');
      return (result.tools ?? []).map((t: any) => ({
        name: `${this.id}__${t.name}`,
        description: t.description ?? '',
        inputSchema: t.inputSchema ?? { type: 'object', properties: {} }
      }));
    } catch (e) {
      console.error(`[${this.name}] listTools 실패:`, e);
      return [];
    }
  }

  async callTool(name: string, args: Record<string, any>): Promise<McpToolResult> {
    const prefix = `${this.id}__`;
    const pureName = name.startsWith(prefix) ? name.slice(prefix.length) : name;

    try {
      return await this.sendRequest('tools/call', { 
        name: pureName, 
        arguments: args 
      });
    } catch (e: any) {
      console.error(`[${this.name}] callTool 실패:`, e);
      return { 
        content: [{ type: 'text', text: `❌ 도구 실행 실패: ${e.message}` }] 
      };
    }
  }

  kill() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}