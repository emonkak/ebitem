import type { Context, InitialState, NewState } from './context.js';
import { currentContext } from './globalScope.js';
import type { Cleanup, EffectCallback, RefObject, Usable } from './hook.js';
import { TaskPriority } from './scheduler.js';

export function use<TResult>(usable: Usable<TResult, Context>): TResult {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.use(usable);
}

export function useCallback<TCallback extends Function>(
  callback: TCallback,
  dependencies: unknown[],
): TCallback {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useCallback(callback, dependencies);
}

export function useDeferredValue<TValue>(
  value: TValue,
  initialValue?: TValue,
): TValue {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useDeferredValue(value, initialValue);
}

export function useEffect(
  callback: EffectCallback,
  dependencies?: unknown[],
): void {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useEffect(callback, dependencies);
}

export function useEvent<THandler extends (...args: any[]) => any>(
  handler: THandler,
): (
  this: ThisType<THandler>,
  ...args: Parameters<THandler>
) => ReturnType<THandler> {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useEvent(handler);
}

export function useLayoutEffect(
  callback: EffectCallback,
  dependencies?: unknown[],
): void {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useLayoutEffect(callback, dependencies);
}

export function useMemo<TResult>(
  factory: () => TResult,
  dependencies: unknown[],
): TResult {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useMemo(factory, dependencies);
}

export function useReducer<TState, TAction>(
  reducer: (state: TState, action: TAction) => TState,
  initialState: InitialState<TState>,
  priority?: TaskPriority,
): [TState, (action: TAction) => void] {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useReducer(reducer, initialState, priority);
}

export function useRef<T>(initialValue: T): RefObject<T> {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useRef(initialValue);
}

export function useState<TState>(
  initialState: InitialState<TState>,
  priority?: TaskPriority,
): [TState, (newState: NewState<TState>) => void] {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useState(initialState, priority);
}

export function useSyncEnternalStore<T>(
  subscribe: (subscruber: () => void) => Cleanup | void,
  getSnapshot: () => T,
  priority?: TaskPriority,
): T {
  DEBUG: {
    ensureValidContext(currentContext);
  }
  return currentContext.useSyncEnternalStore(subscribe, getSnapshot, priority);
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
