import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, describeError } from '../services/http';

export interface RequestState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  /** 统一文案，可直接展示在界面上 */
  errorMessage: string | null;
}

export interface UseRequestOptions<T> {
  /** 加载场景描述，用于生成统一错误文案，如「加载白板列表」 */
  action?: string;
  /** 为 false 时不自动发起请求（如弹窗未打开） */
  ready?: boolean;
  /** 自动请求的额外依赖 */
  deps?: unknown[];
  /** 请求成功回调 */
  onSuccess?: (data: T) => void;
}

export interface UseRequestResult<T> extends RequestState<T> {
  /** 手动重新请求 */
  reload: () => Promise<T | null>;
}

/**
 * 列表/详情读取的统一流程：
 * loading -> 成功写入 data / 失败写入统一错误；
 * 组件卸载或重新请求后，过期结果不会再写回状态。
 */
export function useRequest<T>(
  fetcher: () => Promise<T>,
  options: UseRequestOptions<T> = {}
): UseRequestResult<T> {
  const { action, ready = true, deps = [], onSuccess } = options;

  const [state, setState] = useState<RequestState<T>>({
    data: null,
    loading: ready,
    error: null,
    errorMessage: null,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async (): Promise<T | null> => {
    setState((prev) => ({ data: prev.data, loading: true, error: null, errorMessage: null }));
    try {
      const data = await fetcherRef.current();
      if (!mountedRef.current) return data;
      setState({ data, loading: false, error: null, errorMessage: null });
      onSuccessRef.current?.(data);
      return data;
    } catch (error) {
      if (!mountedRef.current) return null;
      setState({
        data: null,
        loading: false,
        error: error instanceof ApiError ? error : null,
        errorMessage: describeError(error, action),
      });
      return null;
    }
  }, [action]);

  useEffect(() => {
    if (!ready) return;

    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null, errorMessage: null }));

    fetcherRef
      .current()
      .then((data) => {
        if (!active || !mountedRef.current) return;
        setState({ data, loading: false, error: null, errorMessage: null });
        onSuccessRef.current?.(data);
      })
      .catch((error) => {
        if (!active || !mountedRef.current) return;
        setState({
          data: null,
          loading: false,
          error: error instanceof ApiError ? error : null,
          errorMessage: describeError(error, action),
        });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, run, ...deps]);

  return { ...state, reload: run };
}
