import * as THREE from 'three';
import {applyMat4ToVec4, project4Dto3D} from "./core/hyper.ts";
import {generateTesseractEdges, generateTesseractVertices} from "./core/hyper.ts";

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 5, 10);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 10, 10);
scene.add(light);

// Grid ground
const size = 300;
const divisions = 10;
const gridHelper = new THREE.GridHelper(size, divisions, 0x444444, 0x888888);
scene.add(gridHelper);

/////////////////////////////////////////////////////////

const verts4D = generateTesseractVertices(100);
const edges = generateTesseractEdges(verts4D);

const positions = new Float32Array(edges.length * 2 * 3);
const colors = new Float32Array(edges.length * 2 * 3);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.LineBasicMaterial({ vertexColors: true });
const tesseractLines = new THREE.LineSegments(geometry, material);
scene.add(tesseractLines);

// Pre-fill edge colors by axis
function axisColor(axis) {
    switch(axis) {
        case 0: return [1,0,0]; // X-red
        case 1: return [0,1,0]; // Y-green
        case 2: return [0,0,1]; // Z-blue
        case 3: return [1,1,0]; // W-yellow
        default: return [1,1,1];
    }
}
let ptr = 0;
for (const [i1,i2] of edges) {
    const v1 = verts4D[i1], v2 = verts4D[i2];
    let axis = -1;
    for (let k=0;k<4;k++) if(v1[k]!==v2[k]) { axis=k; break; }
    const [r,g,b] = axisColor(axis);
    colors[ptr++] = r; colors[ptr++] = g; colors[ptr++] = b;
    colors[ptr++] = r; colors[ptr++] = g; colors[ptr++] = b;
}
geometry.attributes.color.needsUpdate = true;

let camera4D = [0,0,0,0];
function updateTesseract() {
    let ptr = 0;
    for (const [i1, i2] of edges) {
        const rv1 = applyMat4ToVec4(tesseractRotationMat, verts4D[i1]);
        const rv2 = applyMat4ToVec4(tesseractRotationMat, verts4D[i2]);

        const p1 = project4Dto3D(rv1, [0,0,0,0]); // camera stays purely 3D, so cam4D = [0,0,0,0]
        const p2 = project4Dto3D(rv2, [0,0,0,0]);

        // positions[ptr++] = p1.x;
        // positions[ptr++] = p1.y;
        // positions[ptr++] = p1.z;
        //
        // positions[ptr++] = p2.x;
        // positions[ptr++] = p2.y;
        // positions[ptr++] = p2.z;

        const tesseractOffset = new THREE.Vector3(0, 200, 0); // y = 15, above the grid
        positions[ptr++] = p1.x + tesseractOffset.x;
        positions[ptr++] = p1.y + tesseractOffset.y;
        positions[ptr++] = p1.z + tesseractOffset.z;

        positions[ptr++] = p2.x + tesseractOffset.x;
        positions[ptr++] = p2.y + tesseractOffset.y;
        positions[ptr++] = p2.z + tesseractOffset.z;

    }
    geometry.attributes.position.needsUpdate = true;
}

// 4x4 identity
function mat4Identity() {
    return [
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
    ];
}

// multiply two 4x4 matrices
function mat4Multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let r=0; r<4; r++)
        for (let c=0; c<4; c++)
            for (let k=0; k<4; k++)
                out[r*4+c] += a[r*4+k]*b[k*4+c];
    return out;
}

// rotation matrix in plane (i,j)
function rotationMatrix4(i, j, angle) {
    const R = mat4Identity();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    R[i*4+i] = c; R[i*4+j] = -s;
    R[j*4+i] = s; R[j*4+j] = c;
    return R;
}

let tesseractRotationMat = mat4Identity();

let dragging = false;
let lastX = 0;
let lastY = 0;
const sensitivity = 0.01;

