import type { Quaternion, Vec3, Vector } from './types.js';

/** Copy and normalize an (x,y,z,w) quaternion. Components must be finite and
 * the quaternion must be nonzero. Scaling first avoids overflow/underflow,
 * including for subnormal inputs. Neither input nor its sign is changed. */
export function normalizeOrientation(q: Quaternion): Quaternion {
  if(!Array.isArray(q)||q.length!==4||![q[0],q[1],q[2],q[3]].every(Number.isFinite))
    throw new Error('Invalid orientation: expected four finite quaternion components');
  const scale=Math.max(Math.abs(q[0]),Math.abs(q[1]),Math.abs(q[2]),Math.abs(q[3]));
  if(scale===0)throw new Error('Invalid orientation: quaternion must be nonzero');
  const x=q[0]/scale,y=q[1]/scale,z=q[2]/scale,w=q[3]/scale;
  const length=Math.hypot(x,y,z,w);
  return [x/length,y/length,z/length,w/length];
}

/** Hamilton product: a*b applies b first, then a, to column vectors. */
function multiply(a: Quaternion,b: Quaternion): Quaternion {
  const [x,y,z,w]=a,[X,Y,Z,W]=b;
  return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];
}

/** Apply a right-handed rotation in radians about a fixed camera/world axis:
 * qNext = qDelta * q (not a local/body-axis rotation). Camera coordinates are
 * X right, Y up, Z toward the viewer. Returns a new normalized quaternion. */
export function rotateOrientation(q: Quaternion,axis: 'x'|'y'|'z',angleRadians: number): Quaternion {
  if(axis!=='x'&&axis!=='y'&&axis!=='z')throw new Error('Invalid orientation axis: expected x, y, or z');
  if(!Number.isFinite(angleRadians))throw new Error('Invalid orientation angle: expected finite radians');
  const unit=normalizeOrientation(q),s=Math.sin(angleRadians/2),c=Math.cos(angleRadians/2);
  const delta: Quaternion=axis==='x'?[s,0,0,c]:axis==='y'?[0,s,0,c]:[0,0,s,c];
  return normalizeOrientation(multiply(delta,unit));
}

/** Fixed/extrinsic XYZ angles in radians: R = Rz(z)*Ry(y)*Rx(x).
 * Rotations act on centered molecular coordinates, not on camera-fixed lights. */
export function orientationFromEulerXYZ(angles: Vec3): Quaternion {
  if(!Array.isArray(angles)||angles.length!==3||![angles[0],angles[1],angles[2]].every(Number.isFinite))
    throw new Error('Invalid Euler angles: expected three finite radians');
  const [x,y,z]=angles;
  const sx=Math.sin(x/2),cx=Math.cos(x/2),sy=Math.sin(y/2),cy=Math.cos(y/2),sz=Math.sin(z/2),cz=Math.cos(z/2);
  return normalizeOrientation([sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz]);
}

/** Calculated fixed/extrinsic XYZ angles for R = Rz*Ry*Rx, in radians.
 * Canonical ranges: x,z in [-pi,pi], y in [-pi/2,pi/2]. At gimbal lock
 * (|cos(y)| <= 1e-12), choose z=0 and fold the coupled angle into x.
 * Euler outputs may jump at branch boundaries; retain the quaternion as state. */
export function orientationToEulerXYZ(q: Quaternion): Vec3 {
  const [x,y,z,w]=normalizeOrientation(q);
  const r00=1-2*(y*y+z*z),r10=2*(x*y+w*z),r20=2*(x*z-w*y);
  const r11=1-2*(x*x+z*z),r12=2*(y*z-w*x),r21=2*(y*z+w*x),r22=1-2*(x*x+y*y);
  const cosY=Math.hypot(r00,r10);
  if(cosY<=1e-12)return [Math.atan2(-r12,r11),Math.atan2(-r20,cosY),0];
  return [Math.atan2(r21,r22),Math.atan2(-r20,cosY),Math.atan2(r10,r00)];
}

/** Internal rotation by an already normalized quaternion; scene options perform
 * normalization once. This is q*p*conjugate(q), with no scale or translation. */
export function rotateByOrientation(p: readonly number[],q: Quaternion): Vector {
  const [x,y,z,w]=q;
  const tx=2*(y*p[2]-z*p[1]),ty=2*(z*p[0]-x*p[2]),tz=2*(x*p[1]-y*p[0]);
  return [p[0]+w*tx+y*tz-z*ty,p[1]+w*ty+z*tx-x*tz,p[2]+w*tz+x*ty-y*tx];
}
