// ============================================================
//  player.js — 플레이어 생성 및 키보드 이동 처리
//  역할: 플레이어 메시 생성, 방향키 입력 감지, 매 프레임 위동
// ============================================================

/**
 * Player 클래스
 * @param {THREE.Scene} scene - 플레이어를 추가할 씬
 */
class Player {
  constructor(scene) {
    this.scene = scene;

    // ── 이동 속도 (단위/초) ──
    this.speed = 8;

    // ── 현재 눌린 키 상태를 저장하는 객체 ──
    // 예: { ArrowUp: true, ArrowDown: false, ... }
    this.keys = {};

    // ── 플레이어 3D 메시 생성 ──
    this.mesh = this._createMesh();
    scene.add(this.mesh);

    // ── 키 이벤트 리스너 등록 ──
    this._registerKeyEvents();

    console.log('[Player] 플레이어 생성 완료. 초기 위치:', this.mesh.position);
  }

  // ────────────────────────────────────────
  //  플레이어 외형 생성 (파란 캡슐형 캐릭터)
  // ────────────────────────────────────────
  _createMesh() {
    // 그룹으로 묶어 몸통 + 머리를 함께 관리
    const group = new THREE.Group();

    // 몸통: CylinderGeometry (캡슐 대용)
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.0, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3399ff });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5; // 바닥 위로 올림
    group.add(body);

    // 머리: SphereGeometry
    const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x66bbff });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.3;
    group.add(head);

    // 그림자 설정
    body.castShadow = true;
    head.castShadow = true;

    // 시작 위치: 맵 중앙 근처
    group.position.set(0, 0, 0);

    return group;
  }

  // ────────────────────────────────────────
  //  키보드 이벤트 등록
  // ────────────────────────────────────────
  _registerKeyEvents() {
    // keydown: 키가 눌릴 때 true 저장
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    // keyup: 키가 떼어질 때 false 저장
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  // ────────────────────────────────────────
  //  매 프레임 호출 — 이동 처리
  //  @param {number} delta - 마지막 프레임 이후 경과 시간(초)
  // ────────────────────────────────────────
  update(delta) {
    const moveAmount = this.speed * delta;

    // 방향키에 따라 X/Z 이동 (Y는 수직이라 건드리지 않음)
    if (this.keys['ArrowUp']    || this.keys['KeyW']) {
      this.mesh.position.z -= moveAmount;
    }
    if (this.keys['ArrowDown']  || this.keys['KeyS']) {
      this.mesh.position.z += moveAmount;
    }
    if (this.keys['ArrowLeft']  || this.keys['KeyA']) {
      this.mesh.position.x -= moveAmount;
    }
    if (this.keys['ArrowRight'] || this.keys['KeyD']) {
      this.mesh.position.x += moveAmount;
    }

    // ── 맵 경계 제한 (맵 크기 ±24 이내로 클램프) ──
    const BOUNDARY = 24;
    this.mesh.position.x = Math.max(-BOUNDARY, Math.min(BOUNDARY, this.mesh.position.x));
    this.mesh.position.z = Math.max(-BOUNDARY, Math.min(BOUNDARY, this.mesh.position.z));
  }

  // 현재 위치 반환 (카메라 추적 등에서 사용)
  getPosition() {
    return this.mesh.position;
  }

  // 플레이어 씬에서 제거 (재시작 시)
  destroy() {
    this.scene.remove(this.mesh);
  }
}
