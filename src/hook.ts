export type Hook = EffectHook | MemoHook<any> | ReducerHook<any, any> | EndHook;

export interface EffectHook {
  type: HookType.Effect;
  cleanup: Cleanup | void;
  dependencies: unknown[] | undefined;
}

export interface MemoHook<TResult> {
  type: HookType.Memo;
  value: TResult;
  dependencies: unknown[] | undefined;
}

export interface ReducerHook<TState, TAction> {
  type: HookType.Reducer;
  dispatch: (action: TAction) => void;
  state: TState;
}

export interface EndHook {
  type: HookType.End;
}

export type Usable<TResult, TContext> =
  | UsableCallback<TResult, TContext>
  | UsableObject<TResult, TContext>;

export type UsableCallback<TResult, TContext> = (context: TContext) => TResult;

export interface UsableObject<TResult, TContext> {
  [usableTag](context: TContext): TResult;
}

export type Cleanup = () => void;

export type EffectCallback = () => Cleanup | void;

export type Ref<T> = RefCallback<T> | RefObject<T>;

export type RefCallback<T> = (value: T) => void;

export interface RefObject<T> {
  current: T;
}

export const usableTag = Symbol('Usable');

export enum HookType {
  Effect,
  Memo,
  Reducer,
  End,
}

export function ensureHookType<TExpectedHook extends Hook>(
  expectedType: TExpectedHook['type'],
  hook: Hook,
): asserts hook is TExpectedHook {
  if (hook.type !== expectedType) {
    throw new Error(
      `Unexpected hook type. Expected "${expectedType}" but got "${hook.type}".`,
    );
  }
}