renderer.domElement.addEventListener('pointerdown', (ev) => {
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    ev.target.setPointerCapture(ev.pointerId);
});
renderer.domElement.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;

    // basic rotation
    const a = dx * sensitivity;
    const b = dy * sensitivity;

    let r1, r2;
    if (ev.shiftKey) {
        // shift = rotate in W planes
        r1 = rotationMatrix4(0, 3, a); // X-W
        r2 = rotationMatrix4(1, 3, b); // Y-W
    } else {
        // normal = rotate in 3D planes
        r1 = rotationMatrix4(0,1,a); // X-Y
        r2 = rotationMatrix4(0,2,b); // X-Z
    }

    tesseractRotationMat = mat4Multiply(r2, mat4Multiply(r1, tesseractRotationMat));
});
renderer.domElement.addEventListener('pointerup', () => dragging = false);
renderer.domElement.addEventListener('pointercancel', () => dragging = false);


/////////////////////////////////////////////////////////

// Movement
const moveSpeed = 2;
const keys = { w: false, a: false, s: false, d: false };

// Rotation
const rotationKeys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
const rotationSpeed = 0.02;

// Event listeners
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key] !== undefined) keys[key] = true;
    if (rotationKeys[e.key] !== undefined) rotationKeys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key] !== undefined) keys[key] = false;
    if (rotationKeys[e.key] !== undefined) rotationKeys[e.key] = false;
});

// Animation
function animate() {
    requestAnimationFrame(animate);
    updateCamera();
    updateTesseract();
    updateTesseractRotation();
    renderer.render(scene, camera);
}

function updateCamera() {
    // Rotation using quaternions
    const quaternion = new THREE.Quaternion();
    const pitchQuat = new THREE.Quaternion();
    const yawQuat = new THREE.Quaternion();

    // Yaw: rotate around world Y
    if (rotationKeys.ArrowLeft) yawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationSpeed);
    if (rotationKeys.ArrowRight) yawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rotationSpeed);

    // Pitch: rotate around camera's local X
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    if (rotationKeys.ArrowUp) pitchQuat.setFromAxisAngle(right, rotationSpeed);
    if (rotationKeys.ArrowDown) pitchQuat.setFromAxisAngle(right, -rotationSpeed);

    quaternion.multiplyQuaternions(yawQuat, pitchQuat);
    camera.quaternion.multiplyQuaternions(quaternion, camera.quaternion);

    // Movement in camera local space
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

    if (keys.w) camera.position.add(forward.clone().multiplyScalar(moveSpeed));
    if (keys.s) camera.position.add(forward.clone().multiplyScalar(-moveSpeed));
    if (keys.a) camera.position.add(rightVec.clone().multiplyScalar(-moveSpeed));
    if (keys.d) camera.position.add(rightVec.clone().multiplyScalar(moveSpeed));
}

function updateTesseractRotation() {
    let r1: number[], r2: number[];

    if (rotationKeys.ArrowLeft || rotationKeys.ArrowRight || rotationKeys.ArrowUp || rotationKeys.ArrowDown) {
        if (window.event?.shiftKey) {
            const a = (rotationKeys.ArrowLeft ? rotationSpeed : 0) - (rotationKeys.ArrowRight ? rotationSpeed : 0);
            const b = (rotationKeys.ArrowUp ? rotationSpeed : 0) - (rotationKeys.ArrowDown ? rotationSpeed : 0);

            r1 = rotationMatrix4(0, 3, a); // X-W
            r2 = rotationMatrix4(1, 3, b); // Y-W
        } else {
            // normal 3D rotation
            const a = (rotationKeys.ArrowLeft ? rotationSpeed : 0) - (rotationKeys.ArrowRight ? rotationSpeed : 0);
            const b = (rotationKeys.ArrowUp ? rotationSpeed : 0) - (rotationKeys.ArrowDown ? rotationSpeed : 0);

            r1 = rotationMatrix4(0, 1, a); // X-Y
            r2 = rotationMatrix4(0, 2, b); // X-Z
        }

        tesseractRotationMat = mat4Multiply(r2, mat4Multiply(r1, tesseractRotationMat));
    }
}

animate();
