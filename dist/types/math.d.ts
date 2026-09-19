import type { Vector } from './types.js';
export declare const add: (a: readonly number[], b: readonly number[]) => Vector;
export declare const sub: (a: readonly number[], b: readonly number[]) => Vector;
export declare const mul: (a: readonly number[], s: number) => Vector;
export declare const dot: (a: readonly number[], b: readonly number[]) => number;
export declare const cross: (a: readonly number[], b: readonly number[]) => Vector;
export declare const norm: (a: readonly number[]) => Vector;
export declare function rotate(p: readonly number[], yaw: number, pitch: number): Vector;
export declare function escapeXml(s: unknown): string;
