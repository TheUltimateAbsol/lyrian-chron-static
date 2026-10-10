// Shared by the static class pages and the character planner. Proficiency
// overlap alone is deliberately not a partial-refund signal.
export function refundCandidates(collections) {
  const keys = new Map(collections.keyAbilities.map(x => [x.indexId, x]));
  const slots = x => [x.keyAbility, x.ability1, x.ability2, x.ability3, x.ultimateAbility].filter(Boolean);
  const result = new Map(collections.classes.map(x => [x.classId, []]));
  for (const cls of collections.classes) {
    for (const other of collections.classes) {
      if (cls === other) continue;
      const key = keys.get(cls.keyAbility), otherKey = keys.get(other.keyAbility);
      for (const id of slots(cls).filter(id => slots(other).includes(id))) {
        result.get(cls.classId).push({ type: "full", abilityId: id, classId: other.classId, name: other.name });
      }
      if (key?.associatedAbility && key.indexId !== otherKey?.indexId
        && (key.associatedAbility === otherKey?.associatedAbility || slots(other).includes(key.associatedAbility))) {
        result.get(cls.classId).push({ type: "partial", abilityId: key.indexId, sharedAbilityId: key.associatedAbility, classId: other.classId, name: other.name });
      }
    }
    const key = keys.get(cls.keyAbility);
    if (!key?.associatedAbility) continue;
    for (const race of collections.ancestries) {
      if ([race.trait1, race.trait2, race.trait3].includes(key.associatedAbility)) {
        result.get(cls.classId).push({ type: "partial", abilityId: key.indexId, sharedAbilityId: key.associatedAbility, sourceType: "race", name: race.name, url: `/races/${race.ancestryId}/` });
      }
    }
    for (const race of collections.primaryRaces) {
      for (const clan of ["wi", "lir", "d", "ar", "lu", "ni", "un", "vi", "none"]) {
        const feature = race[clan];
        if (feature?.ability !== key.associatedAbility) continue;
        // Un/Vi/Wi already give their corresponding class, so there is no
        // second unlock purchase to refund for those classes.
        if (feature.text?.toLowerCase().includes(`${cls.name.toLowerCase()} class unlocked`)) continue;
        result.get(cls.classId).push({ type: "partial", abilityId: key.indexId, sharedAbilityId: key.associatedAbility, sourceType: "race", name: `${race.name} · ${clan.toUpperCase()} clan`, url: `/races/${race.primaryRaceId}/` });
      }
    }
  }
  return result;
}
