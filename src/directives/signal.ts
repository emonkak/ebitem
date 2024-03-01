import { Context } from '../context.js';
import { Directive, directiveTag } from '../directive.js';
import { Part } from '../part.js';
import type { Signal } from '../signal.js';
import type { Updater } from '../updater.js';

export function signal<T>(signal: Signal<T>) {
  return new SignalDirective(signal);
}

export class SignalDirective<T> implements Directive<Context> {
  private readonly _signal: Signal<T>;

  constructor(signal: Signal<T>) {
    this._signal = signal;
  }

  [directiveTag](context: Context, part: Part, updater: Updater): void {
    const signal = this._signal;

    context.useMutationEffect(() => {
      part.value = signal.value;
      part.commit(updater);

      return signal.subscribe(() => {
        part.value = signal.value;
        updater.enqueueMutationEffect(part);
      });
    }, [signal]);
  }
}
