import {
  Binding,
  Directive,
  createBinding,
  directiveTag,
  updateBinding,
} from '../binding.js';
import type { Part, Updater } from '../types.js';
import { nullDirective } from './null.js';

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
): ConditionDirective<TTrue, typeof nullDirective> {
  return new ConditionDirective(condition, trueCase, nullDirective);
}

export function unless<TFalse>(
  condition: boolean,
  falseCase: ValueOrFunction<TFalse>,
): ConditionDirective<typeof nullDirective, TFalse> {
  return new ConditionDirective(condition, nullDirective, falseCase);
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
    const binding = new ConditionBinding<TTrue, TFalse>(part, this);

    binding.bind(updater);

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

  private _directive: ConditionDirective<TTrue, TFalse>;

  private _trueBinding: Binding<TTrue> | null = null;

  private _falseBinding: Binding<TFalse> | null = null;

  private _condition;

  constructor(part: Part, directive: ConditionDirective<TTrue, TFalse>) {
    this._part = part;
    this._directive = directive;
    this._condition = directive.condition;
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
        this._trueBinding = updateBinding(
          this._trueBinding,
          newValue,
          updater,
          this._condition !== condition,
        );
      } else {
        this._trueBinding = createBinding(this._part, newValue, updater);
      }
    } else {
      const newValue =
        typeof falseCase === 'function' ? falseCase() : falseCase;
      if (this._condition !== condition) {
        this._trueBinding?.unbind(updater);
      }
      if (this._falseBinding !== null) {
        this._falseBinding = updateBinding(
          this._falseBinding,
          newValue,
          updater,
          this._condition !== condition,
        );
      } else {
        this._falseBinding = createBinding(this._part, newValue, updater);
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
