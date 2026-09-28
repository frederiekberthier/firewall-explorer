// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkState, DEFAULT_FIREWALL_POLICY } from './useNetworkState';
import { findScenario } from '@/data/scenarios';

// By id, not by position: new scenarios can be added anywhere in the catalogue.
const KANTOOR = findScenario('h5-1-kantoor-sec')!;
import { HOST_SPACING } from '@/lib/layout';
import { gradeScenario } from '@/lib/scenarioGrading';

describe('useNetworkState.loadScenario', () => {
  it('builds a topology with real addressing from a scenario', () => {
    const { result } = renderHook(() => useNetworkState());
    const scenario = KANTOOR;

    act(() => {
      result.current.loadScenario(scenario);
    });

    expect(result.current.activeScenario?.meta.id).toBe(scenario.meta.id);
    expect(result.current.nodes.some(n => n.type === 'internet')).toBe(true);

    const vlanNodes = result.current.nodes.filter(n => n.type === 'vlan');
    expect(vlanNodes).toHaveLength(scenario.topology.vlans.length);
    vlanNodes.forEach(v => {
      expect(v.subnet).toMatch(/^192\.168\.\d+\.0\/24$/);
      expect(v.gateway).toBeTruthy();
    });

    const hostNodes = result.current.nodes.filter(n => n.type === 'host');
    const expectedHostCount = scenario.topology.vlans.reduce((sum, v) => sum + (v.hosts?.length ?? 0), 0);
    expect(hostNodes).toHaveLength(expectedHostCount);
    hostNodes.forEach(h => {
      expect(h.ip).toBeTruthy();
      expect(vlanNodes.some(v => v.id === h.parentId)).toBe(true);
    });
  });

  it('clears the active scenario without touching the network on clearScenario', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(KANTOOR); });
    const nodesBefore = result.current.nodes;

    act(() => { result.current.clearScenario(); });

    expect(result.current.activeScenario).toBeNull();
    expect(result.current.nodes).toBe(nodesBefore);
  });

  it('resetNetwork also clears the active scenario', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(KANTOOR); });
    act(() => { result.current.resetNetwork(); });

    expect(result.current.activeScenario).toBeNull();
    expect(result.current.nodes).toHaveLength(1);
  });

  it('lays out many VLANs centred under the router without overlapping hosts', () => {
    const { result } = renderHook(() => useNetworkState());
    const vlans = Array.from({ length: 6 }, (_, i) => ({
      name: `VLAN${i + 1}`,
      hosts: [`PC ${i}a`, `PC ${i}b`, `PC ${i}c`]
    }));
    act(() => {
      result.current.loadScenario({ ...KANTOOR, topology: { ...KANTOOR.topology, vlans } });
    });

    const router = result.current.nodes.find(n => n.type === 'router')!;
    const vlanXs = result.current.nodes.filter(n => n.type === 'vlan').map(n => n.x);
    const mean = vlanXs.reduce((sum, x) => sum + x, 0) / vlanXs.length;
    expect(mean).toBeCloseTo(router.x);

    const hostXs = result.current.nodes.filter(n => n.type === 'host').map(n => n.x).sort((a, b) => a - b);
    for (let i = 1; i < hostXs.length; i++) {
      expect(hostXs[i] - hostXs[i - 1]).toBeGreaterThanOrEqual(HOST_SPACING);
    }
  });
});

describe('useNetworkState.addressLists', () => {
  it('creates an address list with the given members', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(KANTOOR); });
    const vlanIds = result.current.nodes.filter(n => n.type === 'vlan').map(n => n.id);

    act(() => { result.current.addAddressList('trusted', vlanIds); });

    expect(result.current.addressLists).toHaveLength(1);
    expect(result.current.addressLists[0]).toMatchObject({ name: 'trusted', memberIds: vlanIds });
  });

  it('removes a node from any address list it belongs to when that node is deleted', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(KANTOOR); });
    const [vlanA, vlanB] = result.current.nodes.filter(n => n.type === 'vlan');

    act(() => { result.current.addAddressList('both-vlans', [vlanA.id, vlanB.id]); });
    act(() => { result.current.deleteNode(vlanA.id); });

    expect(result.current.addressLists[0].memberIds).toEqual([vlanB.id]);
  });

  it('deleting an address list also removes rules that referenced it', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(KANTOOR); });
    const [vlanA, vlanB] = result.current.nodes.filter(n => n.type === 'vlan');

    act(() => { result.current.addAddressList('list', [vlanA.id]); });
    const listId = result.current.addressLists[0].id;
    act(() => {
      result.current.addRule({ sourceId: listId, destinationId: vlanB.id, connectionStates: ['new'], action: 'allow' });
    });
    expect(result.current.rules).toHaveLength(1);

    act(() => { result.current.deleteAddressList(listId); });

    expect(result.current.addressLists).toHaveLength(0);
    expect(result.current.rules).toHaveLength(0);
  });

  it('resetNetwork also clears address lists', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(KANTOOR); });
    const vlanIds = result.current.nodes.filter(n => n.type === 'vlan').map(n => n.id);
    act(() => { result.current.addAddressList('trusted', vlanIds); });

    act(() => { result.current.resetNetwork(); });

    expect(result.current.addressLists).toHaveLength(0);
  });
});

