import type { Quaternion, Vec3, Vector } from './types.js';
/** Copy and normalize an (x,y,z,w) quaternion. Components must be finite and
 * the quaternion must be nonzero. Scaling first avoids overflow/underflow,
 * including for subnormal inputs. Neither input nor its sign is changed. */
export declare function normalizeOrientation(q: Quaternion): Quaternion;
/** Apply a right-handed rotation in radians about a fixed camera/world axis:
 * qNext = qDelta * q (not a local/body-axis rotation). Camera coordinates are
 * X right, Y up, Z toward the viewer. Returns a new normalized quaternion. */
export declare function rotateOrientation(q: Quaternion, axis: 'x' | 'y' | 'z', angleRadians: number): Quaternion;
/** Fixed/extrinsic XYZ angles in radians: R = Rz(z)*Ry(y)*Rx(x).
 * Rotations act on centered molecular coordinates, not on camera-fixed lights. */
export declare function orientationFromEulerXYZ(angles: Vec3): Quaternion;
/** Calculated fixed/extrinsic XYZ angles for R = Rz*Ry*Rx, in radians.
 * Canonical ranges: x,z in [-pi,pi], y in [-pi/2,pi/2]. At gimbal lock
 * (|cos(y)| <= 1e-12), choose z=0 and fold the coupled angle into x.
 * Euler outputs may jump at branch boundaries; retain the quaternion as state. */
export declare function orientationToEulerXYZ(q: Quaternion): Vec3;
/** Internal rotation by an already normalized quaternion; scene options perform
 * normalization once. This is q*p*conjugate(q), with no scale or translation. */
export declare function rotateByOrientation(p: readonly number[], q: Quaternion): Vector;
