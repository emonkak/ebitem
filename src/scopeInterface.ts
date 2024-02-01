import type { TemplateInterface } from './templateInterface';
import type { Renderable, Updater } from './updater';

export interface ScopeInterface<TContext> {
  getVariable(key: PropertyKey, renderable: Renderable<TContext>): unknown;

  setVariable(
    key: PropertyKey,
    value: unknown,
    renderable: Renderable<TContext>,
  ): void;

  createContext(
    renderable: Renderable<TContext>,
    updater: Updater<TContext>,
  ): TContext;

  createTemplate(
    strings: TemplateStringsArray,
    values: unknown[],
  ): TemplateInterface;
}
