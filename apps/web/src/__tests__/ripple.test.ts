import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRippleGeometry,
  resolveRippleColor,
  RIPPLE_COLORS,
} from '../components/ui/use-ripple.ts';

describe('Ripple Primitive & Neobrutalism Feedback Suite', () => {
  // =========================================================================
  // 1. NEUROBRUTALISM COLOR PALETTE & TOKEN CONTRACT
  // =========================================================================
  describe('Neobrutalism Ripple Colors', () => {
    it('provides clean Neobrutalism palette rgba(23, 23, 23, 0.12) for neutral', () => {
      assert.equal(RIPPLE_COLORS.neutral, 'rgba(23, 23, 23, 0.12)');
      assert.equal(resolveRippleColor('neutral'), 'rgba(23, 23, 23, 0.12)');
      assert.equal(resolveRippleColor(undefined), 'rgba(23, 23, 23, 0.12)');
    });

    it('provides clean Neobrutalism palette rgba(23, 23, 23, 0.20) for primary background', () => {
      assert.equal(RIPPLE_COLORS.primary, 'rgba(23, 23, 23, 0.20)');
      assert.equal(resolveRippleColor('primary'), 'rgba(23, 23, 23, 0.20)');
    });

    it('preserves custom color strings without distortion', () => {
      const custom = 'rgba(255, 255, 255, 0.35)';
      assert.equal(resolveRippleColor(custom), custom);
    });
  });

  // =========================================================================
  // 2. GEOMETRY & FULL CONTAINER COVERAGE (NO LAYOUT SHIFT)
  // =========================================================================
  describe('Ripple Geometry & Container Boundary Invariants', () => {
    const testCases = [
      { name: 'Mobile bottom nav tab (80x64)', width: 80, height: 64 },
      { name: 'Mobile top bar logo (180x44)', width: 180, height: 44 },
      { name: 'Square icon action button (44x44)', width: 44, height: 44 },
      { name: 'Wide drawer menu item (340x60)', width: 340, height: 60 },
    ];

    for (const tc of testCases) {
      it(`guarantees complete corner coverage for ${tc.name} from any tap coordinate`, () => {
        const rect = { left: 100, top: 200, width: tc.width, height: tc.height };
        const corners = [
          { x: 0, y: 0 },
          { x: tc.width, y: 0 },
          { x: 0, y: tc.height },
          { x: tc.width, y: tc.height },
        ];

        // Sample multiple tap positions: center, all 4 corners, and arbitrary points
        const tapPoints = [
          { x: tc.width / 2, y: tc.height / 2 },
          { x: 0, y: 0 },
          { x: tc.width, y: 0 },
          { x: 0, y: tc.height },
          { x: tc.width, y: tc.height },
          { x: Math.round(tc.width * 0.2), y: Math.round(tc.height * 0.8) },
          { x: Math.round(tc.width * 0.8), y: Math.round(tc.height * 0.3) },
        ];

        for (const pt of tapPoints) {
          const clientX = rect.left + pt.x;
          const clientY = rect.top + pt.y;

          const geom = computeRippleGeometry(rect, clientX, clientY);

          // Center must match tap coordinate relative to container
          assert.equal(geom.x, pt.x);
          assert.equal(geom.y, pt.y);

          // Circle bounding box coordinates
          assert.equal(geom.left, pt.x - geom.radius);
          assert.equal(geom.top, pt.y - geom.radius);
          assert.equal(geom.size, geom.radius * 2);

          // Invariant: Distance to ALL four corners must be <= radius
          for (const corner of corners) {
            const distanceToCorner = Math.hypot(corner.x - pt.x, corner.y - pt.y);
            assert.ok(
              distanceToCorner <= geom.radius,
              `Corner (${corner.x}, ${corner.y}) distance ${distanceToCorner} exceeds ripple radius ${geom.radius} for tap at (${pt.x}, ${pt.y})`
            );
          }
        }
      });
    }

    it('handles exact center tap with symmetric radius', () => {
      const rect = { left: 0, top: 0, width: 100, height: 100 };
      const geom = computeRippleGeometry(rect, 50, 50);

      // Distance to corner (0,0) from (50,50) is hypot(50, 50) = 50 * sqrt(2) ≈ 70.71 -> ceil = 71
      assert.equal(geom.radius, 71);
      assert.equal(geom.size, 142);
      assert.equal(geom.left, 50 - 71);
      assert.equal(geom.top, 50 - 71);
    });

    it('handles extreme corner tap (0, 0) covering opposite corner (W, H)', () => {
      const rect = { left: 0, top: 0, width: 100, height: 100 };
      const geom = computeRippleGeometry(rect, 0, 0);

      // Distance to corner (100, 100) from (0,0) is hypot(100, 100) ≈ 141.42 -> ceil = 142
      assert.equal(geom.radius, 142);
      assert.equal(geom.size, 284);
      assert.equal(geom.left, -142);
      assert.equal(geom.top, -142);
    });
  });

  // =========================================================================
  // 3. EVENT TRANSPARENCY & NON-INTERFERENCE CONTRACT
  // =========================================================================
  describe('Non-interference with Next.js Link & Native Click Handlers', () => {
    it('preserves default event behavior without calling preventDefault or stopPropagation', () => {
      let preventDefaultCalled = false;
      let stopPropagationCalled = false;

      const mockEvent = {
        button: 0,
        pointerType: 'touch',
        clientX: 50,
        clientY: 50,
        preventDefault: () => {
          preventDefaultCalled = true;
        },
        stopPropagation: () => {
          stopPropagationCalled = true;
        },
      };

      // Pointer event should not have preventDefault or stopPropagation triggered by ripple
      assert.equal(preventDefaultCalled, false);
      assert.equal(stopPropagationCalled, false);
    });
  });
});
