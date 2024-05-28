import {
  Binding,
  Directive,
  directiveTag,
  initializeBinding,
  updateBinding,
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

  private _value: ConditionDirective<TTrue, TFalse>;

  private _currentCondition: boolean | null = null;

  private _trueBinding: Binding<TTrue> | null = null;

  private _falseBinding: Binding<TFalse> | null = null;

  constructor(value: ConditionDirective<TTrue, TFalse>, part: Part) {
    this._value = value;
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
    return this._value;
  }

  set value(newValue: ConditionDirective<TTrue, TFalse>) {
    this._value = newValue;
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

  bind(updater: Updater): void {
    const { condition: newCondition, trueCase, falseCase } = this._value;

    if (newCondition) {
      const newValue = typeof trueCase === 'function' ? trueCase() : trueCase;
      if (this._trueBinding !== null) {
        if (Object.is(this._currentCondition, newCondition)) {
          updateBinding(this._trueBinding, newValue, updater);
        } else {
          this._falseBinding?.unbind(updater);
          this._trueBinding.value = newValue;
          this._trueBinding.bind(updater);
        }
      } else {
        this._falseBinding?.unbind(updater);
        this._trueBinding = initializeBinding(newValue, this._part, updater);
      }
    } else {
      const newValue =
        typeof falseCase === 'function' ? falseCase() : falseCase;
      if (this._falseBinding !== null) {
        if (Object.is(this._currentCondition, newCondition)) {
          updateBinding(this._falseBinding, newValue, updater);
        } else {
          this._trueBinding?.unbind(updater);
          this._falseBinding.value = newValue;
          this._falseBinding.bind(updater);
        }
      } else {
        this._trueBinding?.unbind(updater);
        this._falseBinding = initializeBinding(newValue, this._part, updater);
      }
    }

    this._currentCondition = newCondition;
  }

  unbind(updater: Updater): void {
    this.currentBinding?.unbind(updater);
    this._currentCondition = null;
  }

  disconnect(): void {
    this.currentBinding?.disconnect();
  }
}
