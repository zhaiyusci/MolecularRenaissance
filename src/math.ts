import type { Vector } from './types.js';
// Preserve arithmetic order: geometry tolerances are covered by numerical tests.
// Dense three-component vectors dominate geometry. Keep generic fallbacks for
// other dimensions, and keep the reduction's initial +0 and arithmetic order.
export const add = (a: readonly number[], b: readonly number[]): Vector => a.length===3?[a[0]+b[0],a[1]+b[1],a[2]+b[2]]:a.map((v,i)=>v+b[i]);
export const sub = (a: readonly number[], b: readonly number[]): Vector => a.length===3?[a[0]-b[0],a[1]-b[1],a[2]-b[2]]:a.map((v,i)=>v-b[i]);
export const mul = (a: readonly number[], s: number): Vector => a.length===3?[a[0]*s,a[1]*s,a[2]*s]:a.map(v=>v*s);
export const dot = (a: readonly number[], b: readonly number[]): number => a.length===3?((0+a[0]*b[0])+a[1]*b[1])+a[2]*b[2]:a.reduce((s,v,i)=>s+v*b[i],0);
export const cross = (a: readonly number[], b: readonly number[]): Vector => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm = (a: readonly number[]): Vector => mul(a,1/Math.hypot(...a));
export function rotate(p: readonly number[], yaw: number, pitch: number): Vector {
  const x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);
  return [x,p[1]*Math.cos(pitch)-z*Math.sin(pitch),p[1]*Math.sin(pitch)+z*Math.cos(pitch)];
}
export function escapeXml(s: unknown): string {
  const escapes: Record<string,string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'};
  return String(s).replace(/[&<>"']/g,c=>escapes[c]);
}
