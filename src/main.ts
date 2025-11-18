import * as THREE from 'three';

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
const size = 100;
const divisions = 100;
const gridHelper = new THREE.GridHelper(size, divisions, 0x444444, 0x888888);
scene.add(gridHelper);

// Movement
const moveSpeed = 0.5;
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

animate();
