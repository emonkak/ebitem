export function dependenciesAreChanged(
  oldDependencies: unknown[] | undefined,
  newDependencies: unknown[] | undefined,
): boolean {
  return (
    oldDependencies === undefined ||
    newDependencies === undefined ||
    oldDependencies.length !== newDependencies.length ||
    newDependencies.some(
      (dependencies, index) => !Object.is(dependencies, oldDependencies[index]),
    )
  );
}

export function shallowEqual(
  first: { [key: string]: unknown },
  second: { [key: string]: unknown },
): boolean {
  if (first === second) {
    return true;
  }

  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  for (let i = 0, l = firstKeys.length; i < l; i++) {
    const key = firstKeys[i]!;
    if (!Object.hasOwn(second, key) || first[key] !== second[key]!) {
      return false;
    }
  }

  return true;
}
