// ============================================================
//  tower.js — 타워 3종 + 지정 구역에만 설치 가능
//  타워 종류: 기본(Basic) / 저격(Sniper) / 범위(Splash)
// ============================================================

// ── 설치 가능 구역 (경로 옆 잔디 구역만) ──
const TOWER_ZONES = [
  { id: 0,  x: -16, z:  6,  w: 10, d: 5  },
  { id: 1,  x: -16, z: -6,  w: 10, d: 5  },
  { id: 2,  x:  -3, z:  16, w: 10, d: 5  },
  { id: 3,  x:   3, z:   4, w: 10, d: 5  },
  { id: 4,  x:  16, z:   3, w: 5,  d: 10 },
  { id: 5,  x:   4, z:  -2, w: 5,  d: 10 },
  { id: 6,  x:  16, z: -17, w: 10, d: 5  },
  { id: 7,  x:  16, z:  -3, w: 10, d: 5  },
];

// ── 타워 스탯 정의 ──
const TOWER_STATS = {
  basic: {
    name:     '기본 타워',
    color:    0x999999,
    range:    8,
    damage:   15,
    fireRate: 1.2,
    desc:     '균형잡힌 기본 타워',
  },
  sniper: {
    name:     '저격 타워',
    color:    0x4466cc,
    range:    16,
    damage:   40,
    fireRate: 0.4,
    desc:     '긴 사거리, 강한 한방',
  },
  splash: {
    name:     '범위 타워',
    color:    0xcc4422,
    range:    6,
    damage:   10,
    fireRate: 0.8,
    splashRadius: 3.5,
    desc:     '주변 적에게 범위 피해',
  },
};

// ============================================================
//  Tower 클래스
// ============================================================
class Tower {
  constructor(scene, position, type = 'basic') {
    this.scene    = scene;
    this.type     = type;
    this.stats    = TOWER_STATS[type];
    this.isActive = true;
    this.bullets  = [];
    this.fireCool = 0;

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
  }

  _createMesh() {
    const group = new THREE.Group();
    const color = this.stats.color;

    // 기단 (공통)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.4, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x777777 })
    );
    base.position.y = 0.2;
    base.castShadow = true;
    group.add(base);

