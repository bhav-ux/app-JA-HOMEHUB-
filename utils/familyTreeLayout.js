// Pure layout engine for the Family Tree screen.
//
// Relationship semantics: { fromMemberId, toMemberId, type } reads as
// "fromMember is the `type` of toMember" (e.g. type: 'father' means
// fromMember is toMember's father).

export const NODE_SIZE = 64;     // circular profile photo diameter
export const CARD_WIDTH = 96;    // total node footprint width (photo + label)
export const CARD_HEIGHT = 122;  // photo + name + relationship label
export const H_GAP = 28;
export const V_GAP = 64;
export const SLOT_WIDTH = CARD_WIDTH + H_GAP;
export const ROW_HEIGHT = CARD_HEIGHT + V_GAP;

// How many generations `toMember` sits below `fromMember` for a given type.
const GEN_STEP = {
  father: 1,
  mother: 1,
  grandfather: 2,
  grandmother: 2,
  uncle: 1,
  aunt: 1,
  son: -1,
  daughter: -1,
  spouse: 0,
  brother: 0,
  sister: 0,
  cousin: 0,
};

// Relationship types rendered as a simple connecting line between two nodes
// (not part of the parent → child "bus" layout).
const SECONDARY_TYPES = new Set(['grandfather', 'grandmother', 'uncle', 'aunt', 'cousin']);

function sortKey(member) {
  const ts = member.createdAt;
  if (ts?.toMillis) return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return Number.MAX_SAFE_INTEGER;
}

