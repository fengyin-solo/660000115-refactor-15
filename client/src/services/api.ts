import { Board, Template } from '../types';
import { request } from './http';

const API_BASE_URL = '/api/boards';
const TEMPLATE_API_URL = '/api/templates';

type CreateBoardPayload = {
  name: string;
  ownerId: string;
  width?: number;
  height?: number;
};

type CreateBoardFromTemplatePayload = {
  name: string;
  ownerId: string;
};

const postJson = <T>(url: string, body: unknown, notFoundValue?: T): Promise<T> =>
  request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    notFoundValue,
  });

export const boardApi = {
  /** 列表：成功一定返回数组（空数组即「空列表」），失败抛 ApiError */
  async getBoards(userId: string): Promise<Board[]> {
    return request<Board[]>(`${API_BASE_URL}?userId=${userId}`);
  },

  /** 详情：找不到记录时返回 null（区别于空列表），其它失败抛 ApiError */
  async getBoard(boardId: string): Promise<Board | null> {
    return request<Board | null>(`${API_BASE_URL}/${boardId}`, { notFoundValue: null });
  },

  /** 创建：同参数并发提交经 HTTP 层去重，不会产生重复记录 */
  async createBoard(data: CreateBoardPayload): Promise<Board | null> {
    return postJson<Board | null>(API_BASE_URL, data, null);
  },

  /** 删除：记录不存在（404）时返回 false，成功返回 true（既有约定不变） */
  async deleteBoard(boardId: string): Promise<boolean> {
    return request<boolean>(`${API_BASE_URL}/${boardId}`, {
      method: 'DELETE',
      notFoundValue: false,
    });
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

const mockTemplates: Template[] = [
  {
    _id: 'template-meeting',
    name: '会议纪要',
    description: '快速记录会议要点、待办事项和决议',
    category: 'meeting',
    thumbnail: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    icon: '📝',
    width: 3000,
    height: 2000,
    backgroundColor: '#f8f9fa',
  },
  {
    _id: 'template-workflow',
    name: '流程梳理',
    description: '可视化梳理业务流程、工作流和决策路径',
    category: 'workflow',
    thumbnail: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    icon: '🔄',
    width: 3500,
    height: 2200,
    backgroundColor: '#f0f9ff',
  },
  {
    _id: 'template-weekly',
    name: '周计划',
    description: '规划一周工作，跟踪每日任务和重要事项',
    category: 'productivity',
    thumbnail: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    icon: '📅',
    width: 3200,
    height: 2000,
    backgroundColor: '#f0fdf4',
  },
];

const createMockBoardFromTemplate = (
  template: Template,
  data: { name: string; ownerId: string }
): Board => {
  const now = new Date().toISOString();
  return {
    _id: `board-${Date.now()}`,
    name: data.name || template.name,
    ownerId: data.ownerId,
    collaborators: [],
    layers: template.layers || [{ name: '图层 1', visible: true, locked: false, order: 0, elements: [] }],
    width: template.width,
    height: template.height,
    backgroundColor: template.backgroundColor,
    createdAt: now,
    updatedAt: now,
  };
};

export const templateApi = {
  /** 模板列表：成功返回数组（可能为空数组），失败抛 ApiError */
  async getTemplates(): Promise<Template[]> {
    return request<Template[]>(TEMPLATE_API_URL);
  },

  /** 模板详情：找不到记录返回 null */
  async getTemplate(templateId: string): Promise<Template | null> {
    return request<Template | null>(`${TEMPLATE_API_URL}/${templateId}`, { notFoundValue: null });
  },

  /** 从模板创建白板：同参数并发提交经 HTTP 层去重，模板不存在返回 null */
  async createBoardFromTemplate(
    templateId: string,
    data: CreateBoardFromTemplatePayload
  ): Promise<Board | null> {
    return postJson<Board | null>(`${TEMPLATE_API_URL}/${templateId}/create`, data, null);
  },
};

export { mockTemplates, createMockBoardFromTemplate };
