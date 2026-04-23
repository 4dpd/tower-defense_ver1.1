// ============================================================
//  game.js — 게임 전체 상태 관리 (웨이브 시스템 포함)
//  ✅ 변경사항:
//    - 타이머 제거 → 웨이브 3개 클리어 시 승리
//    - 웨이브 진행 UI 추가
//    - 난이도 상승 반영
// ============================================================

class GameManager {
  constructor(scene, camera, renderer) {
    this.scene    = scene;
    this.camera   = camera;
    this.renderer = renderer;

    this.MAX_CASTLE_HP = 100;

    // 게임 상태
    this.castleHp   = this.MAX_CASTLE_HP;
    this.killCount  = 0;
    this.isGameOver = false;
    this.isWin      = false;
    this.finalScore = 0;
    this.gameTime   = 0;  // 경과 시간

    // UI 요소
    this.elCastleHpValue = document.getElementById('castle-hp-value');
    this.elCastleHpBar   = document.getElementById('castle-hp-bar');
    this.elTimerDisplay  = document.getElementById('timer-display');
    this.elKillCount     = document.getElementById('kill-count');
    this.elOverlay       = document.getElementById('overlay');
    this.elOverlayTitle  = document.getElementById('overlay-title');
    this.elOverlaySub    = document.getElementById('overlay-sub');
    this.elOverlayScore  = document.getElementById('overlay-score');
    this.elOverlayRank   = document.getElementById('overlay-rank');
    this.elRankingList   = document.getElementById('ranking-list');
    this.elWaveBanner    = document.getElementById('wave-banner');
    this.elApiStatus     = document.getElementById('api-status');

    this.mapObjects = [];

    // 서브 시스템 초기화
    this._buildMap();
    this._buildCastle();
    this._buildLights();

    this.player = new Player(scene);

    // 적 소환기 — 웨이브 변경 콜백 포함
    this.spawner = new EnemySpawner(
      scene,
      (dmg) => this._onEnemyReachedCastle(dmg),
      ()    => this._onEnemyKilled(),
      (waveEvent) => this._onWaveChange(waveEvent)
    );

    this.towerMgr = new TowerManager(scene, camera, renderer);

    this._checkApiStatus();
    this._updateWaveUI(1);
    this._showWaveBanner('⚔ 웨이브 1 시작! 좀비가 몰려온다!');

    console.log('[GameManager] 게임 시작! (웨이브 3개 클리어 시 승리)');
  }

  // ────────────────────────────────────────
  //  웨이브 이벤트 처리
  // ────────────────────────────────────────
  _onWaveChange(event) {
    if (event === 'clear') {
      // 웨이브 클리어 → 다음 웨이브 예고
      const nextWave = this.spawner.currentWave;
      this._showWaveBanner(`✅ 웨이브 클리어! ${this.spawner.BETWEEN_WAIT}초 후 웨이브 ${nextWave} 시작...`);
      this._updateWaveUI(nextWave);
      console.log(`[GameManager] 웨이브 클리어! 다음: ${nextWave}`);

    } else if (event === 'allClear') {
      // 전체 웨이브 클리어 → 승리
      console.log('[GameManager] 전체 웨이브 클리어! 승리!');
      this._endGame(true);

    } else if (typeof event === 'number') {
      // 새 웨이브 시작
      this._showWaveBanner(`🔥 웨이브 ${event} 시작!`);
      this._updateWaveUI(event);
    }
  }

  // 웨이브 UI 업데이트 (타이머 자리에 웨이브 표시)
  _updateWaveUI(wave) {
    const total = this.spawner?.totalWaves || 3;
    this.elTimerDisplay.textContent = `${wave} / ${total}`;
  }

