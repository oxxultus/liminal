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
server.tool(
  'get_system_status',
  '현재 컴퓨터의 OS 플랫폼, 메모리(RAM), CPU 정보를 조회합니다.',
  {}, // 인자 없음
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

// ====================== 서버 시작 ======================
const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`[system-info] 서버 시작됨 | Platform: ${os.platform()}`);