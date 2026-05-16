// StockYan — TradingView Advanced Chart bootstrap
//
// Reads the symbol from #tv_chart_container[data-symbol] and mounts a
// TradingView Advanced Charting Library widget. Data is sourced from the
// StockYan UDF datafeed (https://stockyan.astrixel.com/udf), which exposes
// the standard TradingView UDF endpoints: config, time, symbols, search,
// history, marks. The Datafeeds.UDFCompatibleDatafeed adapter shipped with
// the Charting Library bundle calls all six endpoints automatically.
//
// If the private charting_library/ folder is not present in this build, a
// friendly placeholder is rendered instead of throwing.
//
// Go live: drop the TradingView charting_library/ folder at the repo root
// (so /charting_library/charting_library.standalone.js and
// /charting_library/datafeeds/udf/dist/bundle.js are reachable), then
// redeploy. No other code changes needed.

(function () {
  const CHART_DATAFEED_URL = 'https://stockyan.astrixel.com/udf';
  const LIBRARY_PATH = '/charting_library/';

  const container = document.getElementById('tv_chart_container');
  if (!container) return;

  const symbol = container.dataset.symbol;
  if (!symbol) return;

  const libraryMissing =
    typeof TradingView === 'undefined' ||
    typeof Datafeeds === 'undefined' ||
    window.__tvLibraryMissing === true;

  if (libraryMissing) {
    container.classList.add('tv-chart-placeholder');
    container.innerHTML = `
      <div class="tv-placeholder-inner">
        <i class="fa-solid fa-chart-line tv-placeholder-icon"></i>
        <h3>Live chart for ${escapeHtml(symbol)}</h3>
        <p>The TradingView Advanced Charts library is not yet bundled with this build. Drop the <code>charting_library/</code> folder at the repo root and redeploy to activate live candlestick charts with drawing tools, indicators and dividend markers.</p>
        <p class="tv-placeholder-meta">Datafeed: <a href="${CHART_DATAFEED_URL}/symbols?symbol=${encodeURIComponent(symbol)}" target="_blank" rel="noopener">${CHART_DATAFEED_URL}</a></p>
        <a href="/#download" class="tv-placeholder-cta">Track ${escapeHtml(symbol)} on the StockYan app instead</a>
      </div>
    `;
    return;
  }

  // eslint-disable-next-line no-new
  new TradingView.widget({
    container: 'tv_chart_container',
    symbol: symbol,
    interval: 'D',
    fullscreen: false,
    autosize: true,
    library_path: LIBRARY_PATH,
    datafeed: new Datafeeds.UDFCompatibleDatafeed(CHART_DATAFEED_URL),
    locale: 'en',
    timezone: 'Asia/Kathmandu',
    theme: 'Dark',
    toolbar_bg: '#0A1220',
    // Resolutions exposed by /udf/config
    enabled_features: [
      'hide_left_toolbar_by_default',
      'show_symbol_logos',
    ],
    disabled_features: [
      'use_localstorage_for_settings',
    ],
    // /udf/marks is supported by the datafeed (supports_marks: true in config)
    // The UDFCompatibleDatafeed adapter wires getMarks → /udf/marks automatically.
    overrides: {
      'paneProperties.background': '#0A1220',
      'paneProperties.backgroundType': 'solid',
      'paneProperties.vertGridProperties.color': '#1B2A3C',
      'paneProperties.horzGridProperties.color': '#1B2A3C',
      'scalesProperties.textColor': '#9FB2C7',
      'mainSeriesProperties.candleStyle.upColor': '#00C48C',
      'mainSeriesProperties.candleStyle.downColor': '#FF5A5A',
      'mainSeriesProperties.candleStyle.borderUpColor': '#00C48C',
      'mainSeriesProperties.candleStyle.borderDownColor': '#FF5A5A',
      'mainSeriesProperties.candleStyle.wickUpColor': '#00C48C',
      'mainSeriesProperties.candleStyle.wickDownColor': '#FF5A5A',
    },
    loading_screen: {
      backgroundColor: '#0A1220',
      foregroundColor: '#00C48C',
    },
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
