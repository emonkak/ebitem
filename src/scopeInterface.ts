import type { TemplateInterface } from './templateInterface';
import type { Renderable, RenderableBlock, Updater } from './updater';

export interface ScopeInterface<TContext> {
  getVariable(key: PropertyKey, renderable: Renderable<TContext>): unknown;

  setVariable(
    key: PropertyKey,
    value: unknown,
    renderable: Renderable<TContext>,
  ): void;

  createContext(
    renderable: RenderableBlock<TContext>,
    updater: Updater<TContext>,
  ): TContext;

  createTemplate(
    strings: TemplateStringsArray,
    values: unknown[],
  ): TemplateInterface;
}
