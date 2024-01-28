import { TemplateResult } from './templateResult';
import { Renderable, RenderableWithHooks, Updater } from './updater';

export interface ScopeInterface<TContext> {
  getVariable(key: PropertyKey, renderable: Renderable<TContext>): unknown;

  setVariable(
    key: PropertyKey,
    value: unknown,
    renderable: Renderable<TContext>,
  ): void;

  createContext(
    renderable: RenderableWithHooks<TContext>,
    updater: Updater<TContext>,
  ): TContext;

  createTemplate(
    strings: TemplateStringsArray,
    values: unknown[],
  ): TemplateResult;
}
