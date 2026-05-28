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

  // 💡 [신규 추가] 스크립트 내부 JSON-RPC 통신을 통해 실시간 추출해낸 플러그인 버전 필드
  public version: string = '1.0.0';

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
    const isEsm = this.filePath.endsWith('.mjs') || this.filePath.endsWith('.js');

    const env: NodeJS.ProcessEnv = {
      ...process.env,
    };

    if (this.workspaceDir) {
      env.WORKSPACE_DIR = this.workspaceDir;
    }

    const runtimeCwd = path.dirname(this.filePath);

    const spawnOptions: any = {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env,
      cwd: runtimeCwd,
    };

    if (isEsm) {
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

      // =========================================================================
      // 💡 [신규 추가] 인터셉트 패킷 내부 바디에 수록된 버전을 동적으로 확보
      // =========================================================================
      if (result && result.version) {
        this.version = String(result.version).trim();
        console.log(`⚙️ [${this.name}] Stdio 통신 라인 내 동적 버전 갱신 감지: v${this.version}`);
      }

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