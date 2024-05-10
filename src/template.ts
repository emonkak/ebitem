import type { ChildNodePart } from './binding.js';
import type { Updater } from './updater.js';

export interface Template {
  hydrate(values: unknown[], updater: Updater): TemplateRoot;
}

export interface TemplateRoot {
  get startNode(): ChildNode | null;
  get endNode(): ChildNode | null;
  bindValues(values: unknown[], updater: Updater): void;
  unbindValues(updater: Updater): void;
  mount(part: ChildNodePart): void;
  unmount(part: ChildNodePart): void;
  disconnect(): void;
}
