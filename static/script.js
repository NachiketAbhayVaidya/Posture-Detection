const socket = io();
 
// ── Element refs ──
const pitchEl       = document.getElementById('pitch');
const postureEl     = document.getElementById('posture');
const severityEl    = document.getElementById('severity');
const scoreEl       = document.getElementById('score');
const slouchEl      = document.getElementById('slouch');
const timerEl       = document.getElementById('timer');
const ssiBar        = document.getElementById('ssiBar');
const severityBadge = document.getElementById('severityBadge');
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');
const sittingStatus = document.getElementById('sittingStatus');
const sittingSub    = document.getElementById('sittingSub');
const pomoSession   = document.getElementById('pomoSession');
const pomoStatus    = document.getElementById('pomoStatus');
const toast         = document.getElementById('toast');
 
// ── Session Summary refs ──
const summaryPanel    = document.getElementById('summaryPanel');
const summarySubtitle = document.getElementById('summarySubtitle');
const summaryTime     = document.getElementById('summaryTime');
const sumSlouchCount  = document.getElementById('sumSlouchCount');
const sumSSI          = document.getElementById('sumSSI');
const sumPosture      = document.getElementById('sumPosture');
const sumType         = document.getElementById('sumType');
const summaryMsg      = document.getElementById('summaryMsg');
const sessionLog      = document.getElementById('sessionLog');
 
// ── State tracking ──
let prevRemainingSeconds = null;
let prevOnBreak          = null;
let prevPomodoroRunning  = null;
let sessionLogEntries    = [];
let sessionStartTime     = null;
 
// ── Pitch Chart ──
const pitchChart = new Chart(document.getElementById('pitchChart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Pitch (°)',
      data: [],
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56,189,248,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: '#38bdf8',
      borderWidth: 2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ctx.formattedValue + '°' } }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#475569', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#475569', font: { size: 10 }, callback: v => v + '°' },
        title: { display: true, text: 'degrees', color: '#475569', font: { size: 10 } }
      }
    }
  }
});
 
// ── Toast ──
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}
 
// ── Color helpers ──
function severityClass(sev) {
  if (sev === 'Good')     return 'good';
  if (sev === 'Mild')     return 'warn';
  if (sev === 'Moderate') return 'warn';
  if (sev === 'Severe')   return 'bad';
  return '';
}
 
function applySeverityColor(el, sev) {
  el.classList.remove('good', 'warn', 'bad');
  const c = severityClass(sev);
  if (c) el.classList.add(c);
}
 
function updateBadge(sev) {
  severityBadge.textContent = sev || '—';
  severityBadge.className = 'ssi-badge';
  severityBadge.classList.add(severityClass(sev) || '');
}
 
function updateBarColor(score) {
  if (score >= 7)      ssiBar.style.background = 'linear-gradient(90deg,#22c55e,#38bdf8)';
  else if (score >= 4) ssiBar.style.background = 'linear-gradient(90deg,#f59e0b,#fbbf24)';
  else                 ssiBar.style.background = 'linear-gradient(90deg,#f43f5e,#fb7185)';
}
 
// ── Session log ──
function addLogEntry(dotClass, message) {
  const time = new Date().toLocaleTimeString();
  sessionLogEntries.push({ dotClass, message, time });
}
 
function renderSessionLog() {
  sessionLog.innerHTML = '';
  sessionLogEntries.forEach(entry => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="log-dot ${entry.dotClass}"></span>
      <span>${entry.message}</span>
      <span class="log-time">${entry.time}</span>
    `;
    sessionLog.appendChild(li);
  });
}
 
// ── Build summary feedback message ──
function buildFeedbackMsg(slouchCount, ssi, isBreak) {
  if (isBreak) {
    return '☕ Break session complete. Take a moment to stretch, hydrate, and rest your eyes before your next focus block.';
  }
  if (slouchCount === 0) {
    return '🏆 Perfect session! Zero slouches detected. Your posture was excellent throughout this focus block.';
  } else if (slouchCount <= 2) {
    return `👍 Good effort! You slouched ${slouchCount} time(s) this session. Minor adjustments — try checking your seat height and screen distance.`;
  } else if (slouchCount <= 5) {
    return `⚠️ ${slouchCount} slouches detected. Consider taking a posture reset before starting your next session. Try setting a lumbar support reminder.`;
  } else {
    return `🔴 ${slouchCount} slouches detected — that's quite a few. Your SSI score was ${ssi}/10. Try repositioning your chair and taking a short walk before continuing.`;
  }
}
 
