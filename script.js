(() => {
  const COMPARISON_WATTS = [200, 500, 600, 650, 1000, 1500];

  const sourceWattEl = document.getElementById("source-watt");
  const targetWattEl = document.getElementById("target-watt");
  const sourceMinEl = document.getElementById("source-min");
  const sourceSecEl = document.getElementById("source-sec");

  const resMinEl = document.getElementById("res-min");
  const resSecEl = document.getElementById("res-sec");
  const resultBadgeEl = document.getElementById("result-summary-badge");
  const resultRoundedEl = document.getElementById("result-rounded");
  const formulaTextEl = document.getElementById("formula-text");
  const comparisonGridEl = document.getElementById("comparison-grid");

  const swapBtn = document.getElementById("swap-btn");
  const resetTimeBtn = document.getElementById("reset-time-btn");

  // Timer elements
  const timerDisplayEl = document.getElementById("timer-display");
  const timerProgressEl = document.getElementById("timer-progress");
  const timerStartBtn = document.getElementById("timer-start-btn");
  const timerResetBtn = document.getElementById("timer-reset-btn");

  let calculatedTotalSeconds = 150;
  let timerTotalSeconds = 150;
  let timerRemainingSeconds = 150;
  let timerIntervalId = null;
  let timerEndTimestamp = null;

  function clampInt(value, min, max, fallback = 0) {
    const num = Number.parseInt(value, 10);
    if (Number.isNaN(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function formatMinSec(totalSeconds) {
    const safe = Math.max(0, Math.round(totalSeconds));
    const min = Math.floor(safe / 60);
    const sec = safe % 60;
    return { min, sec };
  }

  function formatJpTime(totalSeconds) {
    const { min, sec } = formatMinSec(totalSeconds);
    if (min === 0) return `${sec}秒`;
    if (sec === 0) return `${min}分`;
    return `${min}分${String(sec).padStart(2, "0")}秒`;
  }

  function formatClock(totalSeconds) {
    const safe = Math.max(0, Math.ceil(totalSeconds));
    const min = Math.floor(safe / 60);
    const sec = safe % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function syncPresetButtons(inputId, currentValue) {
    const group = document.querySelector(`.preset-row[data-target="${inputId}"]`);
    if (!group) return;
    group.querySelectorAll(".preset-btn").forEach((btn) => {
      const val = Number(btn.dataset.value);
      btn.classList.toggle("active", val === currentValue);
    });
  }

  function calculate() {
    const sourceWatt = clampInt(sourceWattEl.value, 1, 5000, 0);
    const targetWatt = clampInt(targetWattEl.value, 1, 5000, 0);
    const sourceMin = clampInt(sourceMinEl.value, 0, 180, 0);
    const sourceSec = clampInt(sourceSecEl.value, 0, 3600, 0);

    syncPresetButtons("source-watt", sourceWatt);
    syncPresetButtons("target-watt", targetWatt);

    const sourceTotalSec = sourceMin * 60 + sourceSec;

    if (sourceWatt <= 0 || targetWatt <= 0) {
      resMinEl.textContent = "-";
      resSecEl.textContent = "--";
      resultBadgeEl.textContent = "ワット数を1以上で入力";
      resultRoundedEl.innerHTML = "目安 <strong>--</strong>";
      formulaTextEl.textContent = "計算できません";
      comparisonGridEl.innerHTML = "";
      return;
    }

    const exactSeconds = (sourceTotalSec * sourceWatt) / targetWatt;
    const roundedSeconds = Math.round(exactSeconds);
    const rounded10Sec = Math.round(exactSeconds / 10) * 10;

    const { min, sec } = formatMinSec(roundedSeconds);
    resMinEl.textContent = String(min);
    resSecEl.textContent = String(sec).padStart(2, "0");

    const normalizedSource = formatMinSec(sourceTotalSec);
    const sourceLabel = `${normalizedSource.min}分${String(normalizedSource.sec).padStart(2, "0")}秒`;
    resultBadgeEl.textContent = `${sourceWatt}W ${sourceLabel} → ${targetWatt}W`;

    resultRoundedEl.innerHTML = `目安 <strong>${formatJpTime(rounded10Sec)}</strong>`;
    formulaTextEl.textContent = `${sourceTotalSec}秒 × (${sourceWatt}W ÷ ${targetWatt}W) = ${exactSeconds.toFixed(1)}秒`;

    calculatedTotalSeconds = roundedSeconds;
    if (!timerIntervalId) {
      resetTimerToCalculated();
    }

    renderComparison(sourceWatt, sourceTotalSec, targetWatt);
  }

  function renderComparison(sourceWatt, sourceTotalSec, currentTargetWatt) {
    const watts = [...COMPARISON_WATTS];
    if (!watts.includes(currentTargetWatt)) {
      watts.push(currentTargetWatt);
      watts.sort((a, b) => a - b);
    }

    comparisonGridEl.innerHTML = "";
    watts.forEach((w) => {
      const sec = Math.round((sourceTotalSec * sourceWatt) / w);
      const item = document.createElement("button");
      item.type = "button";
      item.className = "quick-item" + (w === currentTargetWatt ? " is-target" : "");
      item.innerHTML = `
        <span class="quick-watt">${w}W</span>
        <span class="quick-time">${formatJpTime(sec)}</span>
      `;
      item.addEventListener("click", () => {
        targetWattEl.value = String(w);
        calculate();
      });
      comparisonGridEl.appendChild(item);
    });
  }

  // Timer logic
  function updateTimerUI() {
    timerDisplayEl.textContent = formatClock(timerRemainingSeconds);
    const ratio =
      timerTotalSeconds > 0
        ? Math.min(100, Math.max(0, ((timerTotalSeconds - timerRemainingSeconds) / timerTotalSeconds) * 100))
        : 0;
    timerProgressEl.style.width = `${ratio}%`;
  }

  function resetTimerToCalculated() {
    stopTimerInterval();
    timerTotalSeconds = calculatedTotalSeconds;
    timerRemainingSeconds = calculatedTotalSeconds;
    timerDisplayEl.classList.remove("finished");
    timerStartBtn.textContent = "スタート";
    timerStartBtn.classList.remove("running");
    updateTimerUI();
  }

  function stopTimerInterval() {
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    timerEndTimestamp = null;
  }

  function playBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [0, 0.25, 0.5].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now + offset);
        gain.gain.setValueAtTime(0.18, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.2);
      });
    } catch {
      // Audio playback blocked or unavailable
    }
  }

  function toggleTimer() {
    if (timerIntervalId) {
      // Pause
      stopTimerInterval();
      timerStartBtn.textContent = "再開";
      timerStartBtn.classList.remove("running");
      return;
    }

    if (timerRemainingSeconds <= 0) {
      timerTotalSeconds = calculatedTotalSeconds;
      timerRemainingSeconds = calculatedTotalSeconds;
    }
    if (timerRemainingSeconds <= 0) return;

    timerDisplayEl.classList.remove("finished");
    timerEndTimestamp = Date.now() + timerRemainingSeconds * 1000;
    timerStartBtn.textContent = "一時停止";
    timerStartBtn.classList.add("running");

    timerIntervalId = setInterval(() => {
      const diff = (timerEndTimestamp - Date.now()) / 1000;
      if (diff <= 0) {
        timerRemainingSeconds = 0;
        stopTimerInterval();
        updateTimerUI();
        timerDisplayEl.classList.add("finished");
        timerStartBtn.textContent = "もう一度";
        timerStartBtn.classList.remove("running");
        playBeep();
      } else {
        timerRemainingSeconds = diff;
        updateTimerUI();
      }
    }, 100);
  }

  // Event bindings
  [sourceWattEl, targetWattEl, sourceMinEl, sourceSecEl].forEach((el) => {
    el.addEventListener("input", calculate);
  });

  sourceSecEl.addEventListener("blur", () => {
    let min = clampInt(sourceMinEl.value, 0, 180, 0);
    let sec = clampInt(sourceSecEl.value, 0, 999, 0);
    if (sec >= 60) {
      min += Math.floor(sec / 60);
      sec = sec % 60;
      sourceMinEl.value = String(Math.min(180, min));
      sourceSecEl.value = String(sec);
      calculate();
    }
  });

  document.querySelectorAll(".preset-row").forEach((group) => {
    const targetInput = document.getElementById(group.dataset.target);
    group.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        targetInput.value = btn.dataset.value;
        calculate();
      });
    });
  });

  document.querySelectorAll(".step-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.adjust;
      const delta = Number(btn.dataset.delta);
      let min = clampInt(sourceMinEl.value, 0, 180, 0);
      let sec = clampInt(sourceSecEl.value, 0, 59, 0);

      if (kind === "min") {
        min = Math.min(180, Math.max(0, min + delta));
      } else {
        const total = Math.max(0, min * 60 + sec + delta);
        min = Math.min(180, Math.floor(total / 60));
        sec = total % 60;
      }
      sourceMinEl.value = String(min);
      sourceSecEl.value = String(sec);
      calculate();
    });
  });

  document.querySelectorAll(".chip-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sourceMinEl.value = btn.dataset.min;
      sourceSecEl.value = btn.dataset.sec;
      calculate();
    });
  });

  swapBtn.addEventListener("click", () => {
    const tmp = sourceWattEl.value;
    sourceWattEl.value = targetWattEl.value;
    targetWattEl.value = tmp;
    calculate();
  });

  resetTimeBtn.addEventListener("click", () => {
    sourceMinEl.value = "0";
    sourceSecEl.value = "0";
    calculate();
  });

  timerStartBtn.addEventListener("click", toggleTimer);
  timerResetBtn.addEventListener("click", resetTimerToCalculated);

  // Initial calculation
  calculate();

  // PWA Install Banner & Guide Modal
  const installBannerEl = document.getElementById("install-banner");
  const installActionBtn = document.getElementById("install-action-btn");
  const installCloseBtn = document.getElementById("install-close-btn");
  const installModalEl = document.getElementById("install-modal");
  const installModalCloseBtn = document.getElementById("install-modal-close");
  const installModalOkBtn = document.getElementById("install-modal-ok");
  const installStepsEl = document.getElementById("install-steps");

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  let deferredInstallPrompt = null;
  let bannerDismissed = false;

  try {
    bannerDismissed = sessionStorage.getItem("installBannerDismissed") === "1";
  } catch {
    bannerDismissed = false;
  }

  function showBannerIfEligible() {
    if (isStandalone || bannerDismissed || !installBannerEl) return;
    installBannerEl.hidden = false;
  }

  function openInstallGuide() {
    if (!installModalEl || !installStepsEl) return;
    const steps = isIOS
      ? [
          "画面下部（または上部）の <strong>共有ボタン（□↑）</strong> をタップします。",
          "メニューを下にスクロールして <strong>「ホーム画面に追加」</strong> をタップします。",
          "右上の <strong>「追加」</strong> をタップすると、ホーム画面にアイコンが作成されます。"
        ]
      : [
          "ブラウザ右上の <strong>メニュー（⋮）</strong> をタップします。",
          "<strong>「アプリをインストール」</strong> または <strong>「ホーム画面に追加」</strong> を選択します。",
          "確認画面で <strong>「追加 / インストール」</strong> をタップして完了です。"
        ];
    installStepsEl.innerHTML = steps.map((s) => `<li><span>${s}</span></li>`).join("");
    installModalEl.hidden = false;
  }

  function closeInstallGuide() {
    if (installModalEl) installModalEl.hidden = true;
  }

  if (!isStandalone) {
    // Show banner immediately on mobile/browser unless dismissed
    showBannerIfEligible();

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      showBannerIfEligible();
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      if (installBannerEl) installBannerEl.hidden = true;
    });
  }

  if (installActionBtn) {
    installActionBtn.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice && choice.outcome === "accepted" && installBannerEl) {
          installBannerEl.hidden = true;
        }
      } else {
        openInstallGuide();
      }
    });
  }

  if (installCloseBtn) {
    installCloseBtn.addEventListener("click", () => {
      bannerDismissed = true;
      if (installBannerEl) installBannerEl.hidden = true;
      try {
        sessionStorage.setItem("installBannerDismissed", "1");
      } catch {
        // Ignore storage errors
      }
    });
  }

  if (installModalCloseBtn) installModalCloseBtn.addEventListener("click", closeInstallGuide);
  if (installModalOkBtn) installModalOkBtn.addEventListener("click", closeInstallGuide);
  if (installModalEl) {
    installModalEl.addEventListener("click", (e) => {
      if (e.target === installModalEl) closeInstallGuide();
    });
  }

  // Register Service Worker for PWA install & offline support
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Ignore registration errors in restricted contexts
      });
    });
  }
})();
