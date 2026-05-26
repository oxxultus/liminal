// systemInfoPlugin.js
const os = require('os');

module.exports = {
  id: "mcp-system-info",
  name: "OS 시스템 정보 조회기",

  // 💡 [동적 필터용 키워드 추가] OS 사양, 메모리, 하드웨어 관련 맥락 매칭
  keywords: ['시스템', '컴퓨터', '사양', '메모리', 'cpu', '운영체제', '하드웨어', 'os', 'ram', 'system', 'status'],

  async listTools() {
    return [
      {
        name: 'get_system_status',
        description: '[시스템] 현재 컴퓨터의 OS 플랫폼, 남은 메모리(RAM) 용량, CPU 아키텍처 정보를 조회합니다.',
        inputSchema: {
          type: 'object',
          properties: {} // 인자 필요 없음
        }
      }
    ];
  },

  async callTool(name, args, context) {
    if (name.endsWith('get_system_status')) {
      try {
        const freeMemGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const totalMemGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const cpus = os.cpus();

        const infoReport = [
          `🖥️ OS Platform: ${os.platform()} (${os.release()})`,
          `🏗️ Architecture: ${os.arch()}`,
          `🧠 CPU Model: ${cpus[0]?.model} (Core 갯수: ${cpus.length}개)`,
          `💾 Memory (RAM): ${freeMemGB} GB 사용 가능 / 총 ${totalMemGB} GB`
        ].join('\n');

        return {
          content: [{ type: 'text', text: `⚙️ [시스템 정보 리포트]\n\n${infoReport}` }]
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `❌ 시스템 정보 조회 실패: ${error.message}` }]
        };
      }
    }
    throw new Error(`알 수 없는 도구: ${name}`);
  }
};