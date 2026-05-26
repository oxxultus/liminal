// webScraperPlugin.js
module.exports = {
  id: "mcp-web-scraper",
  name: "웹 크롤러 및 데이터 수집기",

  // 💡 [동적 필터용 키워드 추가] 인터넷 주소, 뉴스 요약, 크롤링 관련 맥락 매칭
  keywords: ['웹', '인터넷', '주소', '뉴스', '크롤링', '스크래핑', '사이트', '링크', 'url', 'http', 'https', 'fetch', 'scraper'],

  async listTools() {
    return [
      {
        name: 'fetch_web_content',
        description: '[웹 수집] 지정된 URL 주소의 HTML 소스나 텍스트 내용을 긁어옵니다. 최신 정보나 뉴스 링크를 분석할 때 유용합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '수집할 웹 페이지의 전체 URL (예: https://news.naver.com/...)' }
          },
          required: ['url']
        }
      }
    ];
  },

  async callTool(name, args, context) {
    if (name.endsWith('fetch_web_content')) {
      const targetUrl = args.url;
      try {
        // Node.js v18 이상 내장 fetch 활용
        const response = await fetch(targetUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
        });

        if (!response.ok) {
          throw new Error(`HTTP 에러 발생! 상태 코드: ${response.status}`);
        }

        const html = await response.text();
        
        // LLM 토큰 절약을 위해 무거운 HTML 태그들을 간단히 정규식으로 1차 정제
        const cleanText = html
          .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
          .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .substring(0, 4000); // AI가 읽기 적당하게 4000자 선에서 커트

        return {
          content: [{ type: 'text', text: `🌐 [웹 수집기] '${targetUrl}' 크롤링 성공 (일부 추출):\n\n${cleanText}` }]
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `❌ 크롤링 실패: ${error.message}` }]
        };
      }
    }
    throw new Error(`알 수 없는 도구: ${name}`);
  }
};