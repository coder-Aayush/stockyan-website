// StockYan — full-viewport candlestick chart powered by klinecharts.
//
// Pulls bars from the StockYan UDF datafeed
// (https://stockyan.astrixel.com/udf) and renders into
// #tv_chart_container[data-symbol]. Used by both /stocks/<symbol>/
// and /indexes/<slug>/ pages — the only thing that changes per page
// is the data-symbol attribute.
//
// Features
//   • Candlesticks + Volume + MA(5/10/20/60) by default
//   • Resolution switcher: 1m / 5m / 15m / 1h / 1D / 1W / 1M
//   • Drawing tools toolbar: trend line, horizontal line, fibonacci,
//     rectangle, price line, remove-all
//   • Browser-fullscreen toggle for distraction-free analysis
//   • Dark theme matching StockYan brand
//
// If the chart container or klinecharts global is missing, the script
// fails silently (no thrown errors).

(function () {
  const UDF_BASE = 'https://stockyan.astrixel.com/udf';

  const container = document.getElementById('tv_chart_container');
  if (!container) return;

  const symbol = container.dataset.symbol;
  if (!symbol) return;

  if (typeof klinecharts === 'undefined') {
    container.innerHTML = `
      <div class="chart-error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Chart library failed to load. Check your network connection and refresh.
      </div>`;
    return;
  }

  // Resolution mapping: UI label → UDF resolution
  const RESOLUTIONS = [
    { label: '1m',  udf: '1'  },
    { label: '5m',  udf: '5'  },
    { label: '15m', udf: '15' },
    { label: '1h',  udf: '60' },
    { label: '1D',  udf: 'D'  },
    { label: '1W',  udf: 'W'  },
    { label: '1M',  udf: 'M'  },
  ];

  const STORAGE_KEY = `stockyan_resolution_${symbol}`;
  const initialResolutionUdf = localStorage.getItem(STORAGE_KEY) || 'D';

  // Initialize chart
  const chart = klinecharts.init(container, {
    locale: 'en-US',
    timezone: 'Asia/Kathmandu',
    styles: {
      grid: {
        horizontal: { color: '#1B2A3C' },
        vertical:   { color: '#1B2A3C' },
      },
      candle: {
        bar: {
          upColor:        '#00C48C',
          downColor:      '#FF5A5A',
          upBorderColor:  '#00C48C',
          downBorderColor:'#FF5A5A',
          upWickColor:    '#00C48C',
          downWickColor:  '#FF5A5A',
        },
        priceMark: {
          last: { line: { color: '#00C48C' }, text: { backgroundColor: '#00C48C' } },
        },
        tooltip: {
          labels: ['Time', 'Open', 'High', 'Low', 'Close', 'Volume'],
        },
      },
      xAxis: {
        axisLine: { color: '#1B2A3C' },
        tickLine: { color: '#1B2A3C' },
        tickText: { color: '#9FB2C7' },
      },
      yAxis: {
        axisLine: { color: '#1B2A3C' },
        tickLine: { color: '#1B2A3C' },
        tickText: { color: '#9FB2C7' },
      },
      crosshair: {
        horizontal: {
          line: { color: 'rgba(0, 196, 140, 0.5)' },
          text: { backgroundColor: '#00C48C', borderColor: '#00C48C' },
        },
        vertical: {
          line: { color: 'rgba(0, 196, 140, 0.5)' },
          text: { backgroundColor: '#00C48C', borderColor: '#00C48C' },
        },
      },
      indicator: {
        tooltip: { text: { color: '#9FB2C7' } },
        bars: [
          { upColor: 'rgba(0, 196, 140, 0.45)', downColor: 'rgba(255, 90, 90, 0.45)', noChangeColor: 'rgba(155, 155, 155, 0.3)' },
        ],
      },
      separator: {
        color: '#1B2A3C',
      },
    },
  });

  // Default indicators: MA on the main pane, VOL on its own pane
  chart.createIndicator('MA', false, { id: 'candle_pane' });
  chart.createIndicator('VOL');

  // Load data for the current resolution
  let currentResolution = initialResolutionUdf;
  let loadingEl = null;

  async function loadResolution(udfRes) {
    currentResolution = udfRes;
    localStorage.setItem(STORAGE_KEY, udfRes);

    showLoading();
    try {
      const to = Math.floor(Date.now() / 1000);
      // For intraday, pull last ~60 days. For daily/weekly/monthly, pull 5 years.
      const isIntraday = ['1', '5', '15', '30', '60'].includes(udfRes);
      const from = to - (isIntraday ? 60 * 24 * 60 * 60 : 5 * 365 * 24 * 60 * 60);

      const url = `${UDF_BASE}/history?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(udfRes)}&from=${from}&to=${to}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`UDF ${res.status}`);
      const json = await res.json();

      if (json.s === 'no_data') {
        chart.applyNewData([]);
        showError(`No bars available for ${symbol} at this resolution.`);
        return;
      }
      if (json.s !== 'ok') throw new Error(json.errmsg || json.s);

      const kline = json.t.map((t, i) => ({
        timestamp: t * 1000,
        open:   json.o[i],
        high:   json.h[i],
        low:    json.l[i],
        close:  json.c[i],
        volume: json.v[i] || 0,
      }));

      chart.applyNewData(kline);
      hideLoading();
    } catch (err) {
      showError(`Could not load chart data: ${err.message}`);
    }
  }

  function showLoading() {
    if (loadingEl) return;
    loadingEl = document.createElement('div');
    loadingEl.className = 'chart-loading-overlay';
    loadingEl.innerHTML = '<span class="chart-spinner"></span> Loading…';
    container.appendChild(loadingEl);
  }

  function hideLoading() {
    if (loadingEl) {
      loadingEl.remove();
      loadingEl = null;
    }
  }

  function showError(msg) {
    hideLoading();
    if (loadingEl) loadingEl.remove();
    const errEl = document.createElement('div');
    errEl.className = 'chart-loading-overlay chart-error-overlay';
    errEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${escapeHtml(msg)}`;
    container.appendChild(errEl);
    setTimeout(() => errEl.remove(), 4000);
  }

  // Wire up resolution buttons
  document.querySelectorAll('[data-resolution]').forEach(btn => {
    if (btn.dataset.resolution === initialResolutionUdf) btn.classList.add('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-resolution]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadResolution(btn.dataset.resolution);
    });
  });

  // Wire up drawing tool buttons
  const DRAW_TOOLS = {
    'segment':   { name: 'segment' },          // Trend line
    'horizontal': { name: 'horizontalStraightLine' },
    'vertical':  { name: 'verticalStraightLine' },
    'fibonacci': { name: 'fibonacciLine' },
    'rectangle': { name: 'rect' },
    'price-line':{ name: 'priceLine' },
  };

  document.querySelectorAll('[data-draw]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = DRAW_TOOLS[btn.dataset.draw];
      if (!tool) return;
      chart.createOverlay({ name: tool.name });
    });
  });

  const clearBtn = document.querySelector('[data-action="clear-drawings"]');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => chart.removeOverlay());
  }

  // Wire up fullscreen button
  const fullscreenBtn = document.querySelector('[data-action="fullscreen"]');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', async () => {
      const target = container.closest('.chart-shell') || container;
      if (!document.fullscreenElement) {
        if (target.requestFullscreen) await target.requestFullscreen();
        else if (target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    });
  }

  document.addEventListener('fullscreenchange', () => {
    const inFs = !!document.fullscreenElement;
    if (fullscreenBtn) {
      fullscreenBtn.innerHTML = inFs
        ? '<i class="fa-solid fa-compress"></i> Exit'
        : '<i class="fa-solid fa-expand"></i> Fullscreen';
    }
    setTimeout(() => chart.resize && chart.resize(), 50);
  });

  // Keep chart sized to its parent
  const ro = new ResizeObserver(() => chart.resize && chart.resize());
  ro.observe(container);

  // Boot
  loadResolution(initialResolutionUdf);

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
