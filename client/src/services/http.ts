/**
 * 统一 HTTP 请求层
 *
 * 收拢画板/模板相关接口的请求结果与错误处理：
 * - 所有非 2xx 响应统一转换为带 status/code 的 ApiError，调用方按 code 区分错误
 * - 404（找不到记录）通过 requestOrNull 归一化为 null，与空列表（返回 []）保持原有区别
 * - 相同的在途 GET/POST 请求会复用同一个 Promise，避免重复提交产生重复记录
 */

export type ErrorCode =
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'server-error'
  | 'network-error';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code =
      status === 0
        ? 'network-error'
        : status >= 500
          ? 'server-error'
          : STATUS_TO_CODE[status] ?? 'server-error';
  }
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** 附带的查询参数，值为 undefined/null 的字段会被忽略 */
  query?: Record<string, string | number | boolean | undefined | null>;
}

/** 判定一个错误是否为「记录不存在」，调用方据此与空列表做区分 */
export const isNotFoundError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === 'not-found';

/** 判定一个错误是否为请求被中断（组件卸载/重新请求时忽略） */
export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

const buildUrl = (path: string, query?: RequestOptions['query']): string => {
  if (!query) return path;
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.set(key, String(value));
  });
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
};

const readErrorData = async (response: Response): Promise<{ error?: string }> => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

// 相同 method + url + body 的在途请求共享同一个 Promise，防止重复提交
const pendingRequests = new Map<string, Promise<Response>>();

const dedupeKey = (method: string, url: string, body: unknown): string => {
  const bodyKey = body === undefined ? '' : JSON.stringify(body);
  return `${method} ${url} ${bodyKey}`;
};

/**
 * 发送请求并直接返回原始 Response。
 * 不参与 404/JSON 归一化，供 deleteBoard 这类需要保留原始布尔结果的接口使用。
 * 在途的相同请求同样会被合并。
 */
export const send = async (path: string, options: RequestOptions = {}): Promise<Response> => {
  const method = options.method ?? 'GET';
  const url = buildUrl(path, options.query);
  const key = dedupeKey(method, url, options.body);

  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const init: RequestInit = {
    method,
    headers: {},
  };
  if (options.body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  const requestPromise = fetch(url, init).finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, requestPromise);
  // 每个调用方拿到独立的 Response 副本，可各自读取 body，互不影响
  return requestPromise.then((response) => response.clone());
};

/**
 * 统一请求入口：
 * - 成功：解析并返回 JSON
 * - 任何错误状态（含 404）/ 网络异常：抛出 ApiError
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await resolveResponse(path, options, false);
  return response.json() as Promise<T>;
}

/**
 * 与 request 相同，但把 404 归一化为 null（用于详情接口区分「找不到记录」）。
 * 其余错误状态仍抛出 ApiError。
 */
export async function requestOrNull<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T | null> {
  const response = await resolveResponse(path, options, true);
  if (response.status === 404) return null;
  return response.json() as Promise<T>;
}

async function resolveResponse(
  path: string,
  options: RequestOptions,
  allowNotFound: boolean
): Promise<Response> {
  let response: Response;
  try {
    response = await send(path, options);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(0, error instanceof Error ? error.message : '网络请求失败');
  }

  if (response.ok || (allowNotFound && response.status === 404)) {
    return response;
  }

  const errorData = await readErrorData(response);
  throw new ApiError(response.status, errorData.error || `请求失败（${response.status}）`);
}

/**
 * 统一错误文案：同一类错误在任何入口给出一致解释，操作失败时前缀动作描述。
 * 例如 describeError(err, '加载白板列表') -> 「加载白板列表失败：服务器开小差了，请稍后重试」
 */
export const describeError = (
  error: unknown,
  action?: string
): string => {
  const prefix = action ? `${action}失败` : '请求失败';

  if (error instanceof ApiError) {
    let reason: string;
    switch (error.code) {
      case 'bad-request':
        reason = '请求信息有误，请检查后重试';
        break;
      case 'unauthorized':
        reason = '登录已失效，请重新登录';
        break;
      case 'forbidden':
        reason = '没有权限执行该操作';
        break;
      case 'not-found':
        reason = '记录不存在或已被删除';
        break;
      case 'conflict':
        reason = '内容冲突，请刷新后重试';
        break;
      case 'server-error':
        reason = '服务器开小差了，请稍后重试';
        break;
      case 'network-error':
        reason = '网络连接异常，请检查网络后重试';
        break;
    }
    return `${prefix}：${reason}`;
  }

  if (isAbortError(error)) return prefix;
  return `${prefix}，请稍后重试`;
};
