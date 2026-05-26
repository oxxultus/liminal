// webScraperPlugin.mjs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ====================== 서버 초기화 ======================
const server = new McpServer({
  name: 'web-scraper',
  version: '1.0.0'
});

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

// ====================== 서버 시작 ======================
const transport = new StdioServerTransport();
await server.connect(transport);

console.error(`[web-scraper] 서버 시작됨 | Ready for web requests`);