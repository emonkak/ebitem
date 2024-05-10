import {
  Binding,
  Directive,
  Part,
  createBinding,
  directiveTag,
  updateBinding,
} from '../binding.js';
import type { Updater } from '../updater.js';
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

  private _currentBinding: Binding<TTrue> | Binding<TFalse> | null = null;

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
    return this._currentBinding?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._currentBinding?.endNode ?? this._part.node;
  }

  get value(): ConditionDirective<TTrue, TFalse> {
    return this._value;
  }

  set value(newValue: ConditionDirective<TTrue, TFalse>) {
    this._value = newValue;
  }

  bind(updater: Updater): void {
    const { condition: newCondition, trueCase, falseCase } = this._value;

    if (newCondition) {
      const newValue = typeof trueCase === 'function' ? trueCase() : trueCase;
      if (this._currentBinding !== null) {
        if (Object.is(this._currentCondition, newCondition)) {
          updateBinding(this._currentBinding, newValue, updater);
        } else {
          this._currentBinding.unbind(updater);
          // Remenber the old binding for future updates.
          this._falseBinding = this._currentBinding as Binding<TFalse>;
          this._currentBinding = this._getTrueBinding(newValue, updater);
        }
      } else {
        this._currentBinding = this._getTrueBinding(newValue, updater);
      }
    } else {
      const newValue =
        typeof falseCase === 'function' ? falseCase() : falseCase;
      if (this._currentBinding !== null) {
        if (Object.is(this._currentCondition, newCondition)) {
          updateBinding(this._currentBinding, newValue, updater);
        } else {
          this._currentBinding.unbind(updater);
          // Remenber the old binding for future updates.
          this._trueBinding = this._currentBinding as Binding<TTrue>;
          this._currentBinding = this._getFalseBinding(newValue, updater);
        }
      } else {
        this._currentBinding = this._getFalseBinding(newValue, updater);
      }
    }

    this._currentCondition = newCondition;
  }

  unbind(updater: Updater): void {
    if (this._currentBinding !== null) {
      this._currentCondition = null;
      this._currentBinding?.unbind(updater);
      this._currentBinding = null;
    }
  }

  disconnect(): void {
    if (this._currentBinding !== null) {
      this._currentCondition = null;
      this._currentBinding?.disconnect();
      this._currentBinding = null;
    }
  }

  private _getTrueBinding(newValue: TTrue, updater: Updater): Binding<TTrue> {
    if (this._trueBinding !== null) {
      this._trueBinding.value = newValue;
      this._trueBinding.bind(updater);
      return this._trueBinding;
    } else {
      return createBinding(newValue, this._part, updater);
    }
  }

  private _getFalseBinding(
    newValue: TFalse,
    updater: Updater,
  ): Binding<TFalse> {
    if (this._falseBinding !== null) {
      this._falseBinding.value = newValue;
      this._falseBinding.bind(updater);
      return this._falseBinding;
    } else {
      return createBinding(newValue, this._part, updater);
    }
  }
}
