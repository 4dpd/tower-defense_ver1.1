// ============================================================
//  tower.js — 타워 배치 및 자동 공격
//  ✅ 변경사항:
//    - 타워 설치 가능 구역 3개로 고정
//    - 구역당 최대 타워 2개
//    - 구역 외 설치 불가
// ============================================================

// ────────────────────────────────────────
//  타워 설치 가능 구역 3개 정의
//  맵의 경로 옆에 배치 (경로와 겹치지 않는 위치)
// ────────────────────────────────────────
const TOWER_ZONES = [
  {
    id: 0,
    label: 'A',
    center: new THREE.Vector3(-10, 0, -5),  // 경로 왼쪽 구역
    size:   6,                               // 구역 한 변 크기
    maxTowers: 2,
    towers: [],   // 설치된 타워 목록
  },
  {
    id: 1,
    label: 'B',
    center: new THREE.Vector3(0, 0, 3),     // 경로 중앙 구역
    size:   6,
    maxTowers: 2,
    towers: [],
  },
  {
    id: 2,
    label: 'C',
    center: new THREE.Vector3(10, 0, -3),   // 경로 오른쪽 구역
    size:   6,
    maxTowers: 2,
    towers: [],
  },
];

// ────────────────────────────────────────
//  Tower 클래스 — 타워 1기
// ────────────────────────────────────────
class Tower {
  constructor(scene, position) {
    this.scene   = scene;
    this.range   = 9;
    this.damage  = 18;
    this.fireRate= 1.4;
    this.fireCool= 0;
    this.isActive= true;
    this.bullets = [];

    this.mesh = this._createMesh();
    this.mesh.position.copy(position);
    this.mesh.position.y = 0;
    this.scene.add(this.mesh);

    // 범위 표시 (3초 후 사라짐)
    this.rangeIndicator = this._createRangeIndicator();
    this.rangeIndicator.position.copy(position);
    this.rangeIndicator.position.y = 0.05;
    this.scene.add(this.rangeIndicator);
    setTimeout(() => this.scene.remove(this.rangeIndicator), 3000);

    console.log('[Tower] 배치 완료. 위치:', position);
  }

  _createMesh() {
    const group = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.4, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x888888 })
    );
    base.position.y = 0.2;
    base.castShadow = true;
    group.add(base);

    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 2.0, 8),
      new THREE.MeshLambertMaterial({ color: 0x999999 })
    );
    tower.position.y = 1.4;
    tower.castShadow = true;
    group.add(tower);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x555555 })
    );
    head.position.y = 2.65;
    group.add(head);
    this._turretHead = head;

    this._barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    this._barrel.rotation.x = Math.PI / 2;
    this._barrel.position.set(0, 2.65, 0.7);
    group.add(this._barrel);

    return group;
  }

  _createRangeIndicator() {
    const geo = new THREE.RingGeometry(this.range - 0.1, this.range, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    return new THREE.Mesh(geo, mat);
  }

  update(delta, enemies) {
    if (!this.isActive) return;
    this.fireCool -= delta;

    const target = this._findClosestEnemy(enemies);
    if (target) {
      const dir   = new THREE.Vector3().subVectors(target.getPosition(), this.mesh.position);
      const angle = Math.atan2(dir.x, dir.z);
      if (this._turretHead) this._turretHead.rotation.y = angle;
      if (this._barrel)     this._barrel.rotation.y     = angle - Math.PI / 2;

      if (this.fireCool <= 0) {
        this.fireCool = 1 / this.fireRate;
        this._shootAt(target);
      }
    }

    this._updateBullets(delta);
  }

  _findClosestEnemy(enemies) {
    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      if (e.isDead || e.reached) continue;
      const d = this.mesh.position.distanceTo(e.getPosition());
      if (d <= this.range && d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  _shootAt(enemy) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffcc00 })
    );
    mesh.position.copy(this.mesh.position);
    mesh.position.y = 2.65;
    this.scene.add(mesh);
    this.bullets.push({ mesh, target: enemy, speed: 18, damage: this.damage, active: true });
  }

  _updateBullets(delta) {
    this.bullets = this.bullets.filter(b => b.active);
    for (const b of this.bullets) {
      if (!b.active) continue;
      if (b.target.isDead || b.target.reached) {
        this.scene.remove(b.mesh); b.active = false; continue;
      }
      const tp  = b.target.getPosition().clone();
      tp.y      = 2.65;
      const dir = new THREE.Vector3().subVectors(tp, b.mesh.position);
      if (dir.length() < 0.4) {
        b.target.takeDamage(b.damage);
        this.scene.remove(b.mesh);
        b.active = false;
        this._spawnHitEffect(b.mesh.position.clone());
      } else {
        dir.normalize();
        b.mesh.position.addScaledVector(dir, b.speed * delta);
      }
    }
  }

  _spawnHitEffect(pos) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 })
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    setTimeout(() => this.scene.remove(mesh), 150);
  }

  destroy() {
    this.isActive = false;
    this.scene.remove(this.mesh);
    this.scene.remove(this.rangeIndicator);
    for (const b of this.bullets) this.scene.remove(b.mesh);
    this.bullets = [];
  }
}

// ────────────────────────────────────────
//  TowerManager — 구역 기반 타워 관리
// ────────────────────────────────────────
class TowerManager {
  constructor(scene, camera, renderer) {
    this.scene    = scene;
    this.camera   = camera;
    this.renderer = renderer;
    this.towers   = [];
    this.active   = true;

    // 구역 데이터 초기화 (재시작 시 towers 배열 비워야 함)
    for (const z of TOWER_ZONES) z.towers = [];

    // 구역 시각화 오브젝트 목록 (재시작 시 제거용)
    this.zoneObjects = [];

    // 레이캐스팅용 보이지 않는 바닥
    this.groundPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.scene.add(this.groundPlane);

    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();

    // 구역 표시 생성
    this._buildZoneIndicators();
    this._registerEvents();
  }

