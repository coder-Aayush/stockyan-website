// Smart links: /download (store by device) and /open/<target>, /r/<code>
// (open the app on that screen, or send the person to the right store).
// Loaded in <head> of those pages so phones are redirected before anything
// paints. Every hop is logged to Google Analytics with where it came from.
(function () {
  var STORE = {
    ios: 'https://apps.apple.com/np/app/stockyan-nepal-share-market/id6757148688',
    android: 'https://play.google.com/store/apps/details?id=app.golden.stockyan',
  };
  var PACKAGE = 'app.golden.stockyan';
  // App Store Connect > Analytics > Campaigns provider token. When set, iPhone
  // installs are attributed to the campaign in App Store Connect.
  var APPLE_PROVIDER_TOKEN = '128639543';

  var q = new URLSearchParams(location.search);
  var ua = navigator.userAgent;
  var platform = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document) ? 'ios'
    : /Android/.test(ua) ? 'android' : 'desktop';
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Line\/|Twitter|Snapchat|Messenger/i.test(ua);

  function referrerHost() {
    try { return document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) { return ''; }
  }
  var internal = /(^|\.)stockyan\.(com|info)$/.test(referrerHost());
  var source = {
    utm_source: q.get('utm_source') || q.get('src') || referrerHost() || 'direct',
    utm_medium: q.get('utm_medium') || 'link',
    utm_campaign: q.get('utm_campaign') || '',
    ref: q.get('ref') || '',
  };

  // Path: /open/scanner/rsi → target "scanner/rsi"; /r/ABC123 → referral.
  var parts = location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  var link = null;
  if (parts[0] === 'open') link = { kind: 'open', target: parts.slice(1).join('/') || 'home' };
  if (parts[0] === 'r' && parts[1]) { link = { kind: 'r', target: 'home' }; source.ref = source.ref || parts[1]; }

  function appQuery() {
    var p = new URLSearchParams();
    ['utm_source', 'utm_medium', 'utm_campaign', 'ref'].forEach(function (k) { if (source[k]) p.set(k, source[k]); });
    var s = p.toString();
    return s ? '?' + s : '';
  }
  function storeUrl(os) {
    if (os === 'android') {
      var r = new URLSearchParams();
      r.set('utm_source', source.utm_source);
      r.set('utm_medium', source.utm_medium);
      if (source.utm_campaign) r.set('utm_campaign', source.utm_campaign);
      if (source.ref) r.set('ref', source.ref);
      if (link) r.set('target', link.target);
      return STORE.android + '&referrer=' + encodeURIComponent(r.toString());
    }
    if (APPLE_PROVIDER_TOKEN) {
      return STORE.ios + '?pt=' + APPLE_PROVIDER_TOKEN + '&ct=' + encodeURIComponent((source.utm_campaign || source.utm_source).slice(0, 40)) + '&mt=8';
    }
    return STORE.ios;
  }
  function schemeUrl() {
    var path = link.kind === 'r' ? 'r/' + encodeURIComponent(source.ref) : 'open/' + link.target;
    return 'stockyan://' + path + appQuery();
  }
  function androidIntent() {
    var path = link.kind === 'r' ? 'r/' + encodeURIComponent(source.ref) : 'open/' + link.target;
    return 'intent://' + path + appQuery() + '#Intent;scheme=stockyan;package=' + PACKAGE +
      ';S.browser_fallback_url=' + encodeURIComponent(storeUrl('android')) + ';end';
  }

  // Log, then go. The beacon survives the page unloading; the timer is a
  // fallback in case analytics is blocked.
  function go(url, action) {
    var done = false;
    var leave = function () { if (!done) { done = true; location.replace(url); } };
    if (window.gtag) {
      window.gtag('event', link ? 'smart_link' : 'download_redirect', {
        platform: platform, action: action, target: link ? link.target : '',
        link_ref: source.ref, link_source: source.utm_source, link_medium: source.utm_medium, link_campaign: source.utm_campaign,
        transport_type: 'beacon', event_callback: leave, event_timeout: 700,
      });
    }
    setTimeout(leave, 800);
  }

  window.StockYanGo = { platform: platform, inApp: inApp, link: link, source: source, storeUrl: storeUrl, schemeUrl: link ? schemeUrl : null, intentUrl: link ? androidIntent : null, go: go };

  if (q.get('stay')) return;

  if (link) {
    // Reaching this page means the app did not open it directly.
    if (platform === 'android') go(androidIntent(), 'intent');
    // A tap from our own site never opens the app (iOS ignores same-site
    // links), so those visitors get the buttons too.
    else if (platform === 'ios' && !inApp && !internal) go(storeUrl('ios'), 'store');
    // iPhone in-app browsers and desktops see the page with buttons.
    return;
  }

  var wanted = q.get('p');
  var os = wanted === 'ios' || wanted === 'android' ? wanted : platform;
  if (os === 'ios' || os === 'android') go(storeUrl(os), 'store');
})();
