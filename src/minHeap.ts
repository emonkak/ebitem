export type Compare<T> = (first: T, second: T) => number;

export class MinHeap<T> {
  private readonly _compareFn: Compare<T>;

  private readonly _elements: T[] = [];

  constructor(compareFn: Compare<T>) {
    this._compareFn = compareFn;
  }

  push(element: T): void {
    const index = this._elements.length;
    this._elements.push(element);
    this._siftUp(element, index);
  }

  peek(): T | undefined {
    return this._elements.length === 0 ? undefined : this._elements[0];
  }

  pop(): T | undefined {
    if (this._elements.length === 0) {
      return undefined;
    }
    const firstElement = this._elements[0]!;
    const lastElement = this._elements.pop()!;
    if (lastElement !== firstElement) {
      this._elements[0] = lastElement;
      this._siftDown(lastElement, 0);
    }
    return firstElement;
  }

  get size(): number {
    return this._elements.length;
  }

  private _siftUp(element: T, index: number): void {
    const compare = this._compareFn;
    while (index > 0) {
      const parentIndex = (index - 1) >>> 1;
      const parentElement = this._elements[parentIndex]!;
      if (compare(parentElement, element) > 0) {
        // The parent is larger. Swap positions.
        this._elements[parentIndex] = element;
        this._elements[index] = parentElement;
        index = parentIndex;
      } else {
        // The parent is smaller. Exit.
        return;
      }
    }
  }

  private _siftDown(element: T, index: number): void {
    const compare = this._compareFn;
    const length = this._elements.length;
    const halfLength = length >>> 1;

    while (index < halfLength) {
      const leftIndex = ((index + 1) << 1) - 1;
      const leftElement = this._elements[leftIndex]!;
      const rightIndex = leftIndex + 1;
      const rightElement = this._elements[rightIndex]!;

      let smallerIndex;
      let smallerElement;

      if (rightIndex < length && compare(rightElement, leftElement) < 0) {
        smallerIndex = rightIndex;
        smallerElement = rightElement;
      } else {
        smallerIndex = leftIndex;
        smallerElement = leftElement;
      }

      // If the left or right element is smaller, swap with the smaller of those.
      if (compare(smallerElement, element) < 0) {
        this._elements[index] = smallerElement;
        this._elements[smallerIndex] = element;
        index = smallerIndex;
      } else {
        // Neither child is smaller. Exit.
        return;
      }
    }
  }
}