describe('useNetworkState node names', () => {
  it('does not hand out a duplicate name after a node was deleted', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.setSelectedNodeId(result.current.ROUTER_ID); });
    act(() => { result.current.addNode('host'); });
    act(() => { result.current.addNode('host'); });
    const host1 = result.current.nodes.find(n => n.name === 'Host 1')!;

    act(() => { result.current.deleteNode(host1.id); });
    act(() => { result.current.addNode('host'); });

    const hostNames = result.current.nodes.filter(n => n.type === 'host').map(n => n.name).sort();
    expect(hostNames).toEqual(['Host 1', 'Host 2']);
  });

  it('keeps scenario requirements resolvable after renaming a scenario node', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(KANTOOR); });
    const data = result.current.nodes.find(n => n.name === 'DATA')!;
    expect(data.scenarioRef).toBe('DATA');

    act(() => { result.current.updateNode(data.id, { name: 'Kantoor' }); });

    const report = gradeScenario(KANTOOR, result.current.nodes, [], 'block-all');
    expect(report.intentResults.every(r => !r.reason.includes('niet terugvinden'))).toBe(true);
  });
});

describe('useNetworkState rule order', () => {
  const setup = () => {
    const hook = renderHook(() => useNetworkState());
    act(() => { hook.result.current.addNode('vlan'); });
    act(() => { hook.result.current.addNode('vlan'); });
    act(() => { hook.result.current.addNode('vlan'); });
    return hook;
  };
  const vlanIds = (nodes: { id: string; type: string }[]) => nodes.filter(n => n.type === 'vlan').map(n => n.id);
  const orders = (rules: { order: number }[]) => rules.map(r => r.order).sort((a, b) => a - b);

  it('keeps rule order values unique after deleting a node that a rule used', () => {
    const { result } = setup();
    const [a, b, c] = vlanIds(result.current.nodes);
    act(() => { result.current.addRule({ sourceId: a, destinationId: b, connectionStates: ['new'], action: 'allow' }); });
    act(() => { result.current.addRule({ sourceId: b, destinationId: c, connectionStates: ['new'], action: 'allow' }); });
    act(() => { result.current.addRule({ sourceId: c, destinationId: b, connectionStates: ['new'], action: 'drop' }); });

    act(() => { result.current.deleteNode(a); }); // removes the rule with order 0
    act(() => { result.current.addRule({ sourceId: b, destinationId: c, connectionStates: ['established'], action: 'allow' }); });

    expect(orders(result.current.rules)).toEqual([0, 1, 2]);
    // The new rule comes last, as the student sees it.
    const last = [...result.current.rules].sort((x, y) => x.order - y.order)[2];
    expect(last.connectionStates).toEqual(['established']);
  });

  it('gives two rules added in the same tick distinct ids and order values', () => {
    const { result } = setup();
    const [a, b] = vlanIds(result.current.nodes);
    act(() => {
      result.current.addRule({ sourceId: a, destinationId: b, connectionStates: ['new'], action: 'allow' });
      result.current.addRule({ sourceId: b, destinationId: a, connectionStates: ['new'], action: 'allow' });
    });

    expect(new Set(result.current.rules.map(r => r.id)).size).toBe(2);
    expect(orders(result.current.rules)).toEqual([0, 1]);
  });

  it('removes an address list that became empty, together with the rules that used it', () => {
    const { result } = setup();
    const [a, b] = vlanIds(result.current.nodes);
    act(() => { result.current.addAddressList('alleen-a', [a]); });
    const listId = result.current.addressLists[0].id;
    act(() => { result.current.addRule({ sourceId: listId, destinationId: b, connectionStates: ['new'], action: 'allow' }); });
    act(() => { result.current.addRule({ sourceId: b, destinationId: listId, connectionStates: ['new'], action: 'drop' }); });
    act(() => { result.current.addRule({ sourceId: b, destinationId: 'ANY_VLAN', connectionStates: ['new'], action: 'allow' }); });

    act(() => { result.current.deleteNode(a); });

    expect(result.current.addressLists).toHaveLength(0);
    expect(result.current.rules).toHaveLength(1);
    expect(result.current.rules[0]).toMatchObject({ destinationId: 'ANY_VLAN', order: 0 });
  });
});

describe('useNetworkState default policy', () => {
  it('starts, resets and loads scenarios with Allow All, like a MikroTik', () => {
    expect(DEFAULT_FIREWALL_POLICY).toBe('allow-all');
    const { result } = renderHook(() => useNetworkState());
    expect(result.current.firewallPolicy).toBe('allow-all');

    act(() => { result.current.setFirewallPolicy('block-all'); });
    act(() => { result.current.loadScenario(KANTOOR); });
    expect(result.current.firewallPolicy).toBe('allow-all');

    act(() => { result.current.setFirewallPolicy('block-all'); });
    act(() => { result.current.resetNetwork(); });
    expect(result.current.firewallPolicy).toBe('allow-all');
  });
});

