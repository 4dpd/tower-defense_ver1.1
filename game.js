// ============================================================
//  game.js — 30스테이지 시스템
//  스테이지마다 적 HP/속도/소환간격이 점점 강해짐
//  10스테이지마다 보스 웨이브 (HP 3배)
// ============================================================

// ── 30스테이지 설정 자동 생성 함수 ──
function buildStageConfigs() {
  const configs = [];

  for (let s = 1; s <= 30; s++) {
    // 난이도 점진적 상승 공식
    const progress   = (s - 1) / 29;          // 0.0 ~ 1.0
    const isBoss     = s % 10 === 0;           // 10, 20, 30스테이지는 보스

    // 소환 간격: 3.5초(1스테이지) → 1.2초(30스테이지)
    const spawnRate  = Math.max(1.2, 3.5 - progress * 2.3);

    // 적 HP: 50(1스테이지) → 400(30스테이지), 보스는 3배
    const baseHp     = Math.floor(50 + progress * 350);
    const enemyHp    = isBoss ? baseHp * 3 : baseHp;

    // 적 속도: 4.0(1스테이지) → 7.5(30스테이지)
    const enemySpeed = parseFloat((4.0 + progress * 3.5).toFixed(1));

    // 스테이지 시간: 1~9스테이지 90초, 10스테이지마다 120초(보스)
    const duration   = isBoss ? 120 : 90;

    configs.push({
      stage:      s,
      duration,
      spawnRate:  parseFloat(spawnRate.toFixed(2)),
      enemyHp,
      enemySpeed,
      isBoss,
      title:      isBoss ? `⚠ BOSS WAVE ${s}` : `STAGE ${s}`,
      desc:       isBoss
        ? `강력한 보스 좀비 출현! HP ${enemyHp}`
        : `적 HP ${enemyHp} | 속도 ${enemySpeed}`,
    });
  }

  return configs;
}

// 전역 스테이지 설정 배열 (30개)
const STAGE_CONFIG = buildStageConfigs();

// ============================================================
//  GameManager
// ============================================================
class GameManager {
  constructor(scene, camera, renderer) {
    this.scene    = scene;
    this.camera   = camera;
    this.renderer = renderer;

    // ── 스테이지 상태 ──
    this.currentStageIdx = 0;
    this.MAX_STAGES      = STAGE_CONFIG.length; // 30

    // ── 게임 상태 ──
    this.MAX_CASTLE_HP = 100;
    this.castleHp      = this.MAX_CASTLE_HP;
    this.timeLeft      = STAGE_CONFIG[0].duration;
    this.killCount     = 0;      // 현재 스테이지 처치 수
    this.totalKills    = 0;      // 전체 누적 처치 수
    this.isGameOver    = false;
    this.isStageClear  = false;
    this.finalScore    = 0;

    // ── UI 요소 ──
    this.elCastleHpValue   = document.getElementById('castle-hp-value');
    this.elCastleHpBar     = document.getElementById('castle-hp-bar');
    this.elTimerDisplay    = document.getElementById('timer-display');
    this.elKillCount       = document.getElementById('kill-count');
    this.elStageDisplay    = document.getElementById('stage-display');
    this.elOverlay         = document.getElementById('overlay');
    this.elOverlayTitle    = document.getElementById('overlay-title');
    this.elOverlaySub      = document.getElementById('overlay-sub');
    this.elOverlayScore    = document.getElementById('overlay-score');
    this.elOverlayRank     = document.getElementById('overlay-rank');
    this.elRankingList     = document.getElementById('ranking-list');
    this.elWaveBanner      = document.getElementById('wave-banner');
    this.elApiStatus       = document.getElementById('api-status');
    this.elStageClearBanner= document.getElementById('stage-clear-banner');

    this.mapObjects = [];

    // ── 서브 시스템 초기화 ──
    this._buildMap();
    this._buildCastle();
    this._buildLights();
    this.player   = new Player(scene);
    this.towerMgr = new TowerManager(scene, camera, renderer);
    this.spawner  = this._createSpawner();

    this._checkApiStatus();
    this._updateStageUI();
    this._showWaveBanner(this.stageConfig.title, this.stageConfig.desc);

    console.log('[GameManager] 게임 시작! 총 스테이지:', this.MAX_STAGES);
    console.log('[GameManager] 스테이지 설정 미리보기:',
      STAGE_CONFIG.map(c => `S${c.stage}(HP:${c.enemyHp} 속:${c.enemySpeed})`).join(', ')
    );
  }

