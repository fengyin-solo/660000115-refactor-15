import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError, isNotFoundError, logRequestError } from '../services/errors';

/**
 * 共用请求流程
 *
 * 调用方不再各自手写 loading / error / try-catch，
 * 统一通过 useResource（读）与 useAction（写）两个 hook 复用同一套写法。
 */

/** 读取结果状态机：空列表 / 找不到记录 / 请求失败 是三种互斥状态 */
export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  /** 请求失败（5xx、网络错误等）；空列表与 404 都不算失败 */
  error: string | null;
  /** 404：明确找不到某条记录，与「列表为空」区分开 */
  notFound: boolean;
}

export interface UseResourceOptions {
  /** 进入即自动请求，默认 true；模板中心这类按条件加载的可关闭 */
  immediate?: boolean;
  /** 日志/错误归属，如 '加载白板列表' */
  scope: string;
  /** 请求失败时的统一兜底文案 */
  errorMessage?: string;
}

export interface UseResourceResult<T, Args extends unknown[]> extends ResourceState<T> {
  /** 手动（重新）加载，参数透传给 fetcher */
  reload: (...args: Args) => Promise<T | null>;
}

/**
 * 统一读取流程。
 *
 * - fetcher 约定成功返回数据：列表接口返回空数组时 data=[]（空列表）
 * - fetcher 对 404 返回 null 时，状态标记 notFound=true（找不到记录）
 * - 其它错误归一为 error 文案，loading 一定在结束时复位
 */
export function useResource<T, Args extends unknown[] = []>(
  fetcher: (...args: Args) => Promise<T | null>,
  options: UseResourceOptions
): UseResourceResult<T, Args> {
  const { immediate = true, scope, errorMessage } = options;
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    loading: immediate,
    error: null,
    notFound: false,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // 丢弃过期请求的结果，避免快速连续触发时旧响应覆盖新响应
  const requestSeqRef = useRef(0);

  const reload = useCallback(
    async (...args: Args): Promise<T | null> => {
      const seq = ++requestSeqRef.current;
      setState((prev) => ({ ...prev, loading: true, error: null, notFound: false }));
      try {
        const result = await fetcherRef.current(...args);
        // 过期请求（已被更新的 reload 取代）一律不落状态，避免旧错误闪现
        if (seq !== requestSeqRef.current) return result;
        if (result === null) {
          setState({ data: null, loading: false, error: null, notFound: true });
        } else {
          setState({ data: result, loading: false, error: null, notFound: false });
        }
        return result;
      } catch (error) {
        if (seq !== requestSeqRef.current) return null;
        logRequestError(scope, error);
        setState({
          data: null,
          loading: false,
          error: describeError(error, errorMessage),
          notFound: isNotFoundError(error),
        });
        return null;
      }
    },
    [scope, errorMessage]
  );

  useEffect(() => {
    if (immediate) {
      // Args 默认为空元组；带参 fetcher 的场景由调用方使用 immediate:false + reload
      void (reload as (...args: Args) => Promise<T | null>)(...([] as unknown as Args));
    } else {
      setState((prev) => ({ ...prev, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate]);

  return { ...state, reload };
}

export type ActionOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; notFound: boolean };

export interface UseActionOptions {
  /** 日志/错误归属，如 '创建白板' */
  scope: string;
  /** 失败时的统一兜底文案 */
  errorMessage?: string;
}

export interface UseActionResult<Args extends unknown[], T> {
  executing: boolean;
  error: string | null;
  clearError: () => void;
  /**
   * 执行变更请求。
   * - 在途期间再次调用直接复用同一个 Promise，重新提交不会产生重复记录
   * - 不抛异常，返回判别联合，调用方按 ok 分支处理即可
   */
  run: (...args: Args) => Promise<ActionOutcome<T>>;
}

/** 统一变更（创建/删除）流程：在途去重 + 错误归一 */
export function useAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<T>,
  options: UseActionOptions
): UseActionResult<Args, T> {
  const { scope, errorMessage } = options;
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;
  const inflightRef = useRef<Promise<ActionOutcome<T>> | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(
    (...args: Args): Promise<ActionOutcome<T>> => {
      if (inflightRef.current) return inflightRef.current;

      setExecuting(true);
      setError(null);

      const task = (async (): Promise<ActionOutcome<T>> => {
        try {
          const data = await actionRef.current(...args);
          return { ok: true, data };
        } catch (err) {
          logRequestError(scope, err);
          const message = describeError(err, errorMessage);
          setError(message);
          return { ok: false, error: message, notFound: isNotFoundError(err) };
        } finally {
          inflightRef.current = null;
          setExecuting(false);
        }
      })();

      inflightRef.current = task;
      return task;
    },
    [scope, errorMessage]
  );

  return { executing, error, clearError, run };
}
