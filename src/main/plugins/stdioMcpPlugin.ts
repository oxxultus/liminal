// src/main/plugins/stdioMcpPlugin.ts
import { spawn, ChildProcess } from 'child_process';
import { McpPlugin, McpTool, McpToolResult } from '../mcp/types';
import path from 'path';

export class StdioMcpPlugin implements McpPlugin {
  id: string;
  name: string;
  enabled: boolean;
  public filePath: string;
  public workspaceDir?: string;   // 선택적(optional) 경로 관리

  // 💡 스크립트 내부에서 JSON-RPC 통신으로 동적 추출해온 키워드들을 저장하는 독립 필드 추가
  public scriptKeywords: string[] = [];

  private process: ChildProcess | null = null;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();
  private messageId = 0;
  private buffer = '';

  constructor(
    id: string, 
    name: string, 
    filePath: string, 
    workspaceDir?: string   // 선택적 파라미터 매핑
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
      ...process.env,   // 시스템 기본 환경변수 컨텍스트 보존
    };

    // workspaceDir이 유효할 때만 격리 환경변수로 안전하게 전달
    if (this.workspaceDir) {
      env.WORKSPACE_DIR = this.workspaceDir;
    }

    const spawnOptions: any = {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: env,
      cwd: path.dirname(this.filePath),    // 플러그인 파일 소스 위치를 작업 디렉토리(CWD)로 바인딩
    };

    // 최신 Node.js 환경에서 ES Module (.mjs) 확장자의 네이티브 모듈 로딩 격리 지원
    if (isMjs) {
      spawnOptions.execArgv = ['--experimental-modules'];
    }

    this.process = spawn('node', [this.filePath], spawnOptions);

    // stdout 처리 (JSON-RPC 응답 데이터 파이프라인 가공)
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
          // 일그러진 불완전 JSON 패킷 파싱 실패는 무시하여 전체 시스템 흐름 유지
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

  // JSON-RPC 요청 스트림 전송 유닛
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

      // 타임아웃 링 버퍼링 예방 처리 (비동기 수행 속도 보정을 위해 15초 유지)
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 15000);
    });
  }

  /**
   * 플러그인 서브프로세스로부터 도구 목록 및 스크립트 내장 키워드를 통합적으로 수집합니다.
   */
  async listTools(): Promise<McpTool[]> {
    try {
      const result = await this.sendRequest('tools/list');
      
      // 💡 [핵심 추가] mjs 스크립트 단에서 JSON-RPC 응답으로 keywords 배열을 반환하는 경우,
      // 메인 메모리 영역인 클래스 내 scriptKeywords 인스턴스 멤버 변수에 안전하게 적재합니다.
      if (result && result.keywords && Array.isArray(result.keywords)) {
        this.scriptKeywords = result.keywords.map((k: any) => String(k).trim()).filter(Boolean);
      } else {
        this.scriptKeywords = []; // 누적 데이터 꼬임 방지를 위한 초기화 안전 장치
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

  /**
   * LLM 엔진이 매칭 및 인터셉트하여 전달한 고유 식별 명세를 처리하여 전달합니다.
   */
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