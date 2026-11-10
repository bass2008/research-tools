import { expect, it } from '@jest/globals';
import { MAP_POINTS, mapXY } from '@/lib/matrixMap';
import { hitRegion, OUTER, YEAR_RADIUS, YEAR_THIRDS, xy } from '../matrixMapGeometry';

type Point = [number, number];

// Independent convex-polygon check: a separating edge normal proves that the
// complete targets are disjoint, rather than only comparing their centres.
function separated(a: Point[], b: Point[]) {
  return [a, b].some(polygon => polygon.some(([x, y], index) => {
    const next = polygon[(index + 1) % polygon.length];
    const axis = [y - next[1], next[0] - x];
    const project = ([px, py]: Point) => px * axis[0] + py * axis[1];
    const left = a.map(project), right = b.map(project);
    return Math.max(...left) < Math.min(...right) - 1e-6 || Math.max(...right) < Math.min(...left) - 1e-6;
  }));
}

function contains(polygon: Point[], [x, y]: Point) {
  const crosses = polygon.map(([ax, ay], index) => {
    const [bx, by] = polygon[(index + 1) % polygon.length];
    return (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  });
  return crosses.every(value => value >= -1e-6) || crosses.every(value => value <= 1e-6);
}

const personal = MAP_POINTS.map(mapXY);
const year = [
  ...MAP_POINTS.filter(point => point.radius === OUTER || point.radius === 0).map(mapXY),
  ...Object.values(YEAR_THIRDS).map(angle => xy(angle, YEAR_RADIUS)),
];

it.each([280, 350, 430])('keeps every target separate and its own point tappable at %s dp', width => {
  for (const positions of [personal, year]) {
    const regions = positions.map(point => hitRegion(point, positions, width));
    for (let i = 0; i < regions.length; i++) {
      expect(regions[i].length).toBeGreaterThanOrEqual(3);
      expect(contains(regions[i], positions[i])).toBe(true);
      for (let j = i + 1; j < regions.length; j++) expect(separated(regions[i], regions[j])).toBe(true);
    }
  }
});

it.each([280, 430])('preserves a 44 dp target where there is free space at %s dp', width => {
  const region = hitRegion([310, 310], [[310, 310]], width);
  const xs = region.map(point => point[0]), ys = region.map(point => point[1]);
  expect((Math.max(...xs) - Math.min(...xs)) * width / 620).toBeCloseTo(44);
  expect((Math.max(...ys) - Math.min(...ys)) * width / 620).toBeCloseTo(44);
});

it('gives dense points extra room perpendicular to their row without stealing a neighbour', () => {
  const row: Point[] = [[250, 310], [303, 310], [356, 310]];
  const region = hitRegion(row[1], row, 350);
  expect(contains(region, [303, 345])).toBe(true); // Outside the old r=24 target.
  expect(contains(region, row[0])).toBe(false);
  expect(contains(region, row[2])).toBe(false);
  expect(contains(region, [329.5, 310])).toBe(false); // Gap at the shared boundary.
});
