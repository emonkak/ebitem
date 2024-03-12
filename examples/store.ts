import {
  AtomSignal,
  ComputedSignal,
  MemoizedSignal,
  Signal,
} from '../src/signal.js';

type Visibility = 'all' | 'active' | 'done';

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

interface TodoState {
  todos: Todo[];
  visibility: Visibility;
}

class TodoStore {
  public readonly todos: AtomSignal<Todo[]>;

  public readonly visibility: AtomSignal<Visibility>;

  public readonly visibleTodos: MemoizedSignal<Todo[]>;

  constructor({ todos, visibility }: TodoState) {
    this.todos = new AtomSignal(todos);

    this.visibility = new AtomSignal(visibility);

    this.visibleTodos = ComputedSignal.compose(
      (todos, visibility) => {
        switch (visibility) {
          case 'all':
            return todos.slice();
          case 'active':
            return todos.filter((todo) => !todo.done);
          case 'done':
            return todos.filter((todo) => todo.done);
        }
      },
      [this.todos, this.visibility],
    ).memoized();
  }

  addTodo(todo: Todo): void {
    this.todos.mutate((todos) => {
      todos.push(todo);
    });
  }
}

const todoStore = new TodoStore({
  todos: [
    {
      id: 1,
      title: 'foo',
      done: false,
    },
    {
      id: 2,
      title: 'bar',
      done: true,
    },
    {
      id: 3,
      title: 'baz',
      done: false,
    },
  ],
  visibility: 'all',
});

todoStore.addTodo({
  id: 4,
  title: 'qux',
  done: true,
});

console.log(todoStore.visibleTodos.value);

todoStore.visibility.value = 'done';

console.log(todoStore.visibleTodos.value);
