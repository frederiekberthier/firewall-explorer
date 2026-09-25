// Canvas layout for scenario-loaded topologies. Coordinates are in canvas
// space (the same space as NetworkNode.x/y); NetworkCanvas fits whatever
// comes out of this into the visible area, so it only has to avoid overlap,
// not stay within a fixed width.

export const ROUTER_X = 400;

/** Horizontal distance between two hosts under the same VLAN. */
export const HOST_SPACING = 120;

/** Minimum horizontal slot reserved for a single VLAN (incl. its label). */
export const MIN_VLAN_SLOT = 200;

/**
 * X positions for a row of VLANs, centred under the router. Each VLAN gets a
 * slot wide enough for its hosts (which are spread HOST_SPACING apart around
 * it), so the host groups of neighbouring VLANs never overlap.
 */
export function layoutVlanRow(hostCounts: number[]): number[] {
  const slots = hostCounts.map(count => Math.max(MIN_VLAN_SLOT, count * HOST_SPACING));
  const totalWidth = slots.reduce((sum, w) => sum + w, 0);

  let left = ROUTER_X - totalWidth / 2;
  return slots.map(width => {
    const centre = left + width / 2;
    left += width;
    return centre;
  });
}

/** Horizontal offset of host `index` (of `count`) relative to its VLAN, centred. */
export function hostOffset(index: number, count: number): number {
  return (index - (count - 1) / 2) * HOST_SPACING;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
// Room around the outermost node centres for the node tile and its labels.
const FIT_MARGIN_X = 90;
const FIT_MARGIN_Y = 80;
// Strip at the top of the canvas taken by the zoom controls; fitted content
// stays below it so no node ends up hidden behind them.
const FIT_TOP_INSET = 56;

/**
 * Zoom and pan that fit every node into a view of the given size. The
 * content wrapper scales around the view centre (origin-center), so a canvas
 * point p lands on screen at centre + pan + zoom * (p - centre); pan is chosen
 * so the node bounding box's centre lands in the middle of the area below the
 * zoom controls.
 */
export function fitView(nodes: { x: number; y: number }[], width: number, height: number) {
  if (nodes.length === 0 || width <= 0 || height <= 0) return { zoom: 1, pan: { x: 0, y: 0 }, fitsAtIdentity: true };

  const minX = Math.min(...nodes.map(n => n.x)) - FIT_MARGIN_X;
  const maxX = Math.max(...nodes.map(n => n.x)) + FIT_MARGIN_X;
  const minY = Math.min(...nodes.map(n => n.y)) - FIT_MARGIN_Y;
  const maxY = Math.max(...nodes.map(n => n.y)) + FIT_MARGIN_Y;

  const fitsAtIdentity = minX >= 0 && minY >= 0 && maxX <= width && maxY <= height;
  const usableHeight = Math.max(1, height - FIT_TOP_INSET);
  const zoom = Math.max(MIN_ZOOM, Math.min(1, width / (maxX - minX), usableHeight / (maxY - minY)));
  const centre = { x: width / 2, y: height / 2 };
  // Target: the middle of the area below the zoom controls.
  const target = { x: width / 2, y: FIT_TOP_INSET + usableHeight / 2 };
  const boxCentre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  return {
    zoom,
    pan: {
      x: target.x - centre.x - zoom * (boxCentre.x - centre.x),
      y: target.y - centre.y - zoom * (boxCentre.y - centre.y)
    },
    fitsAtIdentity
  };
}
