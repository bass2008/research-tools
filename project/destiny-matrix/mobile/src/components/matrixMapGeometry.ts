import { MAP_CENTER, MAP_POINTS, type MapPoint } from '@/lib/matrixMap';

// Same positions as OctagramParts, PositionMap and the web's yearGeometry.
// Only circle/text sizes are increased for a handheld screen.
export const CENTER = MAP_CENTER;
export const OUTER = Math.max(...MAP_POINTS.map(point => point.radius));
export const INNER = MAP_POINTS.find(point => point.symbol === 'J')!.radius;
export const YEAR_RADIUS = 96;
export const YEAR_THIRDS = { P1: -30, P2: 90, P3: 210 };
export const YEAR_EDGES = [-90, 30, 150];
export const OUTLINE = [180, 225, -90, -45, 0, 45, 90, 135];

export function xy(angle: number, radius: number): [number, number] {
  const radians = angle * Math.PI / 180;
  return [CENTER + radius * Math.cos(radians), CENTER + radius * Math.sin(radians)];
}
export const polygon = (angles: number[], radius: number) => angles.map(angle => xy(angle, radius).map(value => value.toFixed(1)).join(',')).join(' ');

type XY = [number, number];
/** A 44dp target clipped to the nearest-point cell: neighbouring targets never overlap.
 * Dense rows get less width but retain the free space above/below their circles. */
export function hitRegion(point: XY, neighbours: XY[], width: number): XY[] {
  const half = 22 * 620 / Math.max(width, 1), [x, y] = point;
  let vertices: XY[] = [[Math.max(0, x - half), Math.max(0, y - half)], [Math.min(620, x + half), Math.max(0, y - half)],
    [Math.min(620, x + half), Math.min(620, y + half)], [Math.max(0, x - half), Math.min(620, y + half)]];
  for (const [nx, ny] of neighbours) {
    const dx = nx - x, dy = ny - y, distance = Math.hypot(dx, dy);
    if (distance < 0.001) continue;
    // Leave a subpixel gap along the common boundary instead of two overlapping edges.
    const boundary = (nx * nx + ny * ny - x * x - y * y) / 2 - distance * 0.3;
    const dot = ([px, py]: XY) => dx * px + dy * py;
    const clipped: XY[] = [];
    for (let index = 0; index < vertices.length; index++) {
      const a = vertices[index], b = vertices[(index + 1) % vertices.length];
      const da = dot(a), db = dot(b), insideA = da <= boundary, insideB = db <= boundary;
      if (insideA) clipped.push(a);
      if (insideA !== insideB) {
        const t = (boundary - da) / (db - da);
        clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    vertices = clipped;
  }
  return vertices;
}

export function nodeSize(point: Pick<MapPoint, 'radius' | 'size'>, guide: boolean) {
  if (guide) return point.size === 'big' ? { radius: 25, font: 23 } : point.size === 'mid' ? { radius: 21, font: 21 } : { radius: 17, font: 18 };
  if (point.radius === 0) return { radius: 33, font: 32 };
  if (point.size === 'big') return { radius: 27, font: 28 };
  if (point.size === 'small') return { radius: 17, font: 19 };
  return point.radius === OUTER ? { radius: 22, font: 24 } : { radius: 20, font: 22 };
}

// Mirrors landing/routes.ts: nearest points connected by outward curves.
// Values and connections are supplied by the model, never calculated here.
export function linkPath(keys: readonly string[], positions: Map<string, [number, number]>) {
  const points = keys.flatMap(key => positions.has(key) ? [{ key, xy: positions.get(key)! }] : []);
  if (points.length < 2) return '';
  const centre = points.reduce((sum, point) => [sum[0] + point.xy[0] / points.length, sum[1] + point.xy[1] / points.length], [0, 0]);
  const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let current = points.length > 2 ? points.reduce((best, point) => distance(point.xy, centre) > distance(best.xy, centre) ? point : best) : points[0];
  const ordered = [current], remaining = points.filter(point => point !== current);
  while (remaining.length) {
    let closest = 0;
    remaining.forEach((point, index) => { if (distance(point.xy, current.xy) < distance(remaining[closest].xy, current.xy)) closest = index; });
    current = remaining.splice(closest, 1)[0]; ordered.push(current);
  }
  return ordered.slice(1).reduce((path, point, index) => {
    const [x1, y1] = ordered[index].xy, [x2, y2] = point.xy;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, length = Math.hypot(x2 - x1, y2 - y1);
    if (!length) return path;
    let nx = -(y2 - y1) / length, ny = (x2 - x1) / length;
    if ((mx - CENTER) * nx + (my - CENTER) * ny < 0) { nx = -nx; ny = -ny; }
    const bow = Math.min(64, Math.max(14, length * 0.2));
    return `${path || `M${x1.toFixed(1)},${y1.toFixed(1)}`} Q${(mx + nx * bow).toFixed(1)},${(my + ny * bow).toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }, '');
}
