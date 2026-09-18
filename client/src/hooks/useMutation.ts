import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, describeError } from '../services/http';

export interface MutationState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  /** 统一文案，可直接展示在界面上 */
  errorMessage: string | null;
}

export interface UseMutationOptions<T, Args extends unknown[]> {
  /** 操作场景描述，用于生成统一错误文案，如「创建白板」 */
  action: string;
  /** 成功回调（await 完成后触发，调用方可在此刷新列表/跳转） */
  onSuccess?: (data: T, ...args: Args) => void | Promise<void>;
}

export interface MutationResult<T> extends MutationState<T> {
  /** null 表示操作失败或未执行；成功时返回结果数据 */
  data: T | null;
  /** 清空错误/结果状态 */
  reset: () => void;
}

/**
 * 创建/删除类操作的统一流程：
 * - loading 期间重复调用直接被忽略，配合请求层的在途去重，重新提交不会产生重复记录
 * - 成功结果与统一错误解释均收敛在此，调用方使用同一种写法
 */
export function useMutation<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options: UseMutationOptions<T, Args>
): [(...args: Args) => Promise<MutationResult<T>>, MutationResult<T>] {
  const { action, onSuccess } = options;

  const [state, setState] = useState<MutationState<T>>({
    data: null,
    loading: false,
    error: null,
    errorMessage: null,
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, errorMessage: null });
  }, []);

  const mutate = useCallback(
    async (...args: Args): Promise<MutationResult<T>> => {
      // 防重入：上一次操作未结束时，重新提交不会再次发起
      if (loadingRef.current) {
        return {
          data: null,
          loading: true,
          error: null,
          errorMessage: null,
          reset,
        };
      }

      loadingRef.current = true;
      setState({ data: null, loading: true, error: null, errorMessage: null });

      try {
        const data = await fnRef.current(...args);
        await onSuccessRef.current?.(data, ...args);
        if (!mountedRef.current) {
          return { data, loading: false, error: null, errorMessage: null, reset };
        }
        setState({ data, loading: false, error: null, errorMessage: null });
        return { data, loading: false, error: null, errorMessage: null, reset };
      } catch (error) {
        if (!mountedRef.current) {
          return { data: null, loading: false, error: null, errorMessage: null, reset };
        }
        const result: MutationResult<T> = {
          data: null,
          loading: false,
          error: error instanceof ApiError ? error : null,
          errorMessage: describeError(error, action),
          reset,
        };
        setState(result);
        return result;
      } finally {
        loadingRef.current = false;
      }
    },
    [action, reset]
  );

  return [mutate, { ...state, reset }];
}
