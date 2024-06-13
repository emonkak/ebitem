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
  firstProps: { [key: string]: unknown },
  secondProps: { [key: string]: unknown },
): boolean {
  if (firstProps === secondProps) {
    return true;
  }

  const firstKeys = Object.keys(firstProps);
  const secondKeys = Object.keys(secondProps);

  if (firstKeys.length !== secondKeys.length) {
    return false;
  }

  for (let i = 0, l = firstKeys.length; i < l; i++) {
    const key = firstKeys[i]!;
    if (
      !Object.hasOwn(secondProps, key) ||
      firstProps[key] !== secondProps[key]!
    ) {
      return false;
    }
  }

  return true;
}
