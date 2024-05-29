import {
  Binding,
  Directive,
  directiveTag,
  ensureDirective,
  resolveBinding,
} from '../binding.js';
import type { Part } from '../part.js';
import type { Updater } from '../types.js';
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

  private _currentCondition: boolean | null = null;

  constructor(directive: ConditionDirective<TTrue, TFalse>, part: Part) {
    this._directive = directive;
    this._part = part;
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

  get value(): ConditionDirective<TTrue, TFalse> {
    return this._directive;
  }

  get currentCondition(): boolean | null {
    return this._currentCondition;
  }

  get currentBinding(): Binding<TTrue> | Binding<TFalse> | null {
    return this._currentCondition !== null
      ? this._currentCondition
        ? this._trueBinding
        : this._falseBinding
      : null;
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
      this._directive = newValue;
      this.rebind(updater);
    }
  }

  rebind(updater: Updater): void {
    const { condition: newCondition, trueCase, falseCase } = this._directive;

    if (newCondition) {
      const newValue = typeof trueCase === 'function' ? trueCase() : trueCase;
      if (this._trueBinding !== null) {
        if (Object.is(this._currentCondition, newCondition)) {
          this._trueBinding.bind(newValue, updater);
        } else {
          this._falseBinding?.unbind(updater);
          this._trueBinding.bind(newValue, updater);
        }
      } else {
        this._falseBinding?.unbind(updater);
        this._trueBinding = resolveBinding(newValue, this._part, updater);
        this._trueBinding.rebind(updater);
      }
    } else {
      const newValue =
        typeof falseCase === 'function' ? falseCase() : falseCase;
      if (this._falseBinding !== null) {
        if (Object.is(this._currentCondition, newCondition)) {
          this._falseBinding.bind(newValue, updater);
        } else {
          this._trueBinding?.unbind(updater);
          this._falseBinding.bind(newValue, updater);
        }
      } else {
        this._trueBinding?.unbind(updater);
        this._falseBinding = resolveBinding(newValue, this._part, updater);
        this._falseBinding.rebind(updater);
      }
    }

    this._currentCondition = newCondition;
  }

  unbind(updater: Updater): void {
    this.currentBinding?.unbind(updater);
  }

  disconnect(): void {
    this.currentBinding?.disconnect();
  }
}
