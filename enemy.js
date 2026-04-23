// ============================================================
//  enemy.js — 좀비 적 생성 및 경로 이동 (난이도 상승 버전)
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

// ── 웨이브별 설정 (난이도 단계) ──
const WAVE_CONFIG = [
  // wave 1
  { hp: 50,  speed: 4.5, damage: 10, interval: 3.0, count: 5  },
  // wave 2
  { hp: 80,  speed: 5.5, damage: 15, interval: 2.5, count: 8  },
  // wave 3
  { hp: 120, speed: 6.5, damage: 20, interval: 2.0, count: 12 },
];

class Enemy {
  /**
   * @param {THREE.Scene} scene
   * @param {Function} onReachCastle
   * @param {Function} onDied
   * @param {object}  config  - { hp, speed, damage }
   */
  constructor(scene, onReachCastle, onDied, config = {}) {
    this.scene         = scene;
    this.onReachCastle = onReachCastle;
    this.onDied        = onDied;

    // 설정값 (웨이브별로 달라짐)
    this.maxHp   = config.hp     || 50;
    this.hp      = this.maxHp;
    this.speed   = config.speed  || 4.5;
    this.damage  = config.damage || 10;

    this.isDead  = false;
    this.reached = false;
    this.pathIndex = 0;

    this.mesh  = this._createMesh(config);
    this.hpBar = this._createHpBar();
    this.scene.add(this.mesh);
    this.scene.add(this.hpBar);

    this.mesh.position.copy(ENEMY_PATH[0]);
    this.hpBar.position.copy(ENEMY_PATH[0]);
    this.hpBar.position.y += 2.5;

    console.log(`[Enemy] 좀비 생성 HP:${this.maxHp} SPD:${this.speed}`);
  }

  // ── 웨이브에 따라 색상이 달라지는 좀비 외형 ──
  _createMesh(config) {
    const group = new THREE.Group();

    // 웨이브가 높을수록 더 붉은색
    const bodyColor = config.wave === 2 ? 0xcc4400 :
                      config.wave === 1 ? 0xaa6600 : 0x44aa44;
    const headColor = config.wave === 2 ? 0xff6622 :
                      config.wave === 1 ? 0xddaa22 : 0x88cc44;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.0, 0.5),
      new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.55),
      new THREE.MeshLambertMaterial({ color: headColor })
    );
    head.position.y = 1.3;
    head.castShadow = true;
    group.add(head);

    const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const armMat = new THREE.MeshLambertMaterial({ color: bodyColor });

    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.5, 0.6, 0);
    armL.rotation.z = 0.4;
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.5, 0.6, 0);
    armR.rotation.z = -0.4;
    group.add(armR);

    return group;
  }

  _createHpBar() {
    const group = new THREE.Group();

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
    );
    group.add(bg);

    const fillMat   = new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide });
    this.hpFill     = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.18), fillMat);
    this.hpFill.position.z = 0.01;
    group.add(this.hpFill);

    return group;
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp -= amount;

    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpFill.scale.x       = ratio;
    this.hpFill.position.x    = -(1 - ratio) * 0.6;

    if (this.hp <= 0) this._die();
  }

  _die() {
    this.isDead = true;
    this.scene.remove(this.mesh);
    this.scene.remove(this.hpBar);
    console.log('[Enemy] 좀비 사망!');
    if (this.onDied) this.onDied();
  }

  update(delta, camera) {
    if (this.isDead || this.reached) return;

    const target = ENEMY_PATH[this.pathIndex];
    const pos    = this.mesh.position;
    const dir    = new THREE.Vector3().subVectors(target, pos);
    const dist   = dir.length();

    if (dist < 0.2) {
      this.pathIndex++;
      if (this.pathIndex >= ENEMY_PATH.length) {
        this.reached = true;
        this.scene.remove(this.mesh);
        this.scene.remove(this.hpBar);
        console.log('[Enemy] 성 도달! 데미지:', this.damage);
        if (this.onReachCastle) this.onReachCastle(this.damage);
        return;
      }
    } else {
      dir.normalize();
      pos.addScaledVector(dir, this.speed * delta);
      this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    this.hpBar.position.set(pos.x, pos.y + 2.2, pos.z);
    if (camera) this.hpBar.lookAt(camera.position);

    // 흔들림 애니메이션
    this.mesh.position.y = Math.sin(Date.now() * 0.005) * 0.08;
  }

  getPosition() { return this.mesh.position; }
}

