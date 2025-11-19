import * as THREE from 'three';
// We will define necessary math locally to ensure Camera logic holds up
// independent of your external imports.

// --- MATH UTILS ---------------------------------------------------------

// 4D Identity Matrix
function mat4Identity() {
    return [
        1,0,0,0,
        0,1,0,0,
        0,0,1,0,
        0,0,0,1
    ];
}

// Matrix Multiply (A * B)
function mat4Multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let r=0; r<4; r++)
        for (let c=0; c<4; c++)
            for (let k=0; k<4; k++)
                out[r*4+c] += a[r*4+k]*b[k*4+c];
    return out;
}

// Matrix Vector Multiply (M * v)
function applyMat4ToVec4(m, v) {
    const out = [0,0,0,0];
    for (let i=0; i<4; i++) {
        out[i] = m[i*4+0]*v[0] + m[i*4+1]*v[1] + m[i*4+2]*v[2] + m[i*4+3]*v[3];
    }
    return out;
}

// Transpose (For rotation matrices, Transpose === Inverse)
function mat4Transpose(m) {
    const out = new Array(16);
    for(let r=0; r<4; r++)
        for(let c=0; c<4; c++)
            out[c*4+r] = m[r*4+c];
    return out;
}

// Rotation Generators
function rotationMatrix4(i, j, angle) {
    const R = mat4Identity();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    R[i*4+i] = c; R[i*4+j] = -s;
    R[j*4+i] = s; R[j*4+j] = c;
    return R;
}

// 4D -> 3D Stereographic Projection
// We project relative to a "Camera" at 0,0,0 looking down W usually,
// but since we transform points TO camera space first, we just project based on W.
function project4Dto3D(v) {
    const wFactor = 200; // Field of View / Depth factor
    // Prevent division by zero or points behind the "retina"
    const div = wFactor - v[3];

    if (Math.abs(div) < 0.001) return {x:v[0], y:v[1], z:v[2]}; // Safety

    const scale = wFactor / div;
    return {
        x: v[0] * scale,
        y: v[1] * scale,
        z: v[2] * scale
    };
}

// --- SCENE SETUP --------------------------------------------------------

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// We lock the ThreeJS camera. It acts as our "Eye" into the 3D slice.
camera.position.set(0, 0, 200);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Grid to give reference
const gridHelper = new THREE.GridHelper(500, 20, 0x444444, 0x222222);
// We can rotate the grid 90deg so it looks like a "floor" relative to our perspective
gridHelper.rotateX(Math.PI / 2);
scene.add(gridHelper);

// --- TESSERACT GENERATION -----------------------------------------------
// (Re-implementing simple generation here to make snippet self-contained)
function createTesseract(size) {
    const vertices = [];
    for(let i=0; i<16; i++) {
        const x = (i & 1) ? size : -size;
        const y = (i & 2) ? size : -size;
        const z = (i & 4) ? size : -size;
        const w = (i & 8) ? size : -size;
        vertices.push([x,y,z,w]);
    }
    const edges = [];
    for(let i=0; i<16; i++) {
        for(let bit=0; bit<4; bit++) {
            const neighbor = i ^ (1 << bit);
            if(i < neighbor) edges.push([i, neighbor]);
        }
    }
    return { vertices, edges };
}

const tesseract = createTesseract(50); // Radius 50
const edges = tesseract.edges;
const verts4D = tesseract.vertices;

// Geometry Setup
const positions = new Float32Array(edges.length * 2 * 3);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
const tesseractLines = new THREE.LineSegments(geometry, material);
scene.add(tesseractLines);

// --- 4D CAMERA SYSTEM ---------------------------------------------------

const cam4D = {
    position: [0, 0, -150, 0], // Start slightly back in Z
    // The rotation matrix represents the camera's local axes (Right, Up, Forward, Ana)
    rotation: mat4Identity()
};

