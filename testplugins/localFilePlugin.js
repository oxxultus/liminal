// localFilePlugin.js
const fs = require('fs/promises');
const path = require('path');

module.exports = {
  id: "mcp-local-file",
  name: "로컬 파일 제어 시스템",
  
  // 💡 [핵심 추가] AI 문맥 분석용 고유 트리거 키워드 정의
  // 사용자가 UI에서 키워드를 누락하더라도, 백엔드 엔진(pluginManager)이 이 배열을 읽어 2중 안전망으로 활용합니다.
  keywords: ['파일', '메모', '저장', '텍스트', '로그', '디렉토리', '폴더', 'read', 'write', 'file'],

  // LLM에게 제공할 로컬 파일 제어 도구 명세
  async listTools() {
    return [
      {
        name: 'write_text_file',
        description: '[로컬 파일 제어] 지정된 파일 이름으로 텍스트 내용을 저장하거나 새 파일을 생성합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: '저장할 파일명 (예: memo.txt, todo.txt)' },
            content: { type: 'string', description: '파일에 기록할 내용' }
          },
          required: ['filename', 'content']
        }
      },
      {
        name: 'read_text_file',
        description: '[로컬 파일 제어] 지정된 로컬 텍스트 파일의 내용을 읽어옵니다.',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: '읽어올 파일명 (예: memo.txt)' }
          },
          required: ['filename']
        }
      },
      {
        name: 'list_files',
        description: '[로컬 파일 제어] 지정된 작업 공간(Target Workspace) 폴더 내의 모든 파일과 하위 폴더 목록을 확인합니다.',
        inputSchema: {
          type: 'object',
          properties: {}, 
        }
      }
    ];
  },

  // LLM이 도구를 호출했을 때 실행할 실제 I/O 비즈니스 로직
  async callTool(name, args, context) {
    const workspaceDir = context?.workspaceDir || "./workspace"; 

    try {
      // 1. 파일 및 폴더 목록 조회 로직 가동
      if (name.endsWith('list_files')) {
        try {
          await fs.access(workspaceDir);
        } catch {
          return {
            content: [{ type: 'text', text: `ℹ️ [로컬 외부 모듈] 작업 공간 폴더가 아직 생성되지 않았습니다. 현재 비어 있는 상태입니다.` }]
          };
        }

        const entries = await fs.readdir(workspaceDir, { withFileTypes: true });
        
        if (entries.length === 0) {
          return {
            content: [{ type: 'text', text: `📁 [로컬 외부 모듈] 작업 공간 [${workspaceDir}] 내부에 존재하는 파일이 없습니다.` }]
          };
        }

        const fileListString = entries
          .map(entry => {
            const icon = entry.isDirectory() ? '📁 [폴더]' : '📄 [파일]';
            return `${icon} ${entry.name}`;
          })
          .join('\n');

        return {
          content: [{ type: 'text', text: `📂 [로컬 외부 모듈] 작업 공간 [${workspaceDir}] 파일 목록:\n\n${fileListString}` }]
        };
      }

      // 공통 검증을 위한 타겟 파일 패스 설정 (write/read 전용)
      const filename = args.filename;
      if ((name.endsWith('write_text_file') || name.endsWith('read_text_file')) && !filename) {
        throw new Error('파일 작업에는 filename 인자가 필수입니다.');
      }
      
      const filePath = path.join(workspaceDir, filename || '');

      // 디바이스 탈출 위협 차단 보안 필터
      if ((name.endsWith('write_text_file') || name.endsWith('read_text_file')) && !filePath.startsWith(workspaceDir)) {
        throw new Error('지정된 작업 공간 외부의 파일에는 접근할 수 없습니다.');
      }

      // 2. 파일 쓰기
      if (name.endsWith('write_text_file')) {
        await fs.mkdir(workspaceDir, { recursive: true });
        await fs.writeFile(filePath, args.content, 'utf-8');
        return {
          content: [{ type: 'text', text: `📁 [로컬 외부 모듈] 파일 [${filename}]에 기록 성공!` }]
        };
      }

      // 3. 파일 읽기
      if (name.endsWith('read_text_file')) {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        return {
          content: [{ type: 'text', text: `📖 [로컬 외부 모듈] 파일 [${filename}] 내용:\n\n${fileContent}` }]
        };
      }

      throw new Error(`알 수 없는 도구: ${name}`);
    } catch (error) {
      return {
        content: [{ type: 'text', text: `❌ 로컬 외부 파일 작업 실패: ${error.message}` }]
      };
    }
  }
};