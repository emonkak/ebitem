import type { Hook } from './hook.js';
import type { TemplateInterface } from './templateInterface.js';
import type { Renderable, Updater } from './updater.js';

export interface ScopeInterface<TContext> {
  getVariable(key: PropertyKey, renderable: Renderable<TContext>): unknown;

  setVariable(
    key: PropertyKey,
    value: unknown,
    renderable: Renderable<TContext>,
  ): void;

  createContext(
    renderable: Renderable<TContext>,
    hooks: Hook[],
    updater: Updater<TContext>,
  ): TContext;

  createHTMLTemplate(
    strings: TemplateStringsArray,
    values: unknown[],
  ): TemplateInterface;

  createSVGTemplate(
    strings: TemplateStringsArray,
    values: unknown[],
  ): TemplateInterface;
}
