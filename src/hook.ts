export type Cleanup = () => void;

export type EffectCallback = () => void | Cleanup;

export type Ref<T> = RefCallback<T> | RefObject<T>;

export type RefCallback<T> = (value: T) => void;

export interface RefObject<T> {
  current: T;
}

export type Hook = EffectHook | LayoutEffectHook | MemoHook | ReducerHook;

export interface EffectHook {
  type: HookType.EFFECT;
  callback: EffectCallback;
  cleanup: Cleanup | void;
  dependencies: unknown[] | undefined;
}

export interface LayoutEffectHook {
  type: HookType.LAYOUT_EFFECT;
  callback: EffectCallback;
  cleanup: Cleanup | void;
  dependencies: unknown[] | undefined;
}

export interface MemoHook<T = unknown> {
  type: HookType.MEMO;
  value: T;
  dependencies: unknown[] | undefined;
}

export interface ReducerHook<TState = unknown, TAction = unknown> {
  type: HookType.REDUCER;
  dispatch: (action: TAction) => void;
  state: TState;
}

export enum HookType {
  EFFECT = 'EFFECT',
  LAYOUT_EFFECT = 'LAYOUT_EFFECT',
  MEMO = 'MEMO',
  REDUCER = 'REDUCER',
}

export function ensureHookType<TExpectedHook extends Hook>(
  expectedType: TExpectedHook['type'],
  hook: Hook,
): asserts hook is TExpectedHook {
  if (hook.type !== expectedType) {
    throw new Error(
      `Invalid hook type. Expected "${expectedType}" but got "${hook.type}".`,
    );
  }
}
