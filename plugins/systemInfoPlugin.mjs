// systemInfoPlugin.mjs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import os from 'os';

// ====================== 서버 초기화 ======================
const server = new McpServer({
  name: 'system-info',
  version: '1.0.0'
});

// ====================== 키워드 (동적 필터링용) ======================
const keywords = [
  '시스템', '컴퓨터', '사양', '메모리', 'cpu', '운영체제', 
  '하드웨어', 'os', 'ram', 'system', 'status', '정보'
];

// ====================== 도구 등록 ======================
// 💡 공식 SDK와 Zod 형태 아규먼트 구조(인자 없음) 완벽 유지
server.tool(
  'get_system_status',
  '현재 컴퓨터의 OS 플랫폼, 메모리(RAM), CPU 정보를 조회합니다.',
  {}, 
  async () => {
    try {
      const freeMemGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
      const totalMemGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
      const cpus = os.cpus();

      const infoReport = [
        `🖥️ OS Platform: ${os.platform()} (${os.release()})`,
        `🏗️ Architecture: ${os.arch()}`,
        `🧠 CPU Model: ${cpus[0]?.model || 'Unknown'} (Core: ${cpus.length}개)`,
        `💾 Memory (RAM): ${freeMemGB} GB 사용 가능 / 총 ${totalMemGB} GB`
      ].join('\n');

      return {
        content: [{
          type: 'text',
          text: `⚙️ [시스템 정보 리포트]\n\n${infoReport}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ 시스템 정보 조회 실패: ${error.message}`
        }]
      };
    }
  }
);

// ====================== 💡 핵심: 독자 규격 키워드 인터셉터 바인딩 ======================
// 공식 SDK가 stdout으로 JSON 응답을 내보내기 직전에 패킷을 가로채 keywords를 강제 주입합니다.
const originalWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  try {
    const rawText = chunk.toString();
    // JSON-RPC 패킷 라인 단위 분할 처리
    const lines = rawText.split('\n');
    const processedLines = lines.map(line => {
      if (!line.trim()) return line;
      try {
        const packet = JSON.parse(line);
        // 메인 프로세스가 도구 목록(tools/list) 조회를 보냈고 이에 대한 정상 응답(result)인 경우
        if (packet.result && packet.result.tools && !packet.error) {
          // 공식 SDK 결과 객체 내부에 동적 필터링용 고유 키워드 주입
          packet.result.keywords = keywords;
        }
        return JSON.stringify(packet);
      } catch (e) {
        return line; // JSON 형식이 아니면 바이패스
      }
    });
    return originalWrite(processedLines.join('\n'), encoding, callback);
  } catch (err) {
    return originalWrite(chunk, encoding, callback);
  }
};

// ====================== 서버 시작 ======================
// 💡 공식 Stdio 전송 채널 완벽 활용
const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`[system-info] 서버 시작됨 | Platform: ${os.platform()}`);