  // ── 현재 스테이지 설정 ──
  get stageConfig() {
    return STAGE_CONFIG[this.currentStageIdx];
  }

  // ── 스폰너 생성 ──
  _createSpawner() {
    const cfg = this.stageConfig;
    return new EnemySpawner(
      this.scene,
      (dmg) => this._onEnemyReachedCastle(dmg),
      ()    => this._onEnemyKilled(),
      cfg.spawnRate,
      cfg.enemyHp,
      cfg.enemySpeed,
    );
  }

  // ── 스테이지 HUD 업데이트 ──
  _updateStageUI() {
    if (this.elStageDisplay) {
      const cfg = this.stageConfig;
      // 보스 스테이지는 빨간색
      this.elStageDisplay.textContent = cfg.title;
      this.elStageDisplay.style.color = cfg.isBoss ? '#ff4444' : '#ffe08a';
    }
    this.killCount = 0;
    this.elKillCount.textContent = '0';
    this.elTimerDisplay.classList.remove('danger');
    this.elTimerDisplay.style.color = '';
  }

  // ────────────────────────────────────────
  //  스테이지 클리어 → 다음 스테이지
  // ────────────────────────────────────────
  async _stageClear() {
    if (this.isStageClear || this.isGameOver) return;
    this.isStageClear = true;

    const clearedStage = this.stageConfig.stage;
    console.log(`[GameManager] 스테이지 ${clearedStage} 클리어!`);

    // ── 30스테이지 클리어 = 최종 승리 ──
    if (this.currentStageIdx >= this.MAX_STAGES - 1) {
      this._endGame(true);
      return;
    }

    // ── 스테이지 클리어 배너 표시 ──
    this._showStageClearBanner(clearedStage);

    // 스폰 중지
    this.spawner.active = false;

    // 5초 대기
    await this._wait(5000);

    // 다음 스테이지로 전환
    this.currentStageIdx++;
    this.timeLeft     = this.stageConfig.duration;
    this.isStageClear = false;

    // 기존 적 모두 제거
    this.spawner.clearAll();

    // 새 스폰너 (더 강한 적)
    this.spawner = this._createSpawner();

    // 타워 유지, 구역 카운트만 리셋
    this.towerMgr.resetZones();

    this._updateStageUI();
    this._showWaveBanner(this.stageConfig.title, this.stageConfig.desc);

    console.log(`[GameManager] 스테이지 ${this.stageConfig.stage} 시작! HP:${this.stageConfig.enemyHp} 속도:${this.stageConfig.enemySpeed}`);
  }

  // ── 스테이지 클리어 배너 ──
  _showStageClearBanner(stageNum) {
    if (!this.elStageClearBanner) return;
    const isBoss = stageNum % 10 === 0;
    this.elStageClearBanner.innerHTML = isBoss
      ? `🎉 BOSS WAVE ${stageNum} 클리어! &nbsp;|&nbsp; 다음 스테이지까지 5초...`
      : `✨ STAGE ${stageNum} 클리어! &nbsp;|&nbsp; 다음 스테이지까지 5초...`;
    this.elStageClearBanner.classList.add('show');
    setTimeout(() => this.elStageClearBanner.classList.remove('show'), 4800);
  }

  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ────────────────────────────────────────
  //  맵 생성
  // ────────────────────────────────────────
  _buildMap() {
    // 잔디 바닥
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshLambertMaterial({ color: 0x3a6e2a })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);
    this.mapObjects.push(grass);

