// ============================================================
//  api.js — 구글 앱스크립트와 통신하는 클라이언트 모듈
//  역할: 점수 저장 요청, 랭킹 조회 요청을 앱스크립트에 보냄
//
//  ✅ 사용 전 필수 설정:
//  아래 SCRIPT_URL 을 본인의 앱스크립트 배포 URL로 교체하세요!
// ============================================================

// ──────────────────────────────────────────
//  ⚠️ 여기에 본인의 앱스크립트 웹 앱 URL 입력
//  예: 'https://script.google.com/macros/s/AKfyc.../exec'
// ──────────────────────────────────────────
const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';

/**
 * GameAPI 클래스
 * 구글 앱스크립트 웹 앱과 HTTP로 통신
 */
class GameAPI {
  constructor() {
    // URL이 설정됐는지 확인
    this.isConfigured = SCRIPT_URL !== 'YOUR_APPS_SCRIPT_URL_HERE';

    if (!this.isConfigured) {
      console.warn('[GameAPI] ⚠️ SCRIPT_URL이 설정되지 않았습니다. api.js를 수정하세요.');
    } else {
      console.log('[GameAPI] ✅ API 연결 준비 완료');
    }
  }

  // ────────────────────────────────────────
  //  연결 테스트 (ping)
  // ────────────────────────────────────────
  async ping() {
    if (!this.isConfigured) return false;

    try {
      const url = `${SCRIPT_URL}?action=ping`;
      const res = await fetch(url);
      const data = await res.json();
      console.log('[GameAPI] ping 결과:', data);
      return data.success === true;
    } catch (err) {
      console.error('[GameAPI] ping 실패:', err);
      return false;
    }
  }

  // ────────────────────────────────────────
  //  점수 저장
  //  @param {string} nickname  - 플레이어 닉네임
  //  @param {number} score     - 최종 점수 (킬수 × 100 + 생존시간)
  //  @param {number} kills     - 처치 수
  //  @param {string} result    - '승리' or '패배'
  //  @param {number} time      - 생존 시간(초)
  //  @returns {Promise<{success, rank}>}
  // ────────────────────────────────────────
  async saveScore(nickname, score, kills, result, time) {
    // URL 미설정이면 로컬 저장으로 대체
    if (!this.isConfigured) {
      console.warn('[GameAPI] URL 미설정 → 로컬 저장으로 대체');
      return this._saveLocal(nickname, score, kills, result, time);
    }

    try {
      console.log('[GameAPI] 점수 저장 요청:', { nickname, score, kills, result, time });

      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        // ⚠️ 구글 앱스크립트는 CORS 이슈로 mode:'no-cors' 필요할 수 있음
        // no-cors 시 응답을 읽을 수 없으므로 text/plain 방식도 아래에 준비
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action:   'saveScore',
          nickname,
          score,
          kills,
          result,
          time,
        }),
      });

      const data = await res.json();
      console.log('[GameAPI] 저장 결과:', data);
      return data;

    } catch (err) {
      console.error('[GameAPI] 저장 실패:', err);
      // 실패 시 로컬 저장으로 폴백
      return this._saveLocal(nickname, score, kills, result, time);
    }
  }

  // ────────────────────────────────────────
  //  랭킹 조회
  //  @param {number} limit - 가져올 순위 수 (기본 10)
  //  @returns {Promise<Array>}
  // ────────────────────────────────────────
  async getRanking(limit = 10) {
    // URL 미설정이면 로컬 랭킹 반환
    if (!this.isConfigured) {
      console.warn('[GameAPI] URL 미설정 → 로컬 랭킹 반환');
      return this._getLocalRanking(limit);
    }

    try {
      const url = `${SCRIPT_URL}?action=getRanking&limit=${limit}`;
      console.log('[GameAPI] 랭킹 조회 요청:', url);

      const res  = await fetch(url);
      const data = await res.json();

      if (data.success) {
        console.log('[GameAPI] 랭킹 수신:', data.data.length, '개');
        return data.data;
      } else {
        console.error('[GameAPI] 랭킹 조회 실패:', data.error);
        return this._getLocalRanking(limit);
      }

    } catch (err) {
      console.error('[GameAPI] 랭킹 조회 에러:', err);
      return this._getLocalRanking(limit);
    }
  }

  // ────────────────────────────────────────
  //  로컬 폴백 — localStorage에 저장
  //  (앱스크립트 연결 전 또는 오프라인 시 사용)
  // ────────────────────────────────────────
  _saveLocal(nickname, score, kills, result, time) {
    try {
      const existing = JSON.parse(localStorage.getItem('td_ranking') || '[]');
      const entry = {
        rank:     0,        // 나중에 계산
        nickname,
        score,
        kills,
        result,
        time,
        date: new Date().toLocaleString('ko-KR'),
      };
      existing.push(entry);

      // 점수 내림차순 정렬
      existing.sort((a, b) => b.score - a.score);

      // 순위 재계산
      existing.forEach((e, i) => { e.rank = i + 1; });

      // 최대 50개만 유지
      const trimmed = existing.slice(0, 50);
      localStorage.setItem('td_ranking', JSON.stringify(trimmed));

      const myRank = trimmed.findIndex(
        e => e.nickname === nickname && e.score === score
      ) + 1;

      console.log('[GameAPI] 로컬 저장 완료. 내 순위:', myRank);
      return { success: true, rank: myRank };

    } catch (err) {
      console.error('[GameAPI] 로컬 저장 실패:', err);
      return { success: false, rank: -1 };
    }
  }

  _getLocalRanking(limit) {
    try {
      const data = JSON.parse(localStorage.getItem('td_ranking') || '[]');
      return data.slice(0, limit);
    } catch {
      return [];
    }
  }

  // ────────────────────────────────────────
  //  점수 계산 공식
  //  @param {number} kills     - 처치 수
  //  @param {number} timeLeft  - 남은 시간(초)
  //  @param {boolean} isWin    - 승리 여부
  // ────────────────────────────────────────
  static calcScore(kills, timeLeft, isWin) {
    const killBonus    = kills * 100;
    const surviveBonus = Math.floor(timeLeft) * 10;
    const winBonus     = isWin ? 5000 : 0;
    const total        = killBonus + surviveBonus + winBonus;

    console.log(`[GameAPI] 점수 계산: 처치(${killBonus}) + 생존(${surviveBonus}) + 승리(${winBonus}) = ${total}`);
    return total;
  }
}

// 전역 인스턴스 생성 (다른 파일에서 window.api 로 사용)
window.api = new GameAPI();
