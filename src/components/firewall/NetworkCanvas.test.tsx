// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NetworkCanvas } from './NetworkCanvas';
import { NetworkNode, Connection, SimulationPacket } from '@/types/firewall';

const nodes: NetworkNode[] = [
  { id: 'router', type: 'router', name: 'Router', x: 400, y: 300, parentId: null },
  { id: 'inet', type: 'internet', name: 'Internet', x: 400, y: 80, parentId: 'router' },
  { id: 'data', type: 'vlan', name: 'DATA', x: 200, y: 500, parentId: 'router' },
  { id: 'sec', type: 'vlan', name: 'SEC', x: 600, y: 500, parentId: 'router' },
  { id: 'pc1', type: 'host', name: 'PC 1', x: 200, y: 650, parentId: 'data' }
];
const connections: Connection[] = [
  { id: 'c-inet', fromId: 'router', toId: 'inet' },
  { id: 'c-data', fromId: 'router', toId: 'data' },
  { id: 'c-sec', fromId: 'router', toId: 'sec' },
  { id: 'c-pc1', fromId: 'data', toId: 'pc1' }
];
const packet = (sourceId: string, destinationId: string, direction: 'request' | 'reply' = 'request'): SimulationPacket => ({
  id: `p-${sourceId}-${destinationId}`, sourceId, destinationId, direction, status: 'traveling'
});

const renderCanvas = (props: Partial<Parameters<typeof NetworkCanvas>[0]> = {}) =>
  render(
    <NetworkCanvas
      nodes={nodes}
      connections={connections}
      selectedNodeId={null}
      onSelectNode={() => {}}
      onUpdateNode={() => {}}
      onDeleteNode={() => {}}
      isEditable={false}
      {...props}
    />
  );

// jsdom has no PointerEvent, so fireEvent.pointer* would drop clientX/clientY.
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    // @ts-expect-error minimal polyfill for tests: a MouseEvent carries the coordinates
    window.PointerEvent = class PointerEvent extends MouseEvent {};
  }
});

const activeLines = (container: HTMLElement) => container.querySelectorAll('line[data-active="true"]');

describe('NetworkCanvas packet path', () => {
  it('highlights only the links on the real path, not every link from the router', () => {
    const { container } = renderCanvas({ packet: packet('pc1', 'inet') });
    // pc1 -> DATA -> router -> Internet: three links; SEC stays untouched.
    expect(activeLines(container)).toHaveLength(3);
    expect(container.querySelectorAll('[data-testid="packet-marker"]')).toHaveLength(1);
  });

  it('also shows the reply path (it used to only work for directly connected nodes)', () => {
    const { container } = renderCanvas({ packet: packet('inet', 'pc1', 'reply') });
    expect(activeLines(container)).toHaveLength(3);
  });

  it('starts the marker at the source of the packet', () => {
    const { container } = renderCanvas({ packet: packet('inet', 'pc1', 'reply') });
    const marker = container.querySelector('[data-testid="packet-marker"]')!;
    expect(marker.getAttribute('cx')).toBe('400');
    expect(marker.getAttribute('cy')).toBe('80');
  });

  it('shows no packet and no highlight without a simulation', () => {
    const { container } = renderCanvas();
    expect(activeLines(container)).toHaveLength(0);
    expect(container.querySelector('[data-testid="packet-marker"]')).toBeNull();
  });
});

describe('NetworkCanvas panning', () => {
  it('does not deselect the selected node when the canvas is dragged', () => {
    const onSelectNode = vi.fn();
    const { container } = renderCanvas({ selectedNodeId: 'data', onSelectNode, isEditable: true });
    const surface = container.querySelector('[data-pan-surface="true"]') as HTMLElement;

    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(surface, { clientX: 60, clientY: 40 });
    fireEvent.pointerUp(surface, { clientX: 60, clientY: 40 });
    fireEvent.click(surface);

    expect(onSelectNode).not.toHaveBeenCalled();
  });

  it('still deselects on a plain click on empty canvas', () => {
    const onSelectNode = vi.fn();
    const { container } = renderCanvas({ selectedNodeId: 'data', onSelectNode, isEditable: true });
    const surface = container.querySelector('[data-pan-surface="true"]') as HTMLElement;

    fireEvent.pointerDown(surface, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(surface, { clientX: 10, clientY: 10 });
    fireEvent.click(surface);

    expect(onSelectNode).toHaveBeenCalledWith(null);
  });
});