  // ────────────────────────────────────────
  //  API 상태 확인
  // ────────────────────────────────────────
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
    const paths = [
      { x: -16, z:  0,  w: 14, d: 3 },
      { x: -10, z:  5,  w:  3, d: 10 },
      { x:   0, z: 10,  w: 23, d: 3 },
      { x:  10, z:  0,  w:  3, d: 23 },
      { x:  16, z: -10, w: 14, d: 3 },
    ];
    for (const p of paths) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), pathMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x, 0.02, p.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.mapObjects.push(mesh);
    }

    this._plantTrees();
    console.log('[GameManager] 맵 생성 완료');
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
    sun.shadow.camera.left = sun.shadow.camera.bottom = -35;
    sun.shadow.camera.right = sun.shadow.camera.top   =  35;
    sun.shadow.camera.far   = 80;
    this.scene.add(sun);
  }

  // ────────────────────────────────────────
  //  성 피격
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

  _showWaveBanner(text) {
    this.elWaveBanner.textContent = text;
    this.elWaveBanner.classList.add('show');
    setTimeout(() => this.elWaveBanner.classList.remove('show'), 3000);
  }

  // ────────────────────────────────────────
  //  게임 종료
  // ────────────────────────────────────────
  async _endGame(isWin) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isWin      = isWin;
    this.spawner.active = false;

    this.finalScore = GameAPI.calcScore(this.killCount, 0, isWin);

    if (isWin) {
      this.elOverlayTitle.textContent = '🏆 승리!';
      this.elOverlayTitle.className   = 'win';
      this.elOverlaySub.textContent   = `웨이브 3개 완료! 처치: ${this.killCount}`;
    } else {
      this.elOverlayTitle.textContent = '💀 패배';
      this.elOverlayTitle.className   = 'lose';
      this.elOverlaySub.textContent   = `성이 함락되었습니다. 처치: ${this.killCount}`;
    }

    this.elOverlayScore.textContent = `${this.finalScore.toLocaleString()} 점`;
    this.elOverlay.classList.add('visible');

    const nickname = window.playerNickname || '익명의 용사';
    await this.loadAndShowRanking(nickname, {
      score:  this.finalScore,
      kills:  this.killCount,
      result: isWin ? '승리' : '패배',
      time:   Math.floor(this.gameTime),
    });
  }

  // ────────────────────────────────────────
  //  랭킹 로드 + 표시
  // ────────────────────────────────────────
  async loadAndShowRanking(nickname, scoreData) {
    this.elRankingList.innerHTML = '<div id="ranking-loading">랭킹 불러오는 중...</div>';
    this.elOverlayRank.textContent = '전체 순위: 집계 중...';

    let myRank = null;
    try {
      if (scoreData && window.api) {
        const res = await window.api.saveScore(
          nickname, scoreData.score, scoreData.kills, scoreData.result, scoreData.time
        );
        myRank = res?.rank ?? null;
      }
      const ranking = window.api ? await window.api.getRanking(10) : [];
      if (myRank !== null) this.elOverlayRank.textContent = `전체 순위: ${myRank}위`;
      this._renderRankingTable(ranking, nickname, scoreData?.score ?? null);
    } catch (err) {
      console.error('[GameManager] 랭킹 처리 실패:', err);
      this.elRankingList.innerHTML = '<div id="ranking-loading">랭킹을 불러올 수 없습니다</div>';
    }
  }

  _renderRankingTable(ranking, myNickname, myScore) {
    if (!ranking || ranking.length === 0) {
      this.elRankingList.innerHTML = '<div id="ranking-loading">아직 기록이 없습니다</div>';
      return;
    }
    const rows = ranking.map((e, i) => {
      const isMe     = e.nickname === myNickname && e.score === myScore;
      const medal    = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`;
      const resCls   = e.result === '승리' ? 'win' : 'lose';
      return `<div class="rank-row ${isMe ? 'me' : ''}">
        <span class="rank-num ${i < 3 ? 'top' : ''}">${medal}</span>
        <span class="rank-name">${isMe ? '▶ ' : ''}${e.nickname}</span>
        <span class="rank-score">${Number(e.score).toLocaleString()}</span>
        <span class="rank-badge ${resCls}">${e.result}</span>
      </div>`;
    });
    this.elRankingList.innerHTML = rows.join('');
  }

  // ────────────────────────────────────────
  //  매 프레임 업데이트
  // ────────────────────────────────────────
  update(delta) {
    if (this.isGameOver) return;

    this.gameTime += delta;

    // 웨이브 UI는 spawner에서 콜백으로 업데이트
    // (타이머 대신 웨이브 진행 표시)

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
    this.elCastleHpBar.style.width = '100%';
    this.elCastleHpBar.style.background = '';

    this.castleHp   = this.MAX_CASTLE_HP;
    this.killCount  = 0;
    this.isGameOver = false;
    this.isWin      = false;
    this.finalScore = 0;
    this.gameTime   = 0;

    this._updateHpUI();
    this.elKillCount.textContent = '0';

    this._buildMap();
    this._buildCastle();
    this._buildLights();

    this.player = new Player(this.scene);
    this.spawner = new EnemySpawner(
      this.scene,
      (dmg)       => this._onEnemyReachedCastle(dmg),
      ()          => this._onEnemyKilled(),
      (waveEvent) => this._onWaveChange(waveEvent)
    );
    this.spawner.active  = true;
    this.towerMgr.active = true;

    this._updateWaveUI(1);
    this._showWaveBanner('⚔ 웨이브 1 시작!');
    console.log('[GameManager] 재시작 완료');
  }
}

window.gameRestart = function () {
  if (window._gameManager) window._gameManager.restart();
};