    if (this.type === 'basic') {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.55, 2.0, 8),
        new THREE.MeshLambertMaterial({ color })
      );
      tower.position.y = 1.4;
      tower.castShadow = true;
      group.add(tower);

    } else if (this.type === 'sniper') {
      // 가늘고 높은 탑
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.38, 3.2, 6),
        new THREE.MeshLambertMaterial({ color })
      );
      tower.position.y = 2.0;
      tower.castShadow = true;
      group.add(tower);

      // 긴 포신
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6),
        new THREE.MeshLambertMaterial({ color: 0x222244 })
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 3.4, 0.9);
      group.add(barrel);
      this._barrel = barrel;

    } else if (this.type === 'splash') {
      // 넓고 낮은 탑
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.85, 1.4, 6),
        new THREE.MeshLambertMaterial({ color })
      );
      tower.position.y = 1.1;
      tower.castShadow = true;
      group.add(tower);

      // 범위 링
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(this.stats.splashRadius, 0.08, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xff6633, transparent: true, opacity: 0.35 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;
      group.add(ring);
    }

    // 포탑 머리 (공통)
    const headY = this.type === 'sniper' ? 3.6 : this.type === 'splash' ? 1.9 : 2.65;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.45, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x444444 })
    );
    head.position.y = headY;
    group.add(head);
    this._turretHead = head;

    return group;
  }

  _createRangeIndicator() {
    const colorMap = { basic: 0xffff00, sniper: 0x4466ff, splash: 0xff4422 };
    return new THREE.Mesh(
      new THREE.RingGeometry(this.stats.range - 0.1, this.stats.range, 32),
      new THREE.MeshBasicMaterial({
        color: colorMap[this.type],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
      })
    );
  }

  update(delta, enemies) {
    if (!this.isActive) return;
    this.fireCool -= delta;

    const target = this._findTarget(enemies);
    if (target) {
      const dir   = new THREE.Vector3().subVectors(target.getPosition(), this.mesh.position);
      const angle = Math.atan2(dir.x, dir.z);
      if (this._turretHead) this._turretHead.rotation.y = angle;

      if (this.fireCool <= 0) {
        this.fireCool = 1 / this.stats.fireRate;
        this._shoot(target, enemies);
      }
    }

    this._updateBullets(delta);
  }

  _findTarget(enemies) {
    let best = null, bestPath = -1;
    for (const e of enemies) {
      if (e.isDead || e.reached) continue;
      const dist = this.mesh.position.distanceTo(e.getPosition());
      if (dist <= this.stats.range && e.pathIndex > bestPath) {
        bestPath = e.pathIndex;
        best = e;
      }
    }
    return best;
  }

  _shoot(target, enemies) {
    if (this.type === 'splash') {
      this._splashDamage(target.getPosition().clone(), enemies);
      this._spawnSplashEffect(target.getPosition().clone());
      return;
    }

    const color = this.type === 'sniper' ? 0x88aaff : 0xffcc00;
    const size  = this.type === 'sniper' ? 0.12 : 0.18;
    const mesh  = new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    const headY = this.type === 'sniper' ? 3.4 : 2.65;
    mesh.position.copy(this.mesh.position);
    mesh.position.y = headY;
    this.scene.add(mesh);

    this.bullets.push({
      mesh, target,
      speed:  this.type === 'sniper' ? 28 : 18,
      damage: this.stats.damage,
      active: true,
    });
  }

  _splashDamage(center, enemies) {
    for (const e of enemies) {
      if (e.isDead || e.reached) continue;
      const dist = center.distanceTo(e.getPosition());
      if (dist <= this.stats.splashRadius) {
        const falloff = 1 - (dist / this.stats.splashRadius) * 0.5;
        e.takeDamage(Math.floor(this.stats.damage * falloff));
      }
    }
  }

  _spawnSplashEffect(position) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.stats.splashRadius, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4422, transparent: true, opacity: 0.3 })
    );
    mesh.position.copy(position);
    this.scene.add(mesh);
    setTimeout(() => this.scene.remove(mesh), 200);
  }

  _updateBullets(delta) {
    this.bullets = this.bullets.filter(b => b.active);
    for (const b of this.bullets) {
      if (!b.active) continue;
      if (b.target.isDead || b.target.reached) {
        this.scene.remove(b.mesh); b.active = false; continue;
      }
      const tp = b.target.getPosition().clone();
      tp.y = 2.0;
      const dir  = new THREE.Vector3().subVectors(tp, b.mesh.position);
      const dist = dir.length();
      if (dist < 0.4) {
        b.target.takeDamage(b.damage);
        this.scene.remove(b.mesh); b.active = false;
        this._spawnHitEffect(b.mesh.position.clone());
      } else {
        dir.normalize();
        b.mesh.position.addScaledVector(dir, b.speed * delta);
      }
    }
  }

  _spawnHitEffect(position) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.9 })
    );
    mesh.position.copy(position);
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

// ============================================================
//  TowerManager — 설치 구역 관리 + 배치
// ============================================================
class TowerManager {
  constructor(scene, camera, renderer) {
    this.scene        = scene;
    this.camera       = camera;
    this.renderer     = renderer;
    this.towers       = [];
    this.active       = true;
    this.selectedType = 'basic';
    this.zoneMeshes   = [];
    this.MAX_PER_ZONE = 2;
    this.zoneCount    = {};
    TOWER_ZONES.forEach(z => { this.zoneCount[z.id] = 0; });

    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();

    this._buildZones();
    this._registerEvents();
  }

