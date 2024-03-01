import { Context } from '../context.js';
import { Directive, directiveTag } from '../directive.js';
import type { Ref } from '../hook.js';
import type { Part } from '../part.js';
import { ElementPart } from '../part/element.js';
import type { Updater } from '../updater.js';

export function ref(ref: Ref<Element | null>) {
  return new RefDirective(ref);
}

export class RefDirective implements Directive<Context> {
  private readonly _ref: Ref<Element | null>;

  constructor(ref: Ref<Element | null>) {
    this._ref = ref;
  }

  [directiveTag](context: Context, part: Part, _updater: Updater): void {
    if (!(part instanceof ElementPart)) {
      throw new Error('ElementRef directive must be used in SpreadPart.');
    }

    const ref = this._ref;

    context.useEffect(() => {
      if (typeof ref === 'function') {
        ref(part.node);
        return () => {
          ref(part.node);
        };
      } else {
        ref.current = part.node;
        return () => {
          ref.current = null;
        };
      }
    }, [ref]);
  }
}
