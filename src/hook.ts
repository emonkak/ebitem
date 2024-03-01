import type { Effect, Updater } from './updater.js';

export type Cleanup = () => void;

export type EffectCallback = () => Cleanup | void;

export type Ref<T> = RefCallback<T> | RefObject<T>;

export type RefCallback<T> = (value: T) => void;

export interface RefObject<T> {
  current: T;
}

export type Hook = EffectHook | MemoHook | ReducerHook;

export interface EffectHook {
  type: 'effect';
  callback: EffectCallback;
  cleanup: Cleanup | void;
  dependencies: unknown[] | undefined;
}

export interface MemoHook<T = any> {
  type: 'memo';
  value: T;
  dependencies: unknown[] | undefined;
}

export interface ReducerHook<TState = any, TAction = any> {
  type: 'reducer';
  dispatch: (action: TAction) => void;
  state: TState;
}

export class CleanHooks implements Effect {
  private _hooks: Hook[];

  constructor(hooks: Hook[]) {
    this._hooks = hooks;
  }

  commit(_updater: Updater): void {
    for (let i = 0, l = this._hooks.length; i < l; i++) {
      const hook = this._hooks[i]!;
      if (hook.type === 'effect') {
        hook.cleanup?.();
      }
    }
  }
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
