// src/main/plugins/stdioMcpPlugin.ts
import { spawn, ChildProcess } from 'child_process';
import { McpPlugin, McpTool, McpToolResult } from '../mcp/types';
import path from 'path';

export class StdioMcpPlugin implements McpPlugin {
  id: string;
  name: string;
  enabled: boolean;
  public filePath: string;
  public workspaceDir?: string;

  // 💡 스크립트 내부에서 JSON-RPC 통신으로 동적 추출해온 키워드들을 저장하는 독립 필드
  public scriptKeywords: string[] = [];

  private process: ChildProcess | null = null;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private messageId = 0;
  private buffer = '';

  constructor(
    id: string,
    name: string,
    filePath: string,
    workspaceDir?: string
  ) {
    this.id = id;
    this.name = name;
    this.filePath = filePath;
    this.workspaceDir = workspaceDir;
    this.enabled = true;
    this.startProcess();
  }

  private startProcess() {
    // 💡 [수정] 원본이 .mjs였거나, custom-xxx.js 로 복사되었더라도 ESM 규격으로 안전하게 실행되도록 체크
    const isEsm = this.filePath.endsWith('.mjs') || this.filePath.endsWith('.js');

    const env: NodeJS.ProcessEnv = {
      ...process.env,
    };

    if (this.workspaceDir) {
      env.WORKSPACE_DIR = this.workspaceDir;
    }

    // 💡 [전략 2 핵심] 스크립트 파일이 위치한 디렉토리(userData/external_plugins)를 
    //    CWD(실행 컨텍스트)로 강제 지정하여 바로 옆에 있는 격리된 node_modules를 참조하게 만듭니다.
    const runtimeCwd = path.dirname(this.filePath);

    const spawnOptions: any = {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env,
      cwd: runtimeCwd,
    };

    if (isEsm) {
      // 최신 Node.js 환경에서 ESM 모듈 간의 호환성을 보장하고 경고를 방지하기 위한 실행 옵션 주입
      spawnOptions.execArgv = ['--experimental-modules'];
    }

    this.process = spawn('node', [this.filePath], spawnOptions);

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
          // 불완전 JSON 패킷 파싱 실패는 무시
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

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 15000);
    });
  }

  async listTools(): Promise<McpTool[]> {
    try {
      const result = await this.sendRequest('tools/list');

      if (result && result.keywords && Array.isArray(result.keywords)) {
        this.scriptKeywords = result.keywords.map((k: any) => String(k).trim()).filter(Boolean);
      } else {
        this.scriptKeywords = [];
      }

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