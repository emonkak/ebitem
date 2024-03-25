export interface Node<T> {
  prev: Node<T> | null;
  next: Node<T> | null;
  value: T;
}

export class LinkedList<T> {
  private _head: Node<T> | null = null;

  private _tail: Node<T> | null = null;

  *[Symbol.iterator]() {
    for (let node = this._head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  back(): Node<T> | null {
    return this._tail;
  }

  front(): Node<T> | null {
    return this._head;
  }

  isEmpty(): boolean {
    return this._head === null;
  }

  popBack(): Node<T> | null {
    const tail = this._tail;

    if (tail !== null && tail.prev !== null) {
      this._tail = tail.prev;
      this._tail.next = null;
      tail.prev = null;
    } else {
      this._head = null;
      this._tail = null;
    }

    return tail;
  }

  popFront(): Node<T> | null {
    const head = this._head;

    if (head !== null && head.next !== null) {
      this._head = head.next;
      this._head.prev = null;
      head.next = null;
    } else {
      this._head = null;
      this._tail = null;
    }

    return head;
  }

  pushBack(value: T): Node<T> {
    const node = { prev: this._tail, next: null, value };

    if (this._tail !== null) {
      this._tail.next = node;
      this._tail = node;
    } else {
      this._head = node;
      this._tail = node;
    }

    return node;
  }

  pushFront(value: T): Node<T> {
    const node = { prev: null, next: this._head, value };

    if (this._head !== null) {
      this._head.prev = node;
      this._head = node;
    } else {
      this._head = node;
      this._tail = node;
    }

    return node;
  }

  remove(node: Node<T>): void {
    if (node.prev !== null) {
      node.prev.next = node.next;
    } else {
      this._head = node.next;
    }
    if (node.next !== null) {
      node.next.prev = node.prev;
    } else {
      this._tail = node.prev;
    }
    node.prev = null;
    node.next = null;
  }
}