// ────────────────────────────────────────
//  EnemySpawner — 웨이브 기반 적 소환
// ────────────────────────────────────────
class EnemySpawner {
  constructor(scene, onReachCastle, onDied, onWaveChange) {
    this.scene         = scene;
    this.onReachCastle = onReachCastle;
    this.onDied        = onDied;
    this.onWaveChange  = onWaveChange; // 웨이브 변경 시 UI 알림용 콜백

    this.enemies  = [];
    this.active   = true;

    // 웨이브 상태
    this.waveIndex    = 0;              // 현재 웨이브 인덱스 (0~2)
    this.spawnedCount = 0;              // 이번 웨이브에서 소환된 수
    this.spawnTimer   = 0;
    this.waveCleared  = false;          // 이번 웨이브 소환 완료 여부
    this.betweenWaves = false;          // 웨이브 사이 대기 중
    this.betweenTimer = 0;
    this.BETWEEN_WAIT = 5;             // 웨이브 사이 대기 시간(초)

    console.log('[Spawner] 웨이브 1 시작!');
  }

  // 현재 웨이브 설정
  get currentConfig() {
    return WAVE_CONFIG[this.waveIndex];
  }

  // 총 웨이브 수
  get totalWaves() {
    return WAVE_CONFIG.length;
  }

  // 현재 웨이브 번호 (1-based)
  get currentWave() {
    return this.waveIndex + 1;
  }

  update(delta, camera) {
    if (!this.active) return;

    // 살아있는 적만 남김
    this.enemies = this.enemies.filter(e => !e.isDead && !e.reached);

    // 모든 적 이동 업데이트
    for (const enemy of this.enemies) {
      enemy.update(delta, camera);
    }

    // ── 웨이브 사이 대기 중 ──
    if (this.betweenWaves) {
      this.betweenTimer -= delta;
      if (this.betweenTimer <= 0) {
        // 다음 웨이브 시작
        this.betweenWaves  = false;
        this.waveCleared   = false;
        this.spawnedCount  = 0;
        this.spawnTimer    = 0;
        console.log(`[Spawner] 웨이브 ${this.currentWave} 시작!`);
        if (this.onWaveChange) this.onWaveChange(this.currentWave);
      }
      return;
    }

    // ── 이번 웨이브 소환 완료 확인 ──
    if (!this.waveCleared && this.spawnedCount >= this.currentConfig.count) {
      this.waveCleared = true;
    }

    // ── 웨이브 클리어 확인 (소환 완료 + 적 전멸) ──
    if (this.waveCleared && this.enemies.length === 0) {
      if (this.waveIndex < WAVE_CONFIG.length - 1) {
        // 다음 웨이브로
        this.waveIndex++;
        this.betweenWaves  = true;
        this.betweenTimer  = this.BETWEEN_WAIT;
        console.log(`[Spawner] 웨이브 클리어! ${this.BETWEEN_WAIT}초 후 웨이브 ${this.currentWave} 시작`);
        if (this.onWaveChange) this.onWaveChange('clear');
      } else {
        // 마지막 웨이브 클리어 → 게임 승리
        if (this.onWaveChange) this.onWaveChange('allClear');
        this.active = false;
      }
      return;
    }

    // ── 소환 타이머 ──
    if (!this.waveCleared) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.currentConfig.interval;
        this._spawnEnemy();
      }
    }
  }

  _spawnEnemy() {
    const cfg   = this.currentConfig;
    const enemy = new Enemy(
      this.scene,
      this.onReachCastle,
      this.onDied,
      { hp: cfg.hp, speed: cfg.speed, damage: cfg.damage, wave: this.waveIndex }
    );
    this.enemies.push(enemy);
    this.spawnedCount++;
    console.log(`[Spawner] 웨이브${this.currentWave} 소환 ${this.spawnedCount}/${cfg.count}`);
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
