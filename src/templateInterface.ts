import type { Part } from './part.js';
import type { Updater } from './updater.js';

export interface TemplateInterface {
  mount(values: unknown[], updater: Updater): MountPoint;
  patch(
    parts: Part[],
    oldValues: unknown[],
    newValues: unknown[],
    updater: Updater,
  ): void;
}

export interface MountPoint {
  children: ChildNode[];
  parts: Part[];
}