  // ────────────────────────────────────────
  //  구역 표시 — 바닥에 사각형 + 라벨 표시
  // ────────────────────────────────────────
  _buildZoneIndicators() {
    for (const zone of TOWER_ZONES) {
      // 구역 바닥 (반투명 사각형)
      const geo  = new THREE.PlaneGeometry(zone.size, zone.size);
      const mat  = new THREE.MeshBasicMaterial({
        color: 0x00ccff,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.center.x, 0.03, zone.center.z);
      this.scene.add(mesh);
      this.zoneObjects.push(mesh);
      zone._planeMesh = mesh; // 나중에 색상 업데이트용

      // 구역 테두리
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(zone.size, zone.size)),
        new THREE.LineBasicMaterial({ color: 0x00ccff, transparent: true, opacity: 0.6 })
      );
      edges.rotation.x = -Math.PI / 2;
      edges.position.set(zone.center.x, 0.04, zone.center.z);
      this.scene.add(edges);
      this.zoneObjects.push(edges);
      zone._edgeMesh = edges;

      // 구역 라벨용 작은 기둥
      const labelPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.5, 6),
        new THREE.MeshLambertMaterial({ color: 0x00aacc })
      );
      labelPost.position.set(zone.center.x, 0.25, zone.center.z);
      this.scene.add(labelPost);
      this.zoneObjects.push(labelPost);
    }
    console.log('[TowerManager] 구역 3개 생성 완료');
  }

  // 구역 색상 업데이트 (가득 차면 빨간색)
  _updateZoneColor(zone) {
    if (!zone._planeMesh) return;
    const full  = zone.towers.length >= zone.maxTowers;
    const color = full ? 0xff2200 : 0x00ccff;
    zone._planeMesh.material.color.setHex(color);
    if (zone._edgeMesh) zone._edgeMesh.material.color.setHex(color);
  }

  // ────────────────────────────────────────
  //  이벤트 등록
  // ────────────────────────────────────────
  _registerEvents() {
    // 마우스 이동 — 위치 추적
    window.addEventListener('mousemove', (e) => {
      const rect   = this.renderer.domElement.getBoundingClientRect();
      this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    });

    // 클릭 — 구역 안이면 타워 설치
    window.addEventListener('click', (e) => {
      if (!this.active) return;
      const pos = this._getGroundPosition();
      if (!pos) return;

      // 어느 구역 안에 클릭했는지 확인
      const zone = this._findZoneAt(pos);
      if (!zone) {
        console.log('[TowerManager] 구역 밖 클릭 — 설치 불가');
        this._showMessage('⚠ 파란 구역 안에만 타워를 설치할 수 있습니다!');
        return;
      }

      if (zone.towers.length >= zone.maxTowers) {
        console.log('[TowerManager] 구역 가득 참 — 설치 불가');
        this._showMessage(`⚠ 구역 ${zone.label} 은 이미 가득 찼습니다! (최대 ${zone.maxTowers}개)`);
        return;
      }

      // 타워 설치
      this._placeTower(pos, zone);
    });

    // 우클릭 컨텍스트 메뉴 막기
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // 마우스 위치 → 3D 바닥 좌표
  _getGroundPosition() {
    this._raycaster.setFromCamera(this._mouse, this.camera);
    const hits = this._raycaster.intersectObject(this.groundPlane);
    return hits.length > 0 ? hits[0].point : null;
  }

  // 클릭 위치가 어느 구역 안에 있는지 반환 (없으면 null)
  _findZoneAt(pos) {
    for (const zone of TOWER_ZONES) {
      const half = zone.size / 2;
      const dx   = Math.abs(pos.x - zone.center.x);
      const dz   = Math.abs(pos.z - zone.center.z);
      if (dx <= half && dz <= half) return zone;
    }
    return null;
  }

  // 타워 설치
  _placeTower(position, zone) {
    const tower = new Tower(this.scene, position);
    this.towers.push(tower);
    zone.towers.push(tower);
    this._updateZoneColor(zone);
    console.log(`[TowerManager] 구역 ${zone.label} 에 타워 설치! (${zone.towers.length}/${zone.maxTowers})`);
  }

  // 화면 중앙에 안내 메시지 표시
  _showMessage(text) {
    let el = document.getElementById('zone-message');
    if (!el) {
      el = document.createElement('div');
      el.id = 'zone-message';
      el.style.cssText = `
        position:fixed; top:50%; left:50%;
        transform:translate(-50%,-50%);
        background:rgba(0,0,0,0.8);
        color:#ffcc00; font-family:'Courier New',monospace;
        font-size:15px; letter-spacing:1px;
        padding:12px 24px; border-radius:6px;
        border:1px solid rgba(255,200,0,0.4);
        z-index:30; pointer-events:none;
        opacity:0; transition:opacity 0.2s;
      `;
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
  }

  // 매 프레임 업데이트
  update(delta, enemies) {
    for (const tower of this.towers) {
      tower.update(delta, enemies);
    }
  }

  // 전체 초기화 (재시작)
  clearAll() {
    for (const t of this.towers) t.destroy();
    this.towers = [];

    for (const obj of this.zoneObjects) this.scene.remove(obj);
    this.zoneObjects = [];

    for (const z of TOWER_ZONES) z.towers = [];

    // 구역 다시 표시
    this._buildZoneIndicators();
  }
}
