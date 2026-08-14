export async function ensureServicePool({
  requirements,
  previousIds = [],
  previouslyOwnedIds = [],
  listInstances,
  startInstances
}) {
  const available = await listInstances();
  const selected = [];
  const ownedIds = new Set(previouslyOwnedIds);

  for (const { service, count } of requirements) {
    const preferred = previousIds
      .map((id) => available.find((instance) => instance.id === id && instance.serviceKey === service.key))
      .filter(Boolean);
    const candidates = available.filter((instance) => instance.serviceKey === service.key);
    const matches = [];

    for (const instance of [...preferred, ...candidates]) {
      if (matches.length === count) break;
      if (!matches.some(({ id }) => id === instance.id)) matches.push(instance);
    }

    if (matches.length < count) {
      const started = await startInstances(service, count - matches.length);
      matches.push(...started);
      started.forEach(({ id }) => ownedIds.add(id));
    }
    selected.push(...matches);
  }

  return {
    services: selected,
    ownedIds: [...ownedIds].filter((id) => selected.some((service) => service.id === id))
  };
}