// ── Show Session Summary ──
function showSessionSummary(data, isBreak) {
  const typeLabel   = isBreak ? 'Break' : 'Focus';
  const slouchCount = parseInt(data.slouch_count) || 0;
  const ssiScore    = parseInt(data.score) || 0;
  const posture     = data.posture
    ? data.posture.charAt(0).toUpperCase() + data.posture.slice(1) : '—';
 
  summarySubtitle.textContent = typeLabel + ' session completed';
  summaryTime.textContent     = 'Ended at ' + new Date().toLocaleTimeString();
 
  sumSlouchCount.textContent = slouchCount;
  sumSlouchCount.className = 'sum-value ' + (slouchCount === 0 ? 'good' : slouchCount <= 3 ? 'warn' : 'bad');
 
  sumSSI.textContent = ssiScore + ' / 10';
  sumSSI.className = 'sum-value ' + (ssiScore >= 7 ? 'good' : ssiScore >= 4 ? 'warn' : 'bad');
 
  sumPosture.textContent = posture;
  applySeverityColor(sumPosture, data.severity);
  sumPosture.className = 'sum-value ' + severityClass(data.severity);
 
  sumType.textContent = typeLabel + ' Block';
  sumType.className = 'sum-value';
 
  summaryMsg.textContent = buildFeedbackMsg(slouchCount, ssiScore, isBreak);
 
  // Add a log entry for this session end
  addLogEntry(
    isBreak ? 'purple' : 'green',
    typeLabel + ' session finished — SSI: ' + ssiScore + '/10, Slouches: ' + slouchCount
  );
  renderSessionLog();
 
  summaryPanel.style.display = 'block';
  summaryPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
 
// ── Main socket handler ──
socket.on('sensor_data', function(data) {
 
  // Status dot
  statusDot.classList.add('live');
  statusText.textContent = 'Live · Sensor Connected';
 
  // Track session start time
  if (!sessionStartTime) {
    sessionStartTime = new Date();
    addLogEntry('purple', 'Session started');
    renderSessionLog();
  }
 
  // ── Core metrics ──
  pitchEl.textContent = parseFloat(data.pitch).toFixed(1) + '°';
 
  postureEl.textContent = data.posture
    ? data.posture.charAt(0).toUpperCase() + data.posture.slice(1) : '—';
  applySeverityColor(postureEl, data.severity);
 
  severityEl.textContent = data.severity || '—';
  applySeverityColor(severityEl, data.severity);
 
  slouchEl.textContent = data.slouch_count;
 
  const s = parseInt(data.score) || 0;
  scoreEl.textContent = s;
  ssiBar.style.width  = (s * 10) + '%';
  updateBarColor(s);
  updateBadge(data.severity);
 
  // ── Sitting status ──
  if (data.sitting) {
    sittingStatus.textContent  = 'Seated ✓';
    sittingStatus.className    = 'sitting-value';
    sittingSub.textContent     = 'Both pressure sensors active';
  } else {
    sittingStatus.textContent  = 'Not Seated';
    sittingStatus.className    = 'sitting-value off';
    sittingSub.textContent     = 'Awaiting sensor pressure';
  }
 
  // ── Timer & Pomodoro ──
  timerEl.textContent = data.timer || '—';
 
  if (data.paused_by_slouch) {
    pomoSession.textContent = 'Paused — fix your posture';
    pomoStatus.textContent  = '⏸ Paused';
    addLogEntry('red', 'Pomodoro paused — too many slouches detected');
    renderSessionLog();
  } else if (data.on_break) {
    pomoSession.textContent = 'Break session';
    pomoStatus.textContent  = '☕ Break';
  } else if (data.pomodoro_running) {
    pomoSession.textContent = 'Focus session';
    pomoStatus.textContent  = '▶ Running';
  } else {
    pomoSession.textContent = 'Timer idle';
    pomoStatus.textContent  = '— Idle';
  }
 
  // ── Detect slouch confirmed (new) ──
  if (data.slouch_confirmed && prevRemainingSeconds !== null) {
    const curCount = parseInt(data.slouch_count) || 0;
    if (curCount > 0) {
      const sev = data.severity || 'Unknown';
      addLogEntry('amber', 'Slouch confirmed — severity: ' + sev + ', pitch: ' + parseFloat(data.pitch).toFixed(1) + '°');
      renderSessionLog();
    }
  }
 
  // ── Toast on session change (from Arduino pomodoro_message) ──
  if (data.session_changed && data.pomodoro_message) {
    showToast(data.pomodoro_message);
  }
 
  // ── Detect Pomodoro timer reaching zero → show Session Summary ──
  // remaining_seconds crosses from >0 to 0
  if (
    prevRemainingSeconds !== null &&
    prevRemainingSeconds > 0 &&
    parseInt(data.remaining_seconds) === 0
  ) {
    const wasBreak = !!data.on_break;
    showSessionSummary(data, wasBreak);
  }
 
  // ── Detect break→focus or focus→break transition ──
  if (prevOnBreak !== null && prevOnBreak !== !!data.on_break) {
    const newType = data.on_break ? 'Break' : 'Focus';
    addLogEntry('purple', 'Session changed → ' + newType + ' session started');
    renderSessionLog();
  }
 
  // ── Save state for next tick ──
  prevRemainingSeconds = parseInt(data.remaining_seconds);
  prevOnBreak          = !!data.on_break;
  prevPomodoroRunning  = !!data.pomodoro_running;
 
  // ── Pitch chart ──
  const time = new Date().toLocaleTimeString();
  pitchChart.data.labels.push(time);
  pitchChart.data.datasets[0].data.push(parseFloat(data.pitch).toFixed(1));
  if (pitchChart.data.labels.length > 15) {
    pitchChart.data.labels.shift();
    pitchChart.data.datasets[0].data.shift();
  }
  pitchChart.update();
});