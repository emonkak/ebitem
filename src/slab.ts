export interface Slot {
  index: number;
}

export class Slab<T> {
  private readonly _values: T[] = [];

  private readonly _slots: Slot[] = [];

  values(): T[] {
    return this._values;
  }

  get(slot: Readonly<Slot>): T | undefined {
    return this._slots[slot.index] === slot
      ? this._values[slot.index]
      : undefined;
  }

  insert(value: T): Readonly<Slot> {
    const slot = { index: this._slots.length };
    this._slots.push(slot);
    this._values.push(value);
    return slot;
  }

  remove(slot: Readonly<Slot>): T | undefined {
    if (this._slots[slot.index] !== slot) {
      return undefined;
    }

    const size = this._slots.length;
    const value = this._values[slot.index];

    if (slot.index + 1 < size) {
      const lastValue = this._values[size - 1]!;
      const lastSlot = this._slots[size - 1]!;
      lastSlot.index = slot.index;
      this._values[slot.index] = lastValue;
      this._slots[slot.index] = lastSlot;
    }

    this._slots.length = size - 1;
    this._values.length = size - 1;

    return value;
  }
}
