export function setResource<K, V>(resources: ReadonlyMap<K, V>, key: K, value: V): Map<K, V> {
  return new Map([...resources, [key, value]]);
}

export function deleteResource<K, V>(resources: ReadonlyMap<K, V>, key: K): Map<K, V> {
  return new Map([...resources].filter(([currentKey]) => currentKey !== key));
}
