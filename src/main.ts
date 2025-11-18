// src/main.ts
import * as THREE from 'three';
import {
    type Vec4,
    generateTesseractVertices,
    generateTesseractEdges,
    project4Dto3D,
    type Mat4,
    mat4Identity,
    mat4Multiply,
    rotationMatrix4,
    applyMat4ToVec4,
} from './core/hyper';

// ---------- Scene & renderer ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 4;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// ---------- 4D camera (user position inside hyper-space) ----------
let camera4D: Vec4 = [0, 0, 0, 0];

// ---------- Tesseract geometry ----------
const verts4D = generateTesseractVertices(2);
const edges = generateTesseractEdges(verts4D);

// Buffer arrays for positions and colors
const positions = new Float32Array(edges.length * 2 * 3);
const colors = new Float32Array(edges.length * 2 * 3); // RGB per vertex

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Use vertex colors (each segment endpoint can have a color)
const material = new THREE.LineBasicMaterial({ vertexColors: true });
const wireframe = new THREE.LineSegments(geometry, material);
scene.add(wireframe);

// ---------- Color coding by axis ----------
/*
  For each edge [i, j], find which axis differs (0..3).
  We'll map:
    0 (X) -> red
    1 (Y) -> green
    2 (Z) -> blue
    3 (W) -> yellow (red + green)
*/
function axisColor(axis: number): [number, number, number] {
    switch (axis) {
        case 0: return [1, 0, 0];       // X -> red
        case 1: return [0, 1, 0];       // Y -> green
        case 2: return [0, 0, 1];       // Z -> blue
        case 3: return [1, 1, 0];       // W -> yellow
        default: return [1, 1, 1];
    }
}

// Pre-fill color buffer (edges' topology never changes)
(function fillColorsOnce() {
    let ptr = 0;
    for (const [i1, i2] of edges) {
        const v1 = verts4D[i1];
        const v2 = verts4D[i2];
        // find differing axis index
        let axis = -1;
        for (let k = 0; k < 4; k++) {
            if (v1[k] !== v2[k]) { axis = k; break; }
        }
        const col = axisColor(axis);
        // both endpoints same color for clarity
        colors[ptr++] = col[0];
        colors[ptr++] = col[1];
        colors[ptr++] = col[2];

        colors[ptr++] = col[0];
        colors[ptr++] = col[1];
        colors[ptr++] = col[2];
    }
    geometry.attributes.color.needsUpdate = true;
})();

// ---------- Rotation matrix state ----------
let rotationMat: Mat4 = mat4Identity();

// ---------- Mouse-driven rotation (existing, preserved) ----------
let dragging = false;
let lastX = 0;
let lastY = 0;
const sensitivity = 0.01; // tune as needed

function applyMouseRotation(deltaX: number, deltaY: number, shiftKey: boolean) {
    const a = deltaX * sensitivity;
    const b = deltaY * sensitivity;

    let r1: Mat4, r2: Mat4;

    if (shiftKey) {
        r1 = rotationMatrix4(0, 3, a); // X-W
        r2 = rotationMatrix4(1, 3, b); // Y-W
    } else {
        r1 = rotationMatrix4(0, 1, a); // X-Y
        r2 = rotationMatrix4(0, 2, b); // X-Z
    }

    const combined = mat4Multiply(r2, r1);
    rotationMat = mat4Multiply(combined, rotationMat);
}

renderer.domElement.addEventListener('pointerdown', (ev) => {
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    (ev.target as Element).setPointerCapture(ev.pointerId);
});

renderer.domElement.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;

    applyMouseRotation(dx, dy, ev.shiftKey);
});

renderer.domElement.addEventListener('pointerup', (ev) => {
    dragging = false;
    try { (ev.target as Element).releasePointerCapture(ev.pointerId); } catch {}
});
renderer.domElement.addEventListener('pointercancel', () => { dragging = false; });

// ---------- Movement: WASD only, relative to current rotation ----------
/*
  Movement basis in local object space (4D):
    forward/back  -> Z axis (we choose forward = -Z)
    left/right    -> X axis
  We'll compute the rotated 4D basis vectors by applying rotationMat to the unit vectors,
  then add those vectors into camera4D when keys are pressed.
*/
const keyState = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k in keyState) keyState[k as keyof typeof keyState] = true;

    // allow 'r' to reset rotation (preserve)
    if (k === 'r') rotationMat = mat4Identity();
});
window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in keyState) keyState[k as keyof typeof keyState] = false;
});