  // ── 설치 구역 시각화 (반투명 녹색) ──
  _buildZones() {
    for (const zone of TOWER_ZONES) {
      // 구역 바닥면
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(zone.w, zone.d),
        new THREE.MeshBasicMaterial({
          color: 0x44ff88,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(zone.x, 0.03, zone.z);
      mesh.userData.zoneId   = zone.id;
      mesh.userData.zoneData = zone;
      this.scene.add(mesh);
      this.zoneMeshes.push(mesh);

      // 구역 테두리
      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(zone.w, zone.d)),
        new THREE.LineBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.55 })
      );
      border.rotation.x = -Math.PI / 2;
      border.position.set(zone.x, 0.04, zone.z);
      this.scene.add(border);
      this.zoneMeshes.push(border);
    }
  }

  _registerEvents() {
    window.addEventListener('click', (e) => {
      if (!this.active) return;
      // 타워 선택 UI 클릭은 무시
      if (e.target.closest('#tower-select')) return;

      const rect = this.renderer.domElement.getBoundingClientRect();
      this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      this._tryPlace();
    });
  }

  _tryPlace() {
    this._raycaster.setFromCamera(this._mouse, this.camera);
    const planeMeshes = this.zoneMeshes.filter(m => m.type === 'Mesh');
    const hits = this._raycaster.intersectObjects(planeMeshes);

    if (hits.length === 0) {
      this._showMsg('⚠ 초록색 구역에만 설치할 수 있어요!');
      return;
    }

    const hit    = hits[0];
    const zoneId = hit.object.userData.zoneId;

    if (this.zoneCount[zoneId] >= this.MAX_PER_ZONE) {
      this._showMsg(`⚠ 이 구역은 최대 ${this.MAX_PER_ZONE}개까지만 설치 가능해요!`);
      return;
    }

    const pos = hit.point.clone();
    pos.y = 0;

    // 너무 가까운 타워 확인
    for (const t of this.towers) {
      if (t.mesh.position.distanceTo(pos) < 2.0) {
        this._showMsg('⚠ 다른 타워와 너무 가깝습니다!');
        return;
      }
    }

    const tower = new Tower(this.scene, pos, this.selectedType);
    this.towers.push(tower);
    this.zoneCount[zoneId]++;

    // 구역 꽉 차면 빨간색으로
    if (this.zoneCount[zoneId] >= this.MAX_PER_ZONE) {
      hit.object.material.color.setHex(0xff4444);
      hit.object.material.opacity = 0.12;
    }

    this._showMsg(`✅ ${TOWER_STATS[this.selectedType].name} 설치 완료!`);
  }

  selectType(type) {
    this.selectedType = type;
    document.querySelectorAll('.tower-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.type === type);
    });
  }

  _showMsg(text) {
    let el = document.getElementById('place-msg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'place-msg';
      el.style.cssText = `
        position:fixed;bottom:70px;left:50%;
        transform:translateX(-50%);
        background:rgba(10,10,20,0.9);
        border:1px solid rgba(255,180,60,0.4);
        padding:8px 24px;border-radius:6px;
        font-family:'Courier New',monospace;
        font-size:13px;color:#ffe08a;
        letter-spacing:1px;z-index:20;
        pointer-events:none;transition:opacity 0.3s;
      `;
      document.body.appendChild(el);
    }
    el.textContent  = text;
    el.style.opacity = '1';
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  }

  update(delta, enemies) {
    for (const t of this.towers) t.update(delta, enemies);
  }

  // 스테이지 전환 시 구역 카운트만 리셋 (타워는 유지)
  resetZones() {
    TOWER_ZONES.forEach(z => { this.zoneCount[z.id] = 0; });
    this.zoneMeshes.filter(m => m.type === 'Mesh').forEach(m => {
      m.material.color.setHex(0x44ff88);
      m.material.opacity = 0.18;
    });
  }

  clearAll() {
    for (const t of this.towers) t.destroy();
    this.towers = [];
    for (const m of this.zoneMeshes) this.scene.remove(m);
    this.zoneMeshes = [];
    TOWER_ZONES.forEach(z => { this.zoneCount[z.id] = 0; });
  }
}
