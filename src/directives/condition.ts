import {
  BindValueOf,
  Binding,
  Directive,
  Part,
  checkAndUpdateBinding,
  createBinding,
  directiveTag,
  updateBinding,
} from '../part.js';
import type { Updater } from '../updater.js';
import { nullDirective } from './null.js';

type ValueOrFunction<T> = T extends Function ? never : T | (() => T);

export function condition<TTrue, TFalse>(
  condition: ValueOrFunction<boolean>,
  trueCase: ValueOrFunction<TTrue>,
  falseCase: ValueOrFunction<TFalse>,
): ConditionDirective<TTrue, TFalse> {
  return new ConditionDirective(condition, trueCase, falseCase);
}

export function when<TTrue>(
  condition: ValueOrFunction<boolean>,
  trueCase: ValueOrFunction<TTrue>,
): ConditionDirective<TTrue, typeof nullDirective> {
  return new ConditionDirective(condition, trueCase, nullDirective);
}

export function unless<TFalse>(
  condition: ValueOrFunction<boolean>,
  falseCase: ValueOrFunction<TFalse>,
): ConditionDirective<typeof nullDirective, TFalse> {
  return new ConditionDirective(condition, nullDirective, falseCase);
}

export class ConditionDirective<TTrue, TFalse>
  implements Directive<ConditionDirective<TTrue, TFalse>>
{
  private readonly _condition: ValueOrFunction<boolean>;

  private readonly _trueCase: ValueOrFunction<TTrue>;

  private readonly _falseCase: ValueOrFunction<TFalse>;

  constructor(
    condition: ValueOrFunction<boolean>,
    trueCase: ValueOrFunction<TTrue>,
    falseCase: ValueOrFunction<TFalse>,
  ) {
    this._condition = condition;
    this._trueCase = trueCase;
    this._falseCase = falseCase;
  }

  get condition(): ValueOrFunction<boolean> {
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
    const binding = new ConditionBinding<TTrue, TFalse>(part);

    binding.bind(this, updater);

    return binding;
  }

  valueOf(): this {
    return this;
  }
}

export class ConditionBinding<TTrue, TFalse>
  implements Binding<ConditionDirective<TTrue, TFalse>>
{
  private readonly _part: Part;

  private _trueBinding: Binding<BindValueOf<TTrue>> | null = null;

  private _falseBinding: Binding<BindValueOf<TFalse>> | null = null;

  private _trueValue: TTrue | null = null;

  private _falseValue: TFalse | null = null;

  private _conditionValue = false;

  constructor(part: Part) {
    this._part = part;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    const binding = this._conditionValue
      ? this._trueBinding
      : this._falseBinding;
    return binding?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  bind(
    { condition, trueCase, falseCase }: ConditionDirective<TTrue, TFalse>,
    updater: Updater,
  ): void {
    const conditionValue =
      typeof condition === 'function' ? condition() : condition;

    if (conditionValue) {
      const newValue = typeof trueCase === 'function' ? trueCase() : trueCase;
      this._falseBinding?.unbind(updater);
      if (this._trueBinding !== null) {
        this._trueBinding = updateBinding(
          this._trueBinding,
          this._trueValue,
          newValue,
          updater,
        );
      } else {
        this._trueBinding = createBinding(this._part, newValue, updater);
      }
      this._trueValue = newValue;
    } else {
      const newValue =
        typeof falseCase === 'function' ? falseCase() : falseCase;
      this._trueBinding?.unbind(updater);
      if (this._falseBinding !== null) {
        const updateBindingFn = this._conditionValue
          ? updateBinding
          : checkAndUpdateBinding;
        this._falseBinding = updateBindingFn(
          this._falseBinding,
          this._falseValue,
          newValue,
          updater,
        );
      } else {
        this._falseBinding = createBinding(this._part, newValue, updater);
      }
      this._falseValue = newValue;
    }

    this._conditionValue = conditionValue;
  }

  unbind(updater: Updater): void {
    if (this._conditionValue) {
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
