import { Signal } from '../src/signal.js';
import { AtomSignal, AutoSignal, StructSignal } from '../src/signals.js';

interface PersonState {
  firstName: AtomSignal<string>;
  lastName: AtomSignal<string>;
}

class PersonStore extends StructSignal<PersonState> {
  readonly fullName: Signal<string> = new AutoSignal(
    ({ firstName, lastName }) => firstName.value + ' ' + lastName.value,
    this.value,
  );

  get firstName(): AtomSignal<string> {
    return this.value.firstName;
  }

  get lastName(): AtomSignal<string> {
    return this.value.lastName;
  }
}

const store = new PersonStore({
  firstName: new AtomSignal('John'),
  lastName: new AtomSignal('Doe'),
});

console.log(store.version);

console.log(store.version, store.fullName.version, store.fullName.value);

store.firstName.value = 'Donald';

console.log(store.version, store.fullName.version, store.fullName.value);

store.lastName.value = 'Tramp';

console.log(store.version, store.fullName.version, store.fullName.value);
