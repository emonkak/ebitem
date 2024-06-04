import type { Context, InitialState, NewState } from './context.js';
import type { Cleanup, EffectCallback, RefObject, Usable } from './hook.js';
import type { TaskPriority } from './scheduler.js';
import { __globalContext } from './scope.js';

export function use<TResult>(usable: Usable<TResult, Context>): TResult {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.use(usable);
}

export function useCallback<TCallback extends Function>(
  callback: TCallback,
  dependencies: unknown[],
): TCallback {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useCallback(callback, dependencies);
}

export function useDeferredValue<TValue>(
  value: TValue,
  initialValue?: TValue,
): TValue {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useDeferredValue(value, initialValue);
}

export function useEffect(
  callback: EffectCallback,
  dependencies?: unknown[],
): void {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useEffect(callback, dependencies);
}

export function useEvent<THandler extends (...args: any[]) => any>(
  handler: THandler,
): (
  this: ThisType<THandler>,
  ...args: Parameters<THandler>
) => ReturnType<THandler> {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useEvent(handler);
}

export function useLayoutEffect(
  callback: EffectCallback,
  dependencies?: unknown[],
): void {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useLayoutEffect(callback, dependencies);
}

export function useMemo<TResult>(
  factory: () => TResult,
  dependencies: unknown[],
): TResult {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useMemo(factory, dependencies);
}

export function useReducer<TState, TAction>(
  reducer: (state: TState, action: TAction) => TState,
  initialState: InitialState<TState>,
  priority?: TaskPriority,
): [TState, (action: TAction) => void] {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useReducer(reducer, initialState, priority);
}

export function useRef<T>(initialValue: T): RefObject<T> {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useRef(initialValue);
}

export function useState<TState>(
  initialState: InitialState<TState>,
  priority?: TaskPriority,
): [TState, (newState: NewState<TState>) => void] {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useState(initialState, priority);
}

export function useSyncEnternalStore<T>(
  subscribe: (subscruber: () => void) => Cleanup | void,
  getSnapshot: () => T,
  priority?: TaskPriority,
): T {
  DEBUG: {
    ensureValidContext(__globalContext);
  }
  return __globalContext.useSyncEnternalStore(subscribe, getSnapshot, priority);
}

function ensureValidContext(
  context: Context | null,
): asserts context is Context {
  if (context === null) {
    throw new Error(
      'Invalid hook call. Hooks can only be called inside a block function.',
    );
  }
}
