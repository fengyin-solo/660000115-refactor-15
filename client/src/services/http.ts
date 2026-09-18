/**
 * 统一 HTTP 请求层
 *
 * 收拢所有画板/模板请求的公共流程：
 * - 响应解析与错误归一（服务端错误体、非 JSON 响应、网络中断）
 * - 404 统一表达为「找不到记录」（由调用方提供 fallback，既有调用返回 null / false）
 * - 在途请求去重：相同参数的 GET / POST / DELETE 并发只发一次，
 *   避免重新提交产生重复记录（创建）或重复删除
 */

export type ErrorCode =
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/** 统一错误类型，携带 HTTP 状态码与归一后的错误码，调用方可以据此区分错误类别 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(message: string, status: number, code: ErrorCode) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static fromStatus(status: number, message: string): ApiError {
    return new ApiError(message, status, statusToCode(status));
  }

  /** 从失败的 Response 构造错误，错误消息优先取服务端 { error } 字段 */
  static async fromResponse(response: Response, fallbackMessage: string): Promise<ApiError> {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || fallbackMessage;
    return ApiError.fromStatus(response.status, message);
  }

  /** fetch 本身抛错（断网、超时、CORS）时归一为网络错误 */
  static fromNetworkError(cause: unknown, fallbackMessage: string): ApiError {
    const message =
      cause instanceof Error && cause.message
        ? `${fallbackMessage}（${cause.message}）`
        : fallbackMessage;
    return new ApiError(message, 0, 'NETWORK_ERROR');
  }
}

export const statusToCode = (status: number): ErrorCode => {
  switch (status) {
    case 404:
      return 'NOT_FOUND';
    case 400:
    case 422:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 409:
      return 'CONFLICT';
    default:
      if (status >= 500) return 'SERVER_ERROR';
      return 'UNKNOWN';
  }
};

export interface RequestOptions extends RequestInit {
  /** 404 时返回的值。既有约定：详情返回 null，删除返回 false */
  notFoundValue?: unknown;
}

/** 在途请求表：key 相同的并发请求复用同一个 Promise */
const inflightRequests = new Map<string, Promise<unknown>>();

/**
 * 生成在途去重 key。
 * GET/DELETE 按 URL 去重；POST 额外带上请求体，
 * 这样同名白板连续提交两次（不同参数）仍各自创建，
 * 而双击/重试导致的同参数并发只会落一条记录。
 */
const buildDedupKey = (url: string, options: RequestOptions): string =>
  `${options.method || 'GET'} ${url} ${options.body ?? ''}`;

/**
 * 统一请求入口。
 *
 * 行为约定（与既有 api 保持一致）：
 * - 成功：返回解析后的响应体（无内容时返回 undefined）
 * - 404：返回 options.notFoundValue（默认 null），不抛错——「找不到记录」
 * - 其它非 2xx：抛出 ApiError
 * - 网络异常：抛出 code=NETWORK_ERROR 的 ApiError
 */
export async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { notFoundValue = null, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  // PUT/PATCH 携带不同更新内容时不应合并，仅对幂等/创建类请求去重
  const dedupable = method === 'GET' || method === 'POST' || method === 'DELETE';
  const dedupKey = dedupable ? buildDedupKey(url, fetchOptions) : '';

  const existing = dedupKey ? inflightRequests.get(dedupKey) : undefined;
  if (existing) {
    return existing as Promise<T>;
  }

  const task = (async (): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (cause) {
      throw ApiError.fromNetworkError(cause, '网络连接失败，请检查网络后重试');
    }

    if (response.ok) {
      // 删除接口返回 { message }，不依赖返回体；空 body 时返回 undefined
      if (response.status === 204) return undefined as T;
      return (await response.json().catch(() => undefined)) as T;
    }

    if (response.status === 404) {
      return notFoundValue as T;
    }

    throw await ApiError.fromResponse(response, `请求失败（${response.status}）`);
  })();

  if (dedupKey) {
    const shared = task.finally(() => {
      inflightRequests.delete(dedupKey);
    });
    // 存表的共享 Promise 本身没有消费者挂 rejection 处理器
    // （await 方挂在 task 返回值上），加一个空处理器避免
    // unhandledRejection；await 方仍能正常 catch
    shared.catch(() => {});
    inflightRequests.set(dedupKey, shared);
  }

  return task;
}
