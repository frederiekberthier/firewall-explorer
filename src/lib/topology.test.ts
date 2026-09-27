import { describe, it, expect } from 'vitest';
import { pathBetween, connectionIdsOnPath, pointAlongPolyline } from './topology';
import { NetworkNode } from '@/types/firewall';

const n = (id: string, type: NetworkNode['type'], parentId: string | null, x = 0, y = 0): NetworkNode => ({
  id, type, name: id, x, y, parentId
});

const nodes: NetworkNode[] = [
  n('router', 'router', null),
  n('inet', 'internet', 'router'),
  n('data', 'vlan', 'router'),
  n('sec', 'vlan', 'router'),
  n('pc1', 'host', 'data'),
  n('pc2', 'host', 'data'),
  n('cam', 'host', 'sec')
];
const ids = (path: NetworkNode[]) => path.map(p => p.id);

describe('pathBetween', () => {
  it('goes up through the parents to the router and down to the destination', () => {
    expect(ids(pathBetween(nodes, 'pc1', 'cam'))).toEqual(['pc1', 'data', 'router', 'sec', 'cam']);
    expect(ids(pathBetween(nodes, 'pc1', 'inet'))).toEqual(['pc1', 'data', 'router', 'inet']);
  });

  it('follows the direction of the packet (a reply goes back)', () => {
    expect(ids(pathBetween(nodes, 'inet', 'pc1'))).toEqual(['inet', 'router', 'data', 'pc1']);
  });

  it('stays inside a VLAN for two hosts of the same VLAN', () => {
    expect(ids(pathBetween(nodes, 'pc1', 'pc2'))).toEqual(['pc1', 'data', 'pc2']);
  });

  it('handles the router itself as destination', () => {
    expect(ids(pathBetween(nodes, 'pc1', 'router'))).toEqual(['pc1', 'data', 'router']);
  });

  it('returns an empty path for unknown nodes', () => {
    expect(pathBetween(nodes, 'pc1', 'missing')).toEqual([]);
  });
});

describe('connectionIdsOnPath', () => {
  it('finds the connections between consecutive nodes, in either orientation', () => {
    const connections = [
      { id: 'c1', fromId: 'router', toId: 'data' },
      { id: 'c2', fromId: 'data', toId: 'pc1' },
      { id: 'c3', fromId: 'router', toId: 'inet' },
      { id: 'c4', fromId: 'router', toId: 'sec' }
    ];
    expect(connectionIdsOnPath(pathBetween(nodes, 'pc1', 'inet'), connections)).toEqual(['c2', 'c1', 'c3']);
  });
});

describe('pointAlongPolyline', () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }];

  it('returns the start, the end and points in between at constant speed', () => {
    expect(pointAlongPolyline(points, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPolyline(points, 1)).toEqual({ x: 100, y: 300 });
    // Total length 400: a quarter is the end of the first segment.
    expect(pointAlongPolyline(points, 0.25)).toEqual({ x: 100, y: 0 });
    expect(pointAlongPolyline(points, 0.5)).toEqual({ x: 100, y: 100 });
  });

  it('clamps t to 0..1', () => {
    expect(pointAlongPolyline(points, -1)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPolyline(points, 2)).toEqual({ x: 100, y: 300 });
  });
});
