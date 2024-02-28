import {
  ArraySignal,
  AtomSignal,
  StructSignal,
  TrackingSignal,
} from '../src/signal.js';

interface PersonState {
  firstName: AtomSignal<string>;
  lastName: AtomSignal<string>;
  addresses: ArraySignal<AtomSignal<string>>;
}

class PersonStore extends StructSignal<PersonState> {
  readonly fullName = new TrackingSignal(
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
  addresses: new ArraySignal([
    new AtomSignal('Tokyo'),
    new AtomSignal('Saitama'),
  ]),
});

console.log(store.version, store.fullName.version, store.fullName.value);

store.firstName.value = 'Donald';

console.log(store.version, store.fullName.version, store.fullName.value);

store.lastName.value = 'Tramp';

console.log(store.version, store.fullName.version, store.fullName.value);

console.log(JSON.stringify(store, null, 2));
