import * as THREE from 'three';

export type Vec4 = [number, number, number, number];

export function generateTesseractVertices(size = 1): Vec4[] {
    const vertices: Vec4[] = [];
    const s = size / 2;

    for (let x of [-s, s]) {
        for (let y of [-s, s]) {
            for (let z of [-s, s]) {
                for (let w of [-s, s]) {
                    vertices.push([x, y, z, w]);
                }
            }
        }
    }

    return vertices;
}

export function generateTesseractEdges(vertices: Vec4[]): [number, number][] {
    const edges: [number, number][] = [];

    for (let i = 0; i < vertices.length; i++) {
        for (let j = i + 1; j < vertices.length; j++) {
            const v1 = vertices[i];
            const v2 = vertices[j];

            let diffCount = 0;
            for (let k = 0; k < 4; k++) {
                if (v1[k] !== v2[k]) diffCount++;
            }

            if (diffCount === 1) {
                edges.push([i, j]);
            }
        }
    }

    return edges;
}

export function project4Dto3D(v: Vec4, cam: Vec4): THREE.Vector3 {
    const [x, y, z, w] = v;
    const [cx, cy, cz, cw] = cam;

    const k = 0.7;

    return new THREE.Vector3(
        (x - cx) + k * (w - cw),
        (y - cy) + k * (w - cw),
        (z - cz) + k * (w - cw),
    );
}

// 4x4 matrix as a flat array, row-major: m[row*4 + col]
export type Mat4 = number[]; // length 16

export function mat4Identity(): Mat4 {
    return [
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
    ];
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
    const out = new Array(16).fill(0);
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) {
                sum += a[r*4 + k] * b[k*4 + c];
            }
            out[r*4 + c] = sum;
        }
    }
    return out;
}

// Create a rotation matrix that rotates in the plane (i, j) by angle (radians).
// i, j are indices 0..3 corresponding to x,y,z,w.
export function rotationMatrix4(i: number, j: number, angle: number): Mat4 {
    const R = mat4Identity();
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    // set 2x2 block for (i,j) plane
    // row i, col i = c
    // row i, col j = -s
    // row j, col i = s
    // row j, col j = c
    R[i*4 + i] = c;
    R[i*4 + j] = -s;
    R[j*4 + i] = s;
    R[j*4 + j] = c;

    return R;
}

// Apply a 4x4 matrix to a Vec4
export function applyMat4ToVec4(m: Mat4, v: Vec4): Vec4 {
    const [x,y,z,w] = v;
    const out0 = m[0]*x + m[1]*y + m[2]*z + m[3]*w;
    const out1 = m[4]*x + m[5]*y + m[6]*z + m[7]*w;
    const out2 = m[8]*x + m[9]*y + m[10]*z + m[11]*w;
    const out3 = m[12]*x + m[13]*y + m[14]*z + m[15]*w;
    return [out0, out1, out2, out3];
}