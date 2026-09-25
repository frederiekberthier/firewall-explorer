import { describe, it, expect } from 'vitest';
import { layoutVlanRow, hostOffset, fitView, ROUTER_X, HOST_SPACING, MIN_VLAN_SLOT } from './layout';

describe('layoutVlanRow', () => {
  it('centres a row of VLANs under the router', () => {
    const xs = layoutVlanRow([0, 0, 0]);
    expect(xs).toEqual([ROUTER_X - MIN_VLAN_SLOT, ROUTER_X, ROUTER_X + MIN_VLAN_SLOT]);
  });

  it('gives VLANs with many hosts a wider slot so host groups never overlap', () => {
    const hostCounts = [4, 1, 3];
    const xs = layoutVlanRow(hostCounts);
    for (let i = 1; i < xs.length; i++) {
      const rightEdgeOfPrev = xs[i - 1] + hostOffset(hostCounts[i - 1] - 1, hostCounts[i - 1]);
      const leftEdgeOfThis = xs[i] + hostOffset(0, hostCounts[i]);
      expect(leftEdgeOfThis - rightEdgeOfPrev).toBeGreaterThanOrEqual(HOST_SPACING);
    }
  });
});

describe('hostOffset', () => {
  it('spreads hosts symmetrically around their VLAN', () => {
    expect([0, 1, 2].map(i => hostOffset(i, 3))).toEqual([-HOST_SPACING, 0, HOST_SPACING]);
    expect([0, 1].map(i => hostOffset(i, 2))).toEqual([-HOST_SPACING / 2, HOST_SPACING / 2]);
  });
});

describe('fitView', () => {
  it('leaves the view untouched when everything fits at 100%', () => {
    const fit = fitView([{ x: 400, y: 80 }, { x: 400, y: 300 }], 800, 700);
    expect(fit.fitsAtIdentity).toBe(true);
    expect(fit.zoom).toBe(1);
  });

  it('zooms out and centres a network that is wider than the view', () => {
    const nodes = [{ x: -100, y: 300 }, { x: 1100, y: 300 }, { x: 400, y: 650 }];
    const width = 360;
    const height = 420;
    const fit = fitView(nodes, width, height);

    expect(fit.fitsAtIdentity).toBe(false);
    expect(fit.zoom).toBeLessThan(1);

    // Every node must land inside the view with the computed zoom/pan
    // (the wrapper scales around the view centre).
    nodes.forEach(n => {
      const screenX = width / 2 + fit.pan.x + fit.zoom * (n.x - width / 2);
      const screenY = height / 2 + fit.pan.y + fit.zoom * (n.y - height / 2);
      expect(screenX).toBeGreaterThanOrEqual(0);
      expect(screenX).toBeLessThanOrEqual(width);
      expect(screenY).toBeGreaterThanOrEqual(56); // below the zoom controls
      expect(screenY).toBeLessThanOrEqual(height);
    });
  });

  it('never zooms in beyond 100% or out beyond the minimum', () => {
    expect(fitView([{ x: 400, y: 300 }], 2000, 2000).zoom).toBe(1);
    expect(fitView([{ x: 0, y: 0 }, { x: 100000, y: 0 }], 300, 300).zoom).toBe(0.25);
  });
});
