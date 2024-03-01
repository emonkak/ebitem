import { CleanHooks, Hook } from './hook.js';
import type { Part } from './part.js';
import type { Updater } from './updater.js';

export interface Directive<TContext = unknown> {
  [directiveTag](
    context: TContext,
    part: Part<TContext>,
    updater: Updater<TContext>,
  ): void;
}

export const directiveTag = Symbol('Directive');

const directiveHooks = new WeakMap<Part, Hook[]>();

export function disconnectDirective<TContext>(
  part: Part<TContext>,
  updater: Updater<TContext>,
): void {
  const hooks = directiveHooks.get(part);

  if (hooks !== undefined) {
    if (hooks.length > 0) {
      updater.enqueuePassiveEffect(new CleanHooks(hooks));
    }
    directiveHooks.delete(part);
  }
}

export function isDirective(value: unknown): value is Directive<any> {
  return typeof value === 'object' && value !== null && directiveTag in value;
}

export function performDirective<TContext>(
  directive: Directive<TContext>,
  part: Part,
  updater: Updater<TContext>,
): void {
  if (updater.currentRenderable === null) {
    throw new Error('Directive must be performed under an any Renderable.');
  }

  let hooks = directiveHooks.get(part);

  if (hooks === undefined) {
    hooks = [];
    directiveHooks.set(part, hooks);
  }

  const context = updater.scope.createContext(
    updater.currentRenderable,
    hooks,
    updater,
  );

  directive[directiveTag](context, part, updater);
}
