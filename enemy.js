// ============================================================
//  enemy.js — 좀비 적 생성 및 경로 이동
//  스테이지별로 HP / 속도가 달라짐
// ============================================================

// 적이 따라갈 웨이포인트 경로
const ENEMY_PATH = [
  new THREE.Vector3(-22,  0,  0),
  new THREE.Vector3(-10,  0,  0),
  new THREE.Vector3(-10,  0, 10),
  new THREE.Vector3( 10,  0, 10),
  new THREE.Vector3( 10,  0, -10),
  new THREE.Vector3( 22,  0, -10),
];

// ============================================================
//  Enemy 클래스 (좀비 1마리)
// ============================================================
class Enemy {
  /**
   * @param {THREE.Scene} scene
   * @param {Function}    onReachCastle - 성 도달 콜백
   * @param {Function}    onDied        - 사망 콜백
   * @param {number}      hp            - 스테이지별 HP
   * @param {number}      speed         - 스테이지별 이동 속도
   */
  constructor(scene, onReachCastle, onDied, hp = 50, speed = 4.5) {
    this.scene         = scene;
    this.onReachCastle = onReachCastle;
    this.onDied        = onDied;

    // ── 스탯 ──
    this.maxHp   = hp;
    this.hp      = hp;
    this.speed   = speed;
    this.damage  = 10;       // 성에 입히는 데미지
    this.isDead  = false;
    this.reached = false;

    // ── 경로 추적 ──
    this.pathIndex = 0;

    // ── 메시 생성 ──
    this.mesh  = this._createMesh();
    this.hpBar = this._createHpBar();
    this.scene.add(this.mesh);
    this.scene.add(this.hpBar);

    // 시작 위치
    this.mesh.position.copy(ENEMY_PATH[0]);
  }

  // ── 좀비 외형 ──
  _createMesh() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x44aa44 });
    const headMat = new THREE.MeshLambertMaterial({ color: 0x88cc44 });
    const armMat  = new THREE.MeshLambertMaterial({ color: 0x44aa44 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.5), bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), headMat);
    head.position.y = 1.3;
    head.castShadow = true;
    group.add(head);

    const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const armL   = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.5, 0.6, 0);
    armL.rotation.z = 0.4;
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.5, 0.6, 0);
    armR.rotation.z = -0.4;
    group.add(armR);

    return group;
  }

  // ── HP 바 ──
  _createHpBar() {
    const group = new THREE.Group();

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    group.add(bg);

    const fillMat  = new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide });
    this.hpFill    = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.18), fillMat);
    this.hpFill.position.z = 0.01;
    group.add(this.hpFill);

    return group;
  }

  // ── 데미지 처리 ──
  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;

    // HP 바 업데이트
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpFill.scale.x       = ratio;
    this.hpFill.position.x    = -(1 - ratio) * 0.6;

    if (this.hp <= 0) this._die();
  }

  // ── 사망 ──
  _die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this.scene.remove(this.hpBar);
    if (this.onDied) this.onDied();
  }

  // ── 매 프레임 업데이트 ──
  update(delta, camera) {
    if (this.isDead || this.reached) return;

    const target = ENEMY_PATH[this.pathIndex];
    const pos    = this.mesh.position;
    const dir    = new THREE.Vector3().subVectors(target, pos);
    const dist   = dir.length();

    if (dist < 0.2) {
      this.pathIndex++;
      if (this.pathIndex >= ENEMY_PATH.length) {
        // 성 도달
        this.reached = true;
        this.scene.remove(this.mesh);
        this.scene.remove(this.hpBar);
        if (this.onReachCastle) this.onReachCastle(this.damage);
        return;
      }
    } else {
      dir.normalize();
      pos.addScaledVector(dir, this.speed * delta);
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    // HP 바 위치 동기화
    this.hpBar.position.set(pos.x, pos.y + 2.2, pos.z);
    if (camera) this.hpBar.lookAt(camera.position);

    // 살짝 흔들림
    this.mesh.position.y = Math.sin(Date.now() * 0.005) * 0.06;
  }

  getPosition() { return this.mesh.position; }
}

// ============================================================
//  EnemySpawner — 일정 간격으로 적 소환
// ============================================================
class EnemySpawner {
  /**
   * @param {THREE.Scene} scene
   * @param {Function}    onReachCastle
   * @param {Function}    onDied
   * @param {number}      interval   - 소환 간격(초)
   * @param {number}      enemyHp    - 적 HP
   * @param {number}      enemySpeed - 적 속도
   */
  constructor(scene, onReachCastle, onDied, interval = 3.0, enemyHp = 50, enemySpeed = 4.5) {
    this.scene         = scene;
    this.onReachCastle = onReachCastle;
    this.onDied        = onDied;
    this.interval      = interval;
    this.enemyHp       = enemyHp;
    this.enemySpeed    = enemySpeed;
    this.timer         = 0;
    this.enemies       = [];
    this.active        = true;
  }

  update(delta, camera) {
    if (!this.active) return;

    this.timer += delta;
    if (this.timer >= this.interval) {
      this.timer = 0;
      this._spawn();
    }

    // 살아있는 적만 유지
    this.enemies = this.enemies.filter(e => !e.isDead && !e.reached);
    for (const e of this.enemies) e.update(delta, camera);
  }

  _spawn() {
    const e = new Enemy(
      this.scene,
      this.onReachCastle,
      this.onDied,
      this.enemyHp,
      this.enemySpeed
    );
    this.enemies.push(e);
    console.log(`[Spawner] 좀비 소환! HP:${this.enemyHp} 속도:${this.enemySpeed} 현재 수:${this.enemies.length}`);
  }

  clearAll() {
    for (const e of this.enemies) {
      this.scene.remove(e.mesh);
      this.scene.remove(e.hpBar);
    }
    this.enemies = [];
  }

  getAliveEnemies() {
    return this.enemies.filter(e => !e.isDead && !e.reached);
  }
}