    // 경로
    const pathMat = new THREE.MeshLambertMaterial({ color: 0xb8a070 });
    for (const p of [
      { x: -16, z:  0,  w: 14, d: 3 },
      { x: -10, z:  5,  w:  3, d: 10 },
      { x:   0, z: 10,  w: 23, d: 3 },
      { x:  10, z:  0,  w:  3, d: 23 },
      { x:  16, z: -10, w: 14, d: 3 },
    ]) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), pathMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x, 0.02, p.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.mapObjects.push(mesh);
    }

    this._plantTrees();
  }

  _plantTrees() {
    const pos = [
      [-18,-8],[-15,-12],[-5,-15],[5,-15],[18,5],
      [-18,8],[-8,15],[8,15],[20,5],[-20,-5],[0,-18],[0,18],
    ];
    for (const [x, z] of pos) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6),
        new THREE.MeshLambertMaterial({ color: 0x6b4226 })
      );
      trunk.position.set(x, 0.75, z);
      trunk.castShadow = true;
      this.scene.add(trunk);
      this.mapObjects.push(trunk);

      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1.0, 2.0, 7),
        new THREE.MeshLambertMaterial({ color: 0x2d7a2d })
      );
      leaves.position.set(x, 2.5, z);
      leaves.castShadow = true;
      this.scene.add(leaves);
      this.mapObjects.push(leaves);
    }
  }

  _buildCastle() {
    const group = new THREE.Group();
    const body  = new THREE.Mesh(
      new THREE.BoxGeometry(4, 5, 4),
      new THREE.MeshLambertMaterial({ color: 0xccbbaa })
    );
    body.position.y = 2.5;
    body.castShadow = true;
    group.add(body);

    for (const [tx, tz] of [[-2,-2],[2,-2],[-2,2],[2,2]]) {
      const t = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 6, 8),
        new THREE.MeshLambertMaterial({ color: 0xbbaaaa })
      );
      t.position.set(tx, 3, tz);
      t.castShadow = true;
      group.add(t);
    }
    group.position.set(22, 0, -10);
    this.scene.add(group);
    this.castleMesh = group;
    this.mapObjects.push(group);
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.1);
    sun.position.set(15, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left   = -35; sun.shadow.camera.right  = 35;
    sun.shadow.camera.bottom = -35; sun.shadow.camera.top    = 35;
    sun.shadow.camera.far    = 80;
    this.scene.add(sun);
  }

  // ────────────────────────────────────────
  //  콜백
  // ────────────────────────────────────────
  _onEnemyReachedCastle(damage) {
    if (this.isGameOver) return;
    this.castleHp = Math.max(0, this.castleHp - damage);
    console.log(`[GameManager] 성 피격 -${damage} → 남은: ${this.castleHp}`);
    this._shakeCastle();
    this._updateHpUI();
    if (this.castleHp <= 0) this._endGame(false);
  }

  _onEnemyKilled() {
    this.killCount++;
    this.totalKills++;
    this.elKillCount.textContent = this.killCount;
  }

  _shakeCastle() {
    const orig = this.castleMesh.position.x;
    let count  = 0;
    const iv   = setInterval(() => {
      this.castleMesh.position.x = orig + (count % 2 === 0 ? 0.3 : -0.3);
      if (++count > 6) { this.castleMesh.position.x = orig; clearInterval(iv); }
    }, 60);
  }

  _updateHpUI() {
    this.elCastleHpValue.textContent = this.castleHp;
    const ratio = this.castleHp / this.MAX_CASTLE_HP;
    this.elCastleHpBar.style.width = (ratio * 100) + '%';
    if (ratio <= 0.3) {
      this.elCastleHpBar.style.background = 'linear-gradient(90deg,#ff1111,#ff4400)';
    } else if (ratio <= 0.6) {
      this.elCastleHpBar.style.background = 'linear-gradient(90deg,#ff8800,#ffcc00)';
    }
  }

  _showWaveBanner(title, sub) {
    this.elWaveBanner.innerHTML =
      `<span style="font-size:17px;font-weight:bold">${title}</span>` +
      `<br><span style="font-size:11px;opacity:0.7">${sub}</span>`;
    this.elWaveBanner.classList.add('show');
    setTimeout(() => this.elWaveBanner.classList.remove('show'), 3200);
  }

  // ────────────────────────────────────────
  //  게임 종료
  // ────────────────────────────────────────
  async _endGame(isWin) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.spawner.active = false;

    const survivedTime  = this.stageConfig.duration - Math.max(0, this.timeLeft);
    this.finalScore     = GameAPI.calcScore(this.totalKills, this.timeLeft, isWin);

    if (isWin) {
      this.elOverlayTitle.textContent = '🏆 전설의 수호자!';
      this.elOverlayTitle.className   = 'win';
      this.elOverlaySub.textContent   = `30스테이지 완전 클리어! 총 처치: ${this.totalKills}`;
    } else {
      this.elOverlayTitle.textContent = '💀 패배';
      this.elOverlayTitle.className   = 'lose';
      this.elOverlaySub.textContent   =
        `스테이지 ${this.stageConfig.stage}에서 함락 | 총 처치: ${this.totalKills}`;
    }

    this.elOverlayScore.textContent = `${this.finalScore.toLocaleString()} 점`;
    this.elOverlay.classList.add('visible');

    const nickname = window.playerNickname || '익명의 용사';
    await this.loadAndShowRanking(nickname, {
      score:  this.finalScore,
      kills:  this.totalKills,
      result: isWin ? '승리' : `${this.stageConfig.stage}스테이지 패배`,
      time:   Math.floor(survivedTime),
    });
  }

  // ── 랭킹 저장/표시 ──
  async loadAndShowRanking(nickname, scoreData) {
    this.elRankingList.innerHTML = '<div id="ranking-loading">랭킹 불러오는 중...</div>';
    this.elOverlayRank.textContent = '전체 순위: 집계 중...';
    let myRank = null;
    try {
      if (scoreData && window.api) {
        const r = await window.api.saveScore(
          nickname, scoreData.score, scoreData.kills, scoreData.result, scoreData.time
        );
        myRank = r?.rank ?? null;
      }
      const ranking = window.api ? await window.api.getRanking(10) : [];
      if (myRank !== null) this.elOverlayRank.textContent = `전체 순위: ${myRank}위`;
      this._renderRankingTable(ranking, nickname, scoreData?.score ?? null);
    } catch (err) {
      console.error('[GameManager] 랭킹 오류:', err);
      this.elRankingList.innerHTML = '<div id="ranking-loading">랭킹을 불러올 수 없습니다</div>';
    }
  }

  _renderRankingTable(ranking, myNickname, myScore) {
    if (!ranking || ranking.length === 0) {
      this.elRankingList.innerHTML = '<div id="ranking-loading">아직 기록이 없습니다</div>';
      return;
    }
    const rows = ranking.map((entry, idx) => {
      const isMe      = entry.nickname === myNickname && entry.score === myScore;
      const topClass  = idx < 3 ? 'top' : '';
      const meClass   = isMe ? 'me' : '';
      const resultCls = entry.result?.includes('승리') ? 'win' : 'lose';
      const medal     = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}`;
      return `
        <div class="rank-row ${meClass}">
          <span class="rank-num ${topClass}">${medal}</span>
          <span class="rank-name">${isMe ? '▶ ' : ''}${entry.nickname}</span>
          <span class="rank-score">${Number(entry.score).toLocaleString()}</span>
          <span class="rank-badge ${resultCls}">${entry.result}</span>
        </div>`;
    });
    this.elRankingList.innerHTML = rows.join('');
  }

  async _checkApiStatus() {
    if (!window.api) return;
    if (window.api.isConfigured) {
      this.elApiStatus.textContent = '● 서버 확인 중...';
      const ok = await window.api.ping();
      this.elApiStatus.textContent = ok ? '● 구글 시트 연결됨' : '● 서버 오류 (로컬 모드)';
      this.elApiStatus.className   = ok ? 'connected' : 'local';
    } else {
      this.elApiStatus.textContent = '● 로컬 저장 모드';
      this.elApiStatus.className   = 'local';
    }
  }

  // ────────────────────────────────────────
  //  매 프레임 업데이트
  // ────────────────────────────────────────
  update(delta) {
    if (this.isGameOver || this.isStageClear) return;

    // 타이머
    this.timeLeft -= delta;
    const t    = Math.max(0, this.timeLeft);
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    this.elTimerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    if (t <= 20) this.elTimerDisplay.classList.add('danger');

    // 시간 초과 → 스테이지 클리어
    if (this.timeLeft <= 0) {
      this._stageClear();
      return;
    }

    this.player.update(delta);
    this.spawner.update(delta, this.camera);
    this.towerMgr.update(delta, this.spawner.getAliveEnemies());
  }

  // ────────────────────────────────────────
  //  재시작
  // ────────────────────────────────────────
  restart() {
    this.player.destroy();
    this.spawner.clearAll();
    this.towerMgr.clearAll();
    for (const obj of this.mapObjects) this.scene.remove(obj);
    this.mapObjects = [];

    this.elOverlay.classList.remove('visible');
    this.elTimerDisplay.classList.remove('danger');
    this.elCastleHpBar.style.width = '100%';
    this.elCastleHpBar.style.background = '';

    this.currentStageIdx = 0;
    this.castleHp        = this.MAX_CASTLE_HP;
    this.timeLeft        = STAGE_CONFIG[0].duration;
    this.killCount       = 0;
    this.totalKills      = 0;
    this.isGameOver      = false;
    this.isStageClear    = false;
    this.finalScore      = 0;

    this._updateHpUI();

    this._buildMap();
    this._buildCastle();
    this._buildLights();
    this.player   = new Player(this.scene);
    this.towerMgr = new TowerManager(this.scene, this.camera, this.renderer);
    this.spawner  = this._createSpawner();

    this._updateStageUI();
    this._showWaveBanner(STAGE_CONFIG[0].title, STAGE_CONFIG[0].desc);
    console.log('[GameManager] 재시작 완료');
  }
}

window.gameRestart = function () {
  if (window._gameManager) window._gameManager.restart();
};
