// ============================================================
//  main.js — Three.js 초기화 + 렌더 루프
//  역할: 씬/카메라/렌더러 설정, initGame() 노출, rAF 루프
//
//  ✅ 흐름:
//  index.html → 닉네임 입력 → startGame() → initGame() → animate()
// ============================================================

let scene, camera, renderer, clock;

// 카메라 궤도 상태
const cameraState = {
  isDragging: false,
  prevMouseX: 0, prevMouseY: 0,
  theta:  45,    // 수평 각도(도)
  phi:    55,    // 수직 각도(도)
  radius: 30,    // 카메라-플레이어 거리
  targetX: 0, targetZ: 0,
};

// ============================================================
//  initGame — index.html 의 startGame() 에서 호출됨
// ============================================================
window.initGame = function () {
  console.log('[main] Three.js 초기화 시작. 닉네임:', window.playerNickname);

  // ── 1. Scene ──
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 40, 70);

  // ── 2. Camera ──
  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1, 200
  );

  // ── 3. Renderer ──
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  document.getElementById('game-container').appendChild(renderer.domElement);

  // ── 4. Clock ──
  clock = new THREE.Clock();

  // ── 5. GameManager ──
  const gameManager    = new GameManager(scene, camera, renderer);
  window._gameManager  = gameManager;

  // ── 6. 이벤트 ──
  window.addEventListener('resize', _onResize);
  _registerCameraEvents();

  // ── 7. 렌더 루프 ──
  animate();

  console.log('[main] 초기화 완료!');
};

// ============================================================
//  렌더 루프
// ============================================================
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  window._gameManager.update(delta);
  _updateCamera();
  renderer.render(scene, camera);
}

// ============================================================
//  카메라 — 플레이어 추적 궤도 카메라
// ============================================================
function _updateCamera() {
  const playerPos = window._gameManager.player.getPosition();

  // 플레이어 위치로 부드럽게 따라감 (lerp)
  cameraState.targetX += (playerPos.x - cameraState.targetX) * 0.08;
  cameraState.targetZ += (playerPos.z - cameraState.targetZ) * 0.08;

  const tRad = THREE.MathUtils.degToRad(cameraState.theta);
  const pRad = THREE.MathUtils.degToRad(cameraState.phi);

  camera.position.x = cameraState.targetX + cameraState.radius * Math.sin(tRad) * Math.sin(pRad);
  camera.position.y =                        cameraState.radius * Math.cos(pRad);
  camera.position.z = cameraState.targetZ + cameraState.radius * Math.cos(tRad) * Math.sin(pRad);

  camera.lookAt(cameraState.targetX, 1, cameraState.targetZ);
}

// ============================================================
//  마우스 드래그 → 카메라 회전 / 휠 → 줌
// ============================================================
function _registerCameraEvents() {
  const canvas = renderer.domElement;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2 || e.button === 1) {
      cameraState.isDragging = true;
      cameraState.prevMouseX = e.clientX;
      cameraState.prevMouseY = e.clientY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!cameraState.isDragging) return;
    cameraState.theta -= (e.clientX - cameraState.prevMouseX) * 0.4;
    cameraState.phi   -= (e.clientY - cameraState.prevMouseY) * 0.4;
    cameraState.phi    = Math.max(20, Math.min(80, cameraState.phi));
    cameraState.prevMouseX = e.clientX;
    cameraState.prevMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => { cameraState.isDragging = false; });

  canvas.addEventListener('wheel', (e) => {
    cameraState.radius = Math.max(10, Math.min(50, cameraState.radius + e.deltaY * 0.03));
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ============================================================
//  창 크기 변경
// ============================================================
function _onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
