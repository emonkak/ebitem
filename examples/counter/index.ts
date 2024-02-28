import {
  AsyncUpdater,
  Block,
  Context,
  Scope,
  TemplateResult,
  mount,
} from '@emonkak/tempura';
import {
  block,
  classList,
  elementRef,
  list,
  slot,
} from '@emonkak/tempura/directives.js';
import { Signal, atom } from '@emonkak/tempura/signal.js';

const counterSignal = atom(0);

function App(_props: {}, context: Context): TemplateResult {
  const [items, setItems] = context.useState([
    'foo',
    'bar',
    'baz',
    'qux',
    'quux',
  ]);

  context.setContextValue('state', 'My Env');

  const itemsList = context.useMemo(
    () =>
      list(
        items,
        (item, index) =>
          block(Item, {
            title: item,
            onUp: () => {
              if (index > 0) {
                const newItems = items.slice();
                const tmp = newItems[index]!;
                newItems[index] = newItems[index - 1]!;
                newItems[index - 1] = tmp;
                setItems(newItems);
              }
            },
            onDown: () => {
              if (index + 1 < items.length) {
                const newItems = items.slice();
                const tmp = newItems[index]!;
                newItems[index] = newItems[index + 1]!;
                newItems[index + 1] = tmp;
                setItems(newItems);
              }
            },
            onDelete: () => {
              const newItems = items.slice();
              newItems.splice(index, 1);
              setItems(newItems);
            },
          }),
        (_item, index) => index,
      ),
    [items],
  );

  const onIncrement = context.useEvent((_event) => {
    counterSignal.value += 1;
  });
  const onDecrement = context.useEvent((_event) => {
    counterSignal.value -= 1;
  });
  const onShuffle = context.useEvent((_event) => {
    const newItems = shuffle(items.slice());
    setItems(newItems);
  });

  return context.html`
    <div ${{ class: 'root' }}>
      ${block(Counter, {
        count: counterSignal,
      })}
      <ul>${itemsList}</ul>
      <p>
        <button type="button" @click=${onIncrement}>+1</button>
        <button type="button" @click=${onDecrement}>-1</button>
        <button type="button" @click=${onShuffle}>Shuffle</button>
      </p>
      ${context.html`<div>Hello World!</div>`}
      ${slot(
        'article',
        { lang: 'en' },
        context.html`<span>Hello World!</span>`,
      )}
    </div>
    <svg width="100" height="100" viewBox="0 0 100 100">${block(Circle, {
      cx: 50,
      cy: 50,
      r: 50,
      fill: 'red',
    })}</svg>
  `;
}

interface CircleProps {
  cx: number;
  cy: number;
  r: number;
  fill: string;
}

function Circle(
  { cx, cy, r, fill }: CircleProps,
  context: Context,
): TemplateResult {
  return context.svg`
    <circle cx=${cx} cy=${cy} r=${r} fill=${fill} />
  `;
}

interface ItemProps {
  title: string;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}

function Item(
  { title, onUp, onDown, onDelete }: ItemProps,
  context: Context,
): TemplateResult {
  const state = context.getContextValue('state');

  return context.html`
    <li>
      <span>${title} (${state})</span>
      <button type="button" @click=${context.useEvent(onUp)}>Up</button>
      <button type="button" @click=${context.useEvent(onDown)}>Down</button>
      <button type="button" @click=${context.useEvent(onDelete)}>Delete</button>
    </li>
  `;
}

interface CounterProps {
  count: Signal<number>;
}

function Counter({ count }: CounterProps, context: Context): TemplateResult {
  const countLabelRef = context.useRef<Element | null>(null);

  context.useSignal(count);

  return context.html`
    <h1>
      <span class="count-label" ref=${elementRef(countLabelRef)}>COUNT: </span>
      <span
        class=${classList('count-value', {
          'is-odd': count.value % 2 !== 0,
          'is-even': count.value % 2 === 0,
        })}
        data-count=${count}>${count}</span>
    </h1>
  `;
}

function shuffle<T>(elements: T[]): T[] {
  let currentIndex = elements.length;

  while (currentIndex > 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    const tmp = elements[currentIndex]!;
    elements[currentIndex] = elements[randomIndex]!;
    elements[randomIndex] = tmp;
  }

  return elements;
}

const updater = new AsyncUpdater(new Scope());

mount(updater, new Block(App, {}), document.body);
