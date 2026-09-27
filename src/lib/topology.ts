import { NetworkNode } from '@/types/firewall';

/** The node itself followed by its parents, up to the root (the router). */
function chainToRoot(nodes: NetworkNode[], nodeId: string): NetworkNode[] {
  const chain: NetworkNode[] = [];
  const seen = new Set<string>();
  let current = nodes.find(n => n.id === nodeId);
  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = current.parentId ? nodes.find(n => n.id === current!.parentId) : undefined;
  }
  return chain;
}

/**
 * Nodes a packet passes from `sourceId` to `destinationId` in the tree
 * topology (every node hangs off one parent): up from the source to the
 * first node both share (usually the router), then down to the destination.
 * Empty when either node is unknown or they are not connected.
 */
export function pathBetween(nodes: NetworkNode[], sourceId: string, destinationId: string): NetworkNode[] {
  const up = chainToRoot(nodes, sourceId);
  const down = chainToRoot(nodes, destinationId);
  const meetIndex = up.findIndex(n => down.some(d => d.id === n.id));
  if (up.length === 0 || down.length === 0 || meetIndex < 0) return [];

  const meet = up[meetIndex];
  const downToMeet = down.slice(0, down.findIndex(d => d.id === meet.id));
  return [...up.slice(0, meetIndex + 1), ...downToMeet.reverse()];
}

/** Ids of the connections (either orientation) between consecutive nodes of a path. */
export function connectionIdsOnPath(
  path: NetworkNode[],
  connections: { id: string; fromId: string; toId: string }[]
): string[] {
  const ids: string[] = [];
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1].id, path[i].id];
    const conn = connections.find(c => (c.fromId === a && c.toId === b) || (c.fromId === b && c.toId === a));
    if (conn) ids.push(conn.id);
  }
  return ids;
}

/**
 * Point at fraction `t` (0..1) of the total length along a polyline, so a
 * marker moves at constant speed over segments of different lengths.
 */
export function pointAlongPolyline(points: { x: number; y: number }[], t: number): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { x: points[0].x, y: points[0].y };

  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = lengths.reduce((sum, l) => sum + l, 0);
  if (total === 0) return { x: points[0].x, y: points[0].y };

  let remaining = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] === 0 ? 0 : Math.min(remaining / lengths[i], 1);
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * f,
        y: points[i].y + (points[i + 1].y - points[i].y) * f
      };
    }
    remaining -= lengths[i];
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}