// ---------- Orbit state ----------
let orbitYaw = 0;   // horizontal orbit around tesseract
let orbitPitch = 0; // vertical orbit around tesseract
const orbitDistance = 4; // distance from object
const orbitSpeed = 1.5;  // radians per second

// ---------- Key state for orbiting ----------
const orbitKeys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
window.addEventListener('keydown', (e) => {
    if (e.key in orbitKeys) orbitKeys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key in orbitKeys) orbitKeys[e.key] = false;
});


// ---------- Movement parameters ----------
const moveSpeed = 1.5; // units per second; tune to taste

// ---------- Animation loop (with delta time) ----------
let lastTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTime) / 1000); // clamp dt to avoid huge jumps
    lastTime = now;

    // ----- handle continuous WASD movement -----
    // Build rotated basis vectors (Vec4)
    // X basis: [1,0,0,0]
    // Y basis: [0,1,0,0]
    // Z basis: [0,0,1,0] -> forward is -Z
    const bx: Vec4 = applyMat4ToVec4(rotationMat, [1, 0, 0, 0]);
    const bz_pos: Vec4 = applyMat4ToVec4(rotationMat, [0, 0, 1, 0]); // +Z
    const bz_forward: Vec4 = [-bz_pos[0], -bz_pos[1], -bz_pos[2], -bz_pos[3]]; // -Z (forward)
    // Note: we intentionally move the user in 4D space along these rotated basis vectors.

    // ----- handle orbit keys -----
    if (Object.values(orbitKeys).some(v => v)) {
        const delta = orbitSpeed * dt;
        if (orbitKeys.ArrowLeft) orbitYaw -= delta;
        if (orbitKeys.ArrowRight) orbitYaw += delta;
        if (orbitKeys.ArrowUp) orbitPitch = Math.min(Math.PI/2-0.01, orbitPitch + delta);
        if (orbitKeys.ArrowDown) orbitPitch = Math.max(-Math.PI/2+0.01, orbitPitch - delta);
    }

    // Compute camera position relative to tesseract at origin
    camera.position.x = orbitDistance * Math.cos(orbitPitch) * Math.sin(orbitYaw);
    camera.position.y = orbitDistance * Math.sin(orbitPitch);
    camera.position.z = orbitDistance * Math.cos(orbitPitch) * Math.cos(orbitYaw);

    // Look at the tesseract center (assume origin)
    camera.lookAt(0, 0, 0);


    // compute movement vector in 4D
    let mv: Vec4 = [0, 0, 0, 0];
    if (keyState.w) {
        mv = [
            mv[0] + bz_forward[0],
            mv[1] + bz_forward[1],
            mv[2] + bz_forward[2],
            mv[3] + bz_forward[3],
        ];
    }
    if (keyState.s) {
        mv = [
            mv[0] - bz_forward[0],
            mv[1] - bz_forward[1],
            mv[2] - bz_forward[2],
            mv[3] - bz_forward[3],
        ];
    }
    if (keyState.a) {
        mv = [
            mv[0] - bx[0],
            mv[1] - bx[1],
            mv[2] - bx[2],
            mv[3] - bx[3],
        ];
    }
    if (keyState.d) {
        mv = [
            mv[0] + bx[0],
            mv[1] + bx[1],
            mv[2] + bx[2],
            mv[3] + bx[3],
        ];
    }

    // normalize mv (if non-zero) to avoid diagonal speed boost, then scale by speed*dt
    const len = Math.hypot(mv[0], mv[1], mv[2], mv[3]);
    if (len > 1e-6) {
        const s = (moveSpeed * dt) / len;
        camera4D = [
            camera4D[0] + mv[0] * s,
            camera4D[1] + mv[1] * s,
            camera4D[2] + mv[2] * s,
            camera4D[3] + mv[3] * s,
        ];
    }

    // ----- update edge positions (apply rotation to vertices, then project) -----
    let ptr = 0;
    for (const [i1, i2] of edges) {
        const rv1 = applyMat4ToVec4(rotationMat, verts4D[i1]);
        const rv2 = applyMat4ToVec4(rotationMat, verts4D[i2]);

        const p1 = project4Dto3D(rv1, camera4D);
        const p2 = project4Dto3D(rv2, camera4D);

        positions[ptr++] = p1.x;
        positions[ptr++] = p1.y;
        positions[ptr++] = p1.z;

        positions[ptr++] = p2.x;
        positions[ptr++] = p2.y;
        positions[ptr++] = p2.z;
    }

    geometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
}

animate();

// ---------- Resize handling ----------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});