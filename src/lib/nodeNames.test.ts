import { describe, it, expect } from 'vitest';
import { nextNodeName, validateNodeName } from './nodeNames';
import { NetworkNode } from '@/types/firewall';

const node = (id: string, type: NetworkNode['type'], name: string): NetworkNode => ({
  id, type, name, x: 0, y: 0, parentId: type === 'router' ? null : 'router'
});

const nodes: NetworkNode[] = [
  node('router', 'router', 'Router'),
  node('inet', 'internet', 'Internet'),
  node('v1', 'vlan', 'DATA'),
  node('h2', 'host', 'Host 2')
];

describe('nextNodeName', () => {
  it('uses the lowest free number instead of a count', () => {
    // Host 1 was deleted, Host 2 still exists: counting would give "Host 2" again.
    expect(nextNodeName(nodes, 'host')).toBe('Host 1');
    expect(nextNodeName([...nodes, node('h1', 'host', 'Host 1')], 'host')).toBe('Host 3');
  });

  it('skips a number that is already taken by a renamed node, ignoring case', () => {
    expect(nextNodeName([...nodes, node('x', 'vlan', 'vlan 1')], 'vlan')).toBe('Vlan 2');
  });
});

describe('validateNodeName', () => {
  it('accepts a new, unique name and keeping the current name', () => {
    expect(validateNodeName(nodes, 'v1', 'Kantoor')).toBeNull();
    expect(validateNodeName(nodes, 'v1', 'DATA')).toBeNull();
    expect(validateNodeName(nodes, 'v1', 'data')).toBeNull(); // only the case changes
  });

  it('rejects a name another node already uses, ignoring case and spaces', () => {
    expect(validateNodeName(nodes, 'v1', '  host 2 ')).toBe('De naam "host 2" is al in gebruik.');
  });

  it('rejects empty and reserved names', () => {
    expect(validateNodeName(nodes, 'v1', '   ')).toBe('Geef een naam op.');
    for (const reserved of ['Router', 'internet', 'ANY', 'Any VLAN', 'Alles (ANY)']) {
      expect(validateNodeName(nodes, 'v1', reserved)).toContain('gereserveerde naam');
    }
  });

  it('lets the Internet node keep its own name', () => {
    expect(validateNodeName(nodes, 'inet', 'Internet')).toBeNull();
  });
});
