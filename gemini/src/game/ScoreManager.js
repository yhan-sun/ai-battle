export class ScoreManager {
  constructor(onFeverReadyCallback) {
    this.onFeverReady = onFeverReadyCallback;

    // Run-time scores
    this.distance = 0;           // Meters
    this.performanceScore = 0;   // 表现分
    this.coins = 0;              // Total coins collected this run
    this.feverEnergy = 0;        // 0 to 100%
    this.stompCombo = 0;
    this.stompResetTimer = null;

    // Local Storage saved data
    this.highScore = 0;
    this.bestDistance = 0;
    this.totalBankCoins = 0;

    this.loadSavedData();
  }

  loadSavedData() {
    try {
      this.highScore = parseInt(localStorage.getItem('cyber_dash_high_score') || '0', 10);
      this.bestDistance = parseInt(localStorage.getItem('cyber_dash_best_dist') || '0', 10);
      this.totalBankCoins = parseInt(localStorage.getItem('cyber_dash_total_coins') || '0', 10);
    } catch (e) {
      console.warn('LocalStorage unavailable', e);
    }
  }

  saveData() {
    try {
      if (this.getTotalScore() > this.highScore) {
        this.highScore = this.getTotalScore();
        localStorage.setItem('cyber_dash_high_score', this.highScore.toString());
      }
      if (this.distance > this.bestDistance) {
        this.bestDistance = this.distance;
        localStorage.setItem('cyber_dash_best_dist', this.bestDistance.toString());
      }
      this.totalBankCoins += this.coins;
      localStorage.setItem('cyber_dash_total_coins', this.totalBankCoins.toString());
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }

  reset() {
    this.distance = 0;
    this.performanceScore = 0;
    this.coins = 0;
    this.feverEnergy = 0;
    this.stompCombo = 0;
  }

  updateDistance(playerX) {
    this.distance = Math.max(0, Math.floor(playerX));
  }

  addCoin(value, feverAmount = 1.0, multiplier = 1.0) {
    const points = Math.floor(value * multiplier);
    this.performanceScore += points;
    this.coins += 1;

    // Add to Fever gauge
    if (this.feverEnergy < 100) {
      this.feverEnergy = Math.min(100, this.feverEnergy + feverAmount);
      if (this.feverEnergy >= 100) {
        if (this.onFeverReady) this.onFeverReady();
      }
    }
  }

  addStompBonus(multiplier = 1.0) {
    this.stompCombo++;
    clearTimeout(this.stompResetTimer);
    this.stompResetTimer = setTimeout(() => {
      this.stompCombo = 0;
    }, 2500);

    const baseStompScore = 500 * this.stompCombo;
    const finalScore = Math.floor(baseStompScore * multiplier);
    this.performanceScore += finalScore;

    // Stomping gives generous fever energy
    if (this.feverEnergy < 100) {
      this.feverEnergy = Math.min(100, this.feverEnergy + 6.0);
      if (this.feverEnergy >= 100 && this.onFeverReady) {
        this.onFeverReady();
      }
    }
    return { combo: this.stompCombo, points: finalScore };
  }

  addSlideBonus(points = 100) {
    this.performanceScore += points;
  }

  consumeFeverEnergy() {
    this.feverEnergy = 0;
  }

  getTotalScore() {
    return Math.floor(this.distance * 100 + this.performanceScore * 1.5);
  }
}
