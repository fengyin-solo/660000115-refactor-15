import { Board, Template } from '../types';
import { request, requestOrNull, send } from './http';

const API_BASE_URL = '/api/boards';
const TEMPLATE_API_URL = '/api/templates';

export const boardApi = {
  /** 列表：成功时返回数组，空列表仍返回 []（与「找不到记录」的 null 区分） */
  async getBoards(userId: string): Promise<Board[]> {
    return request<Board[]>(API_BASE_URL, { query: { userId } });
  },

  /** 详情：记录不存在时返回 null（既有行为保持不变） */
  async getBoard(boardId: string): Promise<Board | null> {
    return requestOrNull<Board>(`${API_BASE_URL}/${boardId}`);
  },

  /** 创建：相同请求在途时复用同一个 Promise，重复提交不会产生第二条记录 */
  async createBoard(data: {
    name: string;
    ownerId: string;
    width?: number;
    height?: number;
  }): Promise<Board> {
    return request<Board>(API_BASE_URL, { method: 'POST', body: data });
  },

  /** 删除：保持既有约定——成功返回 true，失败（含 404/5xx）返回 false，不抛错 */
  async deleteBoard(boardId: string): Promise<boolean> {
    try {
      const response = await send(`${API_BASE_URL}/${boardId}`, { method: 'DELETE' });
      return response.ok;
    } catch {
      return false;
    }
  },

  getMockBoards(): Board[] {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString();
    const lastWeek = new Date(Date.now() - 86400000 * 7).toISOString();

    return [
      {
        _id: 'board-1',
        name: '产品需求评审',
        ownerId: 'user-1',
        collaborators: ['user-2', 'user-3'],
        layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
        width: 3000,
        height: 2000,
        backgroundColor: '#f5f5f5',
        createdAt: lastWeek,
        updatedAt: now,
      },
      {
        _id: 'board-2',
        name: '架构设计讨论',
        ownerId: 'user-1',
        collaborators: ['user-4'],
        layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
        width: 3000,
        height: 2000,
        backgroundColor: '#ffffff',
        createdAt: lastWeek,
        updatedAt: yesterday,
      },
      {
        _id: 'board-3',
        name: '用户旅程地图',
        ownerId: 'user-2',
        collaborators: ['user-1', 'user-5'],
        layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
        width: 3000,
        height: 2000,
        backgroundColor: '#f0f8ff',
        createdAt: lastWeek,
        updatedAt: twoDaysAgo,
      },
      {
        _id: 'board-4',
        name: '团队脑暴会',
        ownerId: 'user-3',
        collaborators: ['user-1'],
        layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
        width: 3000,
        height: 2000,
        backgroundColor: '#fff8e1',
        createdAt: lastWeek,
        updatedAt: lastWeek,
      },
    ];
  },

  createMockBoard(data: { name: string; ownerId: string }): Board {
    const now = new Date().toISOString();
    return {
      _id: `board-${Date.now()}`,
      name: data.name,
      ownerId: data.ownerId,
      collaborators: [],
      layers: [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
      width: 3000,
      height: 2000,
      backgroundColor: '#ffffff',
      createdAt: now,
      updatedAt: now,
    };
  },
};

export const templateApi = {
  /** 模板列表：空列表仍返回 [] */
  async getTemplates(): Promise<Template[]> {
    return request<Template[]>(TEMPLATE_API_URL);
  },

  /** 模板详情：模板不存在时返回 null（既有行为保持不变） */
  async getTemplate(templateId: string): Promise<Template | null> {
    return requestOrNull<Template>(`${TEMPLATE_API_URL}/${templateId}`);
  },

  /** 从模板创建白板：在途相同请求合并，避免重复提交产生重复白板 */
  async createBoardFromTemplate(
    templateId: string,
    data: { name: string; ownerId: string }
  ): Promise<Board> {
    return request<Board>(`${TEMPLATE_API_URL}/${templateId}/create`, {
      method: 'POST',
      body: data,
    });
  },
};