export function computeFamilyTreeLayout(members, relationships) {
  if (!members?.length) {
    return { nodes: [], connectors: [], width: 0, height: 0 };
  }

  const sortedMembers = [...members].sort((a, b) => {
    const diff = sortKey(a) - sortKey(b);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  const membersById = new Map(sortedMembers.map((m) => [m.id, m]));
  const validRelationships = (relationships || []).filter(
    (r) => membersById.has(r.fromMemberId) && membersById.has(r.toMemberId)
  );

  // ── 1. Generation assignment via BFS over generation-step edges ──────────
  const adjacency = new Map(sortedMembers.map((m) => [m.id, []]));
  validRelationships.forEach((rel) => {
    const step = GEN_STEP[rel.type] ?? 0;
    adjacency.get(rel.fromMemberId).push({ other: rel.toMemberId, step });
    adjacency.get(rel.toMemberId).push({ other: rel.fromMemberId, step: -step });
  });

  const generation = new Map();
  sortedMembers.forEach((member) => {
    if (generation.has(member.id)) return;
    generation.set(member.id, 0);
    const queue = [member.id];
    while (queue.length) {
      const current = queue.shift();
      const currentGen = generation.get(current);
      adjacency.get(current).forEach(({ other, step }) => {
        if (generation.has(other)) return;
        generation.set(other, currentGen + step);
        queue.push(other);
      });
    }
  });

  // ── 2. Group members into spouse units ────────────────────────────────────
  const spouseOf = new Map();
  validRelationships.forEach((rel) => {
    if (rel.type !== 'spouse') return;
    if (!spouseOf.has(rel.fromMemberId)) spouseOf.set(rel.fromMemberId, rel.toMemberId);
    if (!spouseOf.has(rel.toMemberId)) spouseOf.set(rel.toMemberId, rel.fromMemberId);
  });

  const memberToUnit = new Map();
  const units = [];
  sortedMembers.forEach((member) => {
    if (memberToUnit.has(member.id)) return;
    const unit = { id: `unit-${units.length}`, memberIds: [member.id] };
    const spouseId = spouseOf.get(member.id);
    if (spouseId && membersById.has(spouseId) && !memberToUnit.has(spouseId)) {
      unit.memberIds.push(spouseId);
      memberToUnit.set(spouseId, unit.id);
    }
    memberToUnit.set(member.id, unit.id);
    units.push(unit);
  });
  const unitsById = new Map(units.map((u) => [u.id, u]));
  const unitGeneration = (unit) => generation.get(unit.memberIds[0]) ?? 0;

  // ── 3. Direct parent → child unit edges (father/mother/son/daughter) ─────
  const unitChildren = new Map(units.map((u) => [u.id, new Set()]));
  const unitParents = new Map(units.map((u) => [u.id, new Set()]));
  validRelationships.forEach((rel) => {
    let parentId = null;
    let childId = null;
    if (rel.type === 'father' || rel.type === 'mother') {
      parentId = rel.fromMemberId;
      childId = rel.toMemberId;
    } else if (rel.type === 'son' || rel.type === 'daughter') {
      parentId = rel.toMemberId;
      childId = rel.fromMemberId;
    } else {
      return;
    }
    const parentUnit = memberToUnit.get(parentId);
    const childUnit = memberToUnit.get(childId);
    if (parentUnit && childUnit && parentUnit !== childUnit) {
      unitChildren.get(parentUnit).add(childUnit);
      unitParents.get(childUnit).add(parentUnit);
    }
  });

  // ── 4. Horizontal placement (Reingold-Tilford-lite) ───────────────────────
  const unitCenterX = new Map();
  const placed = new Set();
  let cursor = 0;
  const widthOfUnit = (unit) => unit.memberIds.length * SLOT_WIDTH;

  const place = (unitId) => {
    if (placed.has(unitId)) return unitCenterX.get(unitId);
    placed.add(unitId);
    const unit = unitsById.get(unitId);
    const children = [...unitChildren.get(unitId)].filter((c) => !placed.has(c));
    let center;
    if (children.length === 0) {
      const w = widthOfUnit(unit);
      center = cursor + w / 2;
      cursor += w;
    } else {
      const centers = children.map(place);
      center = centers.reduce((sum, c) => sum + c, 0) / centers.length;
    }
    unitCenterX.set(unitId, center);
    return center;
  };

  const rootUnits = units
    .filter((u) => unitParents.get(u.id).size === 0)
    .sort((a, b) => unitGeneration(a) - unitGeneration(b));
  rootUnits.forEach((u) => place(u.id));
  units.forEach((u) => { if (!placed.has(u.id)) place(u.id); });

  // ── 5. Build node list (member-level x/y) ─────────────────────────────────
  const minGeneration = Math.min(...units.map(unitGeneration));
  const nodes = [];
  units.forEach((unit) => {
    const center = unitCenterX.get(unit.id);
    const leftEdge = center - widthOfUnit(unit) / 2;
    const gen = unitGeneration(unit) - minGeneration;
    unit.memberIds.forEach((memberId, i) => {
      const x = leftEdge + i * SLOT_WIDTH;
      const y = gen * ROW_HEIGHT;
      nodes.push({
        id: memberId,
        member: membersById.get(memberId),
        x,
        y,
        centerX: x + CARD_WIDTH / 2,
        photoTop: y,
        photoBottom: y + NODE_SIZE,
        photoMid: y + NODE_SIZE / 2,
        generation: gen,
      });
    });
  });

  // Normalize so the layout starts at (PAD, PAD).
  const PAD = SLOT_WIDTH / 2;
  const minX = Math.min(...nodes.map((n) => n.x));
  const offsetX = PAD - minX;
  nodes.forEach((n) => {
    n.x += offsetX;
    n.centerX += offsetX;
  });

  // ── 6. Connectors ──────────────────────────────────────────────────────────
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const connectors = [];

  // Spouse connectors
  const drawnSpousePairs = new Set();
  validRelationships.forEach((rel) => {
    if (rel.type !== 'spouse') return;
    const key = [rel.fromMemberId, rel.toMemberId].sort().join('|');
    if (drawnSpousePairs.has(key)) return;
    drawnSpousePairs.add(key);
    const a = nodesById.get(rel.fromMemberId);
    const b = nodesById.get(rel.toMemberId);
    if (!a || !b) return;
    connectors.push({ kind: 'spouse', x1: a.centerX, y1: a.photoMid, x2: b.centerX, y2: b.photoMid });
  });

  // Parent → children "bus" connectors
  unitChildren.forEach((childSet, parentUnitId) => {
    if (childSet.size === 0) return;
    const parentUnit = unitsById.get(parentUnitId);
    const parentNodes = parentUnit.memberIds.map((id) => nodesById.get(id));
    const dropX = parentNodes.reduce((sum, n) => sum + n.centerX, 0) / parentNodes.length;
    const dropY = Math.max(...parentNodes.map((n) => n.photoBottom));
    const childNodes = [...childSet].flatMap((cid) =>
      unitsById.get(cid).memberIds.map((id) => nodesById.get(id))
    );
    if (!childNodes.length) return;
    const busY = dropY + V_GAP / 2;
    const childXs = childNodes.map((n) => n.centerX);
    const minCX = Math.min(...childXs, dropX);
    const maxCX = Math.max(...childXs, dropX);

    connectors.push({ kind: 'parentChild', x1: dropX, y1: dropY, x2: dropX, y2: busY });
    connectors.push({ kind: 'parentChild', x1: minCX, y1: busY, x2: maxCX, y2: busY });
    childNodes.forEach((n) => {
      connectors.push({ kind: 'parentChild', x1: n.centerX, y1: busY, x2: n.centerX, y2: n.photoTop });
    });
  });

  // Secondary connectors (grandparent / uncle / aunt / cousin)
  const drawnSecondary = new Set();
  validRelationships.forEach((rel) => {
    if (!SECONDARY_TYPES.has(rel.type)) return;
    const key = `${[rel.fromMemberId, rel.toMemberId].sort().join('|')}`;
    if (drawnSecondary.has(key)) return;
    drawnSecondary.add(key);
    const a = nodesById.get(rel.fromMemberId);
    const b = nodesById.get(rel.toMemberId);
    if (!a || !b) return;
    connectors.push({ kind: 'secondary', x1: a.centerX, y1: a.photoMid, x2: b.centerX, y2: b.photoMid });
  });

  const maxX = Math.max(...nodes.map((n) => n.x + CARD_WIDTH)) + PAD;
  const maxY = Math.max(...nodes.map((n) => n.y + CARD_HEIGHT)) + PAD;

  return { nodes, connectors, width: maxX, height: maxY };
}

// Builds relationship-label lookups for a given member: returns an array of
// human-readable labels describing how other members relate to this one.
export function getRelationshipLabelsForMember(memberId, relationships, membersById, relationshipLabelFn) {
  const labels = [];
  (relationships || []).forEach((rel) => {
    if (rel.fromMemberId === memberId) {
      const other = membersById.get(rel.toMemberId);
      if (other) labels.push(`${relationshipLabelFn(rel.type)} of ${other.name}`);
    }
  });
  return labels;
}