function updateTesseract() {
    // 1. Invert Camera Rotation (Transpose) to get World-to-View Matrix
    const viewMat = mat4Transpose(cam4D.rotation);

    let ptr = 0;
    for (const [i1, i2] of edges) {
        const v1 = verts4D[i1];
        const v2 = verts4D[i2];

        // STEP A: Relative Position (Vertex - CameraPos)
        const rel1 = [
            v1[0] - cam4D.position[0],
            v1[1] - cam4D.position[1],
            v1[2] - cam4D.position[2],
            v1[3] - cam4D.position[3]
        ];

        const rel2 = [
            v2[0] - cam4D.position[0],
            v2[1] - cam4D.position[1],
            v2[2] - cam4D.position[2],
            v2[3] - cam4D.position[3]
        ];

        // STEP B: Rotate into Camera Local Space
        const local1 = applyMat4ToVec4(viewMat, rel1);
        const local2 = applyMat4ToVec4(viewMat, rel2);

        // STEP C: Project 4D -> 3D
        const p1 = project4Dto3D(local1);
        const p2 = project4Dto3D(local2);

        positions[ptr++] = p1.x; positions[ptr++] = p1.y; positions[ptr++] = p1.z;
        positions[ptr++] = p2.x; positions[ptr++] = p2.y; positions[ptr++] = p2.z;
    }
    geometry.attributes.position.needsUpdate = true;
}

// --- CONTROLS -----------------------------------------------------------

const keys = {
    w: false, s: false, a: false, d: false, // 3D Move
    q: false, e: false,                     // 4D Move (Ana/Kata)
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
};

window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keydown', e => keys[e.key] = true); // For Arrows
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('keyup', e => keys[e.key] = false);

// Mouse Look Logic
let isDragging = false;
const mouseSensitivity = 0.005;
const moveSpeed = 2.0;

document.addEventListener('mousedown', () => isDragging = true);
document.addEventListener('mouseup', () => isDragging = false);
document.addEventListener('mousemove', (ev) => {
    if(!isDragging) return;

    const dx = ev.movementX * mouseSensitivity;
    const dy = ev.movementY * mouseSensitivity;

    let rX, rY;

    // If SHIFT is held, we rotate the 4D planes (Looking into W)
    if (ev.shiftKey) {
        // Rotate X-W (Panic/Yaw in 4D) and Y-W (Tilt into 4D)
        rX = rotationMatrix4(0, 3, dx);
        rY = rotationMatrix4(1, 3, dy);
    } else {
        // Normal 3D Look (Yaw and Pitch)
        // Yaw = Rotate X-Z (Indices 0, 2)
        // Pitch = Rotate Y-Z (Indices 1, 2)
        rX = rotationMatrix4(0, 2, -dx);
        rY = rotationMatrix4(1, 2, -dy);
    }

    // Apply rotation to camera basis
    // We multiply on the right to rotate relative to current local axes
    cam4D.rotation = mat4Multiply(cam4D.rotation, rX);
    cam4D.rotation = mat4Multiply(cam4D.rotation, rY);
});


function updateCameraMovement() {
    // Extract current local axes from camera matrix
    // Col 0 = Right, Col 1 = Up, Col 2 = Forward, Col 3 = Ana
    const m = cam4D.rotation;
    const right = [m[0], m[4], m[8], m[12]];
    const up    = [m[1], m[5], m[9], m[13]]; // Unused on keys but good to have
    const fwd   = [m[2], m[6], m[10], m[14]];
    const ana   = [m[3], m[7], m[11], m[15]];

    const addVec = (v, scale) => {
        cam4D.position[0] += v[0] * scale;
        cam4D.position[1] += v[1] * scale;
        cam4D.position[2] += v[2] * scale;
        cam4D.position[3] += v[3] * scale;
    };

    if (keys.w) addVec(fwd, moveSpeed);
    if (keys.s) addVec(fwd, -moveSpeed);
    if (keys.d) addVec(right, moveSpeed); // Strafe Right
    if (keys.a) addVec(right, -moveSpeed); // Strafe Left

    // 4D Movement
    if (keys.e) addVec(ana, moveSpeed); // Move "Into" 4D
    if (keys.q) addVec(ana, -moveSpeed); // Move "Out of" 4D
}

// --- LOOP ---------------------------------------------------------------

function animate() {
    requestAnimationFrame(animate);
    updateCameraMovement();
    updateTesseract();
    renderer.render(scene, camera);
}

animate();