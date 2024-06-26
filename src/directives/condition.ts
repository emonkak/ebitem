import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
  resolveBinding,
} from '../binding.js';
import type { Part, Updater } from '../types.js';
import { UnitDirective } from './unit.js';

type FunctionOrValue<T> = (() => T) | T extends Function ? never : T;

export function condition<TTrue, TFalse>(
  condition: boolean,
  trueCase: FunctionOrValue<TTrue>,
  falseCase: FunctionOrValue<TFalse>,
): ConditionDirective<TTrue, TFalse> {
  return new ConditionDirective(condition, trueCase, falseCase);
}

export function when<TTrue>(
  condition: boolean,
  trueCase: FunctionOrValue<TTrue>,
): ConditionDirective<TTrue, UnitDirective> {
  return new ConditionDirective(condition, trueCase, UnitDirective.instance);
}

export function unless<TFalse>(
  condition: boolean,
  falseCase: FunctionOrValue<TFalse>,
): ConditionDirective<UnitDirective, TFalse> {
  return new ConditionDirective(condition, UnitDirective.instance, falseCase);
}

export class ConditionDirective<TTrue, TFalse> implements Directive {
  private readonly _condition: boolean;

  private readonly _trueCase: FunctionOrValue<TTrue>;

  private readonly _falseCase: FunctionOrValue<TFalse>;

  constructor(
    condition: boolean,
    trueCase: FunctionOrValue<TTrue>,
    falseCase: FunctionOrValue<TFalse>,
  ) {
    this._condition = condition;
    this._trueCase = trueCase;
    this._falseCase = falseCase;
  }

  get condition(): boolean {
    return this._condition;
  }

  get trueCase(): FunctionOrValue<TTrue> {
    return this._trueCase;
  }

  get falseCase(): FunctionOrValue<TFalse> {
    return this._falseCase;
  }

  [directiveTag](
    part: Part,
    _updater: Updater,
  ): ConditionBinding<TTrue, TFalse> {
    return new ConditionBinding<TTrue, TFalse>(this, part);
  }
}

export class ConditionBinding<TTrue, TFalse>
  implements Binding<ConditionDirective<TTrue, TFalse>>
{
  private _directive: ConditionDirective<TTrue, TFalse>;

  private readonly _part: Part;

  private _trueBinding: Binding<TTrue> | null = null;

  private _falseBinding: Binding<TFalse> | null = null;

  constructor(directive: ConditionDirective<TTrue, TFalse>, part: Part) {
    this._directive = directive;
    this._part = part;
  }

  get value(): ConditionDirective<TTrue, TFalse> {
    return this._directive;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this.currentBinding?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this.currentBinding?.endNode ?? this._part.node;
  }

  get currentBinding(): Binding<TTrue> | Binding<TFalse> | null {
    return this._directive.condition ? this._trueBinding : this._falseBinding;
  }

  connect(updater: Updater): void {
    const { condition, trueCase, falseCase } = this._directive;

    if (condition) {
      if (this._trueBinding === null) {
        const value = typeof trueCase === 'function' ? trueCase() : trueCase;
        this._trueBinding = resolveBinding(value, this._part, updater);
      }
      this._trueBinding.connect(updater);
    } else {
      if (this._falseBinding === null) {
        const value = typeof falseCase === 'function' ? falseCase() : trueCase;
        this._falseBinding = resolveBinding(value, this._part, updater);
      }
      this._falseBinding.connect(updater);
    }
  }

  bind(newValue: ConditionDirective<TTrue, TFalse>, updater: Updater): void {
    DEBUG: {
      ensureDirective(ConditionDirective, newValue);
    }

    const oldValue = this._directive;

    if (
      oldValue.condition !== newValue.condition ||
      oldValue.falseCase !== newValue.falseCase ||
      oldValue.trueCase !== newValue.trueCase
    ) {
      const { condition, trueCase, falseCase } = newValue;

      if (condition) {
        const value = typeof trueCase === 'function' ? trueCase() : trueCase;
        if (this._trueBinding !== null) {
          if (oldValue.condition !== condition) {
            this._falseBinding?.unbind(updater);
          }
          this._trueBinding.bind(value, updater);
        } else {
          this._falseBinding?.unbind(updater);
          this._trueBinding = resolveBinding(value, this._part, updater);
          this._trueBinding.connect(updater);
        }
      } else {
        const value = typeof falseCase === 'function' ? falseCase() : falseCase;
        if (this._falseBinding !== null) {
          if (oldValue.condition !== condition) {
            this._trueBinding?.unbind(updater);
          }
          this._falseBinding.bind(value, updater);
        } else {
          this._trueBinding?.unbind(updater);
          this._falseBinding = resolveBinding(value, this._part, updater);
          this._falseBinding.connect(updater);
        }
      }

      this._directive = newValue;
    }
  }

  unbind(updater: Updater): void {
    this.currentBinding?.unbind(updater);
  }

  disconnect(): void {
    this.currentBinding?.disconnect();
  }
}
