// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkState } from './useNetworkState';
import { SCENARIOS } from '@/data/scenarios';

describe('useNetworkState.loadScenario', () => {
  it('builds a topology with real addressing from a scenario', () => {
    const { result } = renderHook(() => useNetworkState());
    const scenario = SCENARIOS[0];

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
    act(() => { result.current.loadScenario(SCENARIOS[0]); });
    const nodesBefore = result.current.nodes;

    act(() => { result.current.clearScenario(); });

    expect(result.current.activeScenario).toBeNull();
    expect(result.current.nodes).toBe(nodesBefore);
  });

  it('resetNetwork also clears the active scenario', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(SCENARIOS[0]); });
    act(() => { result.current.resetNetwork(); });

    expect(result.current.activeScenario).toBeNull();
    expect(result.current.nodes).toHaveLength(1);
  });
});

describe('useNetworkState.addressLists', () => {
  it('creates an address list with the given members', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(SCENARIOS[0]); });
    const vlanIds = result.current.nodes.filter(n => n.type === 'vlan').map(n => n.id);

    act(() => { result.current.addAddressList('trusted', vlanIds); });

    expect(result.current.addressLists).toHaveLength(1);
    expect(result.current.addressLists[0]).toMatchObject({ name: 'trusted', memberIds: vlanIds });
  });

  it('removes a node from any address list it belongs to when that node is deleted', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(SCENARIOS[0]); });
    const [vlanA, vlanB] = result.current.nodes.filter(n => n.type === 'vlan');

    act(() => { result.current.addAddressList('both-vlans', [vlanA.id, vlanB.id]); });
    act(() => { result.current.deleteNode(vlanA.id); });

    expect(result.current.addressLists[0].memberIds).toEqual([vlanB.id]);
  });

  it('deleting an address list also removes rules that referenced it', () => {
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(SCENARIOS[0]); });
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
    act(() => { result.current.loadScenario(SCENARIOS[0]); });
    const vlanIds = result.current.nodes.filter(n => n.type === 'vlan').map(n => n.id);
    act(() => { result.current.addAddressList('trusted', vlanIds); });

    act(() => { result.current.resetNetwork(); });

    expect(result.current.addressLists).toHaveLength(0);
  });
});
