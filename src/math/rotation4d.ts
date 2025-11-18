export type Vec4 = { x: number; y: number; z: number; w: number };

export function rotateXW(v: Vec4, angle: number): Vec4 {
    const { x, w, y, z } = v;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: x * cos - w * sin,
        w: x * sin + w * cos,
        y,
        z,
    };
}

export function rotateYW(v: Vec4, angle: number): Vec4 {
    const { y, w, x, z } = v;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        y: y * cos - w * sin,
        w: y * sin + w * cos,
        x,
        z,
    };
}

export function rotateZW(v: Vec4, angle: number): Vec4 {
    const { z, w, x, y } = v;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        z: z * cos - w * sin,
        w: z * sin + w * cos,
        x,
        y,
    };
}