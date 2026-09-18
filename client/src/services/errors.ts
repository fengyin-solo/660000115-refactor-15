import { ApiError } from './http';

/**
 * 统一错误文案。
 *
 * 同一类错误在任何入口（工作台列表、模板中心、白板详情等）
 * 都给出相同解释，避免各页面各说各话。
 */
export const DEFAULT_ERROR_MESSAGE = '网络异常，请稍后重试';

/** 按操作语义给出默认提示；服务端返回的具体 error 文本仍优先展示 */
export const describeError = (
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE
): string => {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

/** 是否为「找不到记录」（404），用于与空列表区分 */
export const isNotFoundError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === 'NOT_FOUND';

/** 统一的错误日志通道，所有入口的请求错误都经此输出，格式一致 */
export const logRequestError = (scope: string, error: unknown): void => {
  console.error(`[请求失败] ${scope}:`, error);
};
