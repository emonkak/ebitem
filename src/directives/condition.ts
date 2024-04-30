import {
  Binding,
  Directive,
  Part,
  directiveTag,
  initializeBinding,
  updateBinding,
} from '../binding.js';
import type { Updater } from '../updater.js';
import { UnitDirective, unit } from './unit.js';

type ValueOrFunction<T> = T extends Function ? never : T | (() => T);

export function condition<TTrue, TFalse>(
  condition: boolean,
  trueCase: ValueOrFunction<TTrue>,
  falseCase: ValueOrFunction<TFalse>,
): ConditionDirective<TTrue, TFalse> {
  return new ConditionDirective(condition, trueCase, falseCase);
}

export function when<TTrue>(
  condition: boolean,
  trueCase: ValueOrFunction<TTrue>,
): ConditionDirective<TTrue, UnitDirective> {
  return new ConditionDirective(condition, trueCase, unit);
}

export function unless<TFalse>(
  condition: boolean,
  falseCase: ValueOrFunction<TFalse>,
): ConditionDirective<UnitDirective, TFalse> {
  return new ConditionDirective(condition, unit, falseCase);
}

export class ConditionDirective<TTrue, TFalse> implements Directive {
  private readonly _condition: boolean;

  private readonly _trueCase: ValueOrFunction<TTrue>;

  private readonly _falseCase: ValueOrFunction<TFalse>;

  constructor(
    condition: boolean,
    trueCase: ValueOrFunction<TTrue>,
    falseCase: ValueOrFunction<TFalse>,
  ) {
    this._condition = condition;
    this._trueCase = trueCase;
    this._falseCase = falseCase;
  }

  get condition(): boolean {
    return this._condition;
  }

  get trueCase(): ValueOrFunction<TTrue> {
    return this._trueCase;
  }

  get falseCase(): ValueOrFunction<TFalse> {
    return this._falseCase;
  }

  [directiveTag](
    part: Part,
    updater: Updater,
  ): ConditionBinding<TTrue, TFalse> {
    const binding = new ConditionBinding<TTrue, TFalse>(this, part);

    binding.bind(updater);

    return binding;
  }
}

export class ConditionBinding<TTrue, TFalse>
  implements Binding<ConditionDirective<TTrue, TFalse>>
{
  private readonly _part: Part;

  private _directive: ConditionDirective<TTrue, TFalse>;

  private _trueBinding: Binding<TTrue> | null = null;

  private _falseBinding: Binding<TFalse> | null = null;

  private _condition;

  constructor(directive: ConditionDirective<TTrue, TFalse>, part: Part) {
    this._directive = directive;
    this._condition = directive.condition;
    this._part = part;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    const binding = this._directive.condition
      ? this._trueBinding
      : this._falseBinding;
    return binding?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): ConditionDirective<TTrue, TFalse> {
    return this._directive;
  }

  set value(newDirective: ConditionDirective<TTrue, TFalse>) {
    this._directive = newDirective;
  }

  bind(updater: Updater): void {
    const { condition, trueCase, falseCase } = this._directive;

    if (condition) {
      const newValue = typeof trueCase === 'function' ? trueCase() : trueCase;
      if (this._condition !== condition) {
        this._falseBinding?.unbind(updater);
      }
      if (this._trueBinding !== null) {
        if (
          this._condition !== condition ||
          !Object.is(this._trueBinding.value, newValue)
        ) {
          this._trueBinding = updateBinding(
            this._trueBinding,
            newValue,
            updater,
          );
        }
      } else {
        this._trueBinding = initializeBinding(newValue, this._part, updater);
      }
    } else {
      const newValue =
        typeof falseCase === 'function' ? falseCase() : falseCase;
      if (this._condition !== condition) {
        this._trueBinding?.unbind(updater);
      }
      if (this._falseBinding !== null) {
        if (
          this._condition !== condition ||
          !Object.is(this._falseBinding.value, newValue)
        ) {
          this._falseBinding = updateBinding(
            this._falseBinding,
            newValue,
            updater,
          );
        }
      } else {
        this._falseBinding = initializeBinding(newValue, this._part, updater);
      }
    }

    this._condition = condition;
  }

  unbind(updater: Updater): void {
    const { condition } = this._directive;

    if (condition) {
      this._trueBinding?.unbind(updater);
      this._falseBinding?.disconnect();
    } else {
      this._falseBinding?.unbind(updater);
      this._trueBinding?.disconnect();
    }
  }

  disconnect(): void {
    this._trueBinding?.disconnect();
    this._falseBinding?.disconnect();
  }
}
