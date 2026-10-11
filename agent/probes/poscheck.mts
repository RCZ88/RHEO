import { computeGeometry } from '../../src/shared/halo/geometry';
const g = computeGeometry({
  displayId: 1,
  displayBounds: { x: 0, y: 0, width: 3024, height: 1964 },
  workArea: { x: 0, y: 38, width: 3024, height: 1926 },
  scaleFactor: 2, edge: 'top',
  notch: { hasNotch: false, width: 0, height: 0, source: 'none' },
});
console.log('window x,y  :', g.canvas.x, g.canvas.y, '(y=0 means flush with the TOP pixel)');
console.log('window w,h  :', g.canvas.width, g.canvas.height);
console.log('hotZone     :', JSON.stringify(g.hotZone));
console.log('compact pill:', JSON.stringify(g.compactSize));
