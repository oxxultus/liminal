// webScraperPlugin.mjs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ====================== 서버 초기화 ======================
const server = new McpServer({
  name: 'web-scraper',
  version: '1.0.0'
});

// ====================== 키워드 (동적 필터링용) ======================
const keywords = [
  '웹', '크롤링', '스크래핑', '뉴스', '블로그', '사이트', 
  'url', 'web', 'crawl', 'scrape', 'fetch', '정보수집'
];

// ====================== 도구 등록 ======================
server.tool(
  'fetch_web_content',
  '지정된 URL의 웹 페이지 내용을 가져옵니다. 뉴스, 블로그, 정보 수집에 유용합니다.',
  {
    url: z.string().url().describe('수집할 웹 페이지의 전체 URL (https://... 형식)')
  },
  async ({ url }) => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        },
        // 필요 시 timeout 설정 (Node 18+ fetch)
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`HTTP 오류: ${response.status} ${response.statusText}`);
      }

      let html = await response.text();

      // HTML 정리 (스크립트, 스타일 제거 + 태그 제거)
      const cleanText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 4500); // LLM 토큰 절약

      return {
        content: [{
          type: 'text',
          text: `🌐 [웹 수집 성공] ${url}\n\n${cleanText}`
        }]
      };
    } catch (error) {
      console.error('[web-scraper] 오류:', error);
      return {
        content: [{
          type: 'text',
          text: `❌ 웹 크롤링 실패: ${error.message}`
        }]
      };
    }
  }
);

// ====================== 💡 핵심: 독자 규격 키워드 인터셉터 바인딩 ======================
// 공식 SDK가 stdout 채널로 응답 패킷을 방출하기 직전에 가로채 keywords를 결합합니다.
const originalWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
  try {
    const rawText = chunk.toString();
    const lines = rawText.split('\n');
    const processedLines = lines.map(line => {
      if (!line.trim()) return line;
      try {
        const packet = JSON.parse(line);
        // 메인 프로세스가 tools/list 조회를 보낸 정상 패킷 응답인 경우
        if (packet.result && packet.result.tools && !packet.error) {
          // 플러그인 고유 고정 키워드 맵을 패킷에 주입
          packet.result.keywords = keywords;
        }
        return JSON.stringify(packet);
      } catch (e) {
        return line; // JSON 포맷팅이 불가능한 일반 로그 스트림은 그대로 통과
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

console.error(`[web-scraper] 서버 시작됨 | Ready for web requests`);