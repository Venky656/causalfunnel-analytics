/**
 * CausalFunnel Analytics — live heat overlay.
 *
 * Shows stored clicks as heat blobs on top of the REAL open page.
 *
 * Use it in two ways:
 *
 * 1) Store heat mode — open any tracked page with ?heatmap=1
 *      http://localhost:5173/store/products?heatmap=1
 *
 * 2) Bookmarklet — run on ANY page in your browser (needs permission
 *    for the target site; read-only, it never modifies the page):
 *      javascript:!function(){var s=document.createElement('script');s.src='https://YOUR-BACKEND-DOMAIN/heatmap-overlay.js';document.body.appendChild(s);}();
 *
 * The overlay only READS click data (GET /api/clicks) and records nothing.
 * Coordinates are document pixels, mapped 1:1 — heat aligns best when the
 * page is viewed at a similar width as when clicks were captured.
 */
(function () {
  'use strict';
  if (window.__cfHeatLoaded) return;
  window.__cfHeatLoaded = true;

  function currentScript() {
    if (document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  }

  function config() {
    var s = null;
    try {
      s = currentScript();
    } catch (e) {}
    var apiEvents =
      window.HEATMAP_API_URL ||
      (s && s.getAttribute('data-api-url')) ||
      'http://localhost:5000/api/events';
    var clicksEndpoint = apiEvents.replace(/\/api\/events\/?$/, '/api/clicks');
    var elementsEndpoint = apiEvents.replace(/\/api\/events\/?$/, '/api/elements');
    var pageUrl =
      window.HEATMAP_PAGE_URL ||
      (s && s.getAttribute('data-page-url')) ||
      window.location.href.split('?')[0];
    // ?heatmap=1 style flags must not be part of the lookup URL.
    pageUrl = String(pageUrl).replace(/[?&]heatmap=1\b/, '').replace(/[?&]notrack=1\b/, '').replace(/[?&]cart=1\b/, '');
    // Data source filter: the live-site button passes data-source="live" so
    // the overlay shows genuine traffic only. Defaults to all.
    var source =
      window.HEATMAP_SOURCE || (s && s.getAttribute('data-source')) || 'all';
    if (source !== 'live' && source !== 'demo') source = 'all';
    // 'element' (default) anchors heat to real DOM elements; 'pixels' keeps the
    // classic page-wide density surface.
    var mode =
      window.HEATMAP_MODE || (s && s.getAttribute('data-mode')) || 'element';
    if (mode !== 'element' && mode !== 'pixels') mode = 'element';
    return {
      clicksEndpoint: clicksEndpoint,
      elementsEndpoint: elementsEndpoint,
      pageUrl: pageUrl,
      source: source,
      mode: mode,
    };
  }

  var RAMP = [
    [0.0, 0, 0, 0, 0],
    [0.22, 34, 197, 94, 110],
    [0.48, 250, 204, 21, 140],
    [0.74, 249, 115, 22, 165],
    [1.0, 239, 68, 68, 190],
  ];

  function ramp(t) {
    var x = Math.min(1, Math.max(0, t));
    for (var i = 1; i < RAMP.length; i++) {
      if (x <= RAMP[i][0]) {
        var a = RAMP[i - 1],
          b = RAMP[i],
          f = (x - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return [
          Math.round(a[1] + (b[1] - a[1]) * f),
          Math.round(a[2] + (b[2] - a[2]) * f),
          Math.round(a[3] + (b[3] - a[3]) * f),
          Math.round(a[4] + (b[4] - a[4]) * f),
        ];
      }
    }
    var last = RAMP[RAMP.length - 1];
    return [last[1], last[2], last[3], last[4]];
  }

  function badge(text, isError) {    var old = document.getElementById('cf-heat-badge');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'cf-heat-badge';
    el.style.cssText =
      'position:fixed;right:12px;bottom:12px;z-index:2147483647;' +
      'font:600 12px/1.4 system-ui,sans-serif;color:#fff;' +
      'background:' +
      (isError ? '#b91c1c' : '#111827') +
      ';padding:10px 12px;border-radius:10px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.35);max-width:280px;';
    el.innerHTML =
      '<div>' +
      text +
      '</div>' +
      '<div style="margin-top:6px;display:flex;gap:8px;">' +
      '<button id="cf-heat-toggle" style="cursor:pointer;border:0;border-radius:6px;padding:4px 10px;font-weight:700;background:#4f46e5;color:#fff;">Hide</button>' +
      '<button id="cf-heat-close" style="cursor:pointer;border:0;border-radius:6px;padding:4px 10px;font-weight:700;background:#374151;color:#fff;">Close</button>' +
      '</div>';
    document.body.appendChild(el);
    var layer = document.getElementById('cf-heat-layer');
    document.getElementById('cf-heat-toggle').onclick = function () {
      if (!layer) return;
      var hidden = layer.style.display === 'none';
      layer.style.display = hidden ? '' : 'none';
      this.textContent = hidden ? 'Hide' : 'Show';
    };
    document.getElementById('cf-heat-close').onclick = function () {
      if (layer) layer.remove();
      el.remove();
      window.__cfHeatLoaded = false;
    };
  }

  // ---- element-anchored heat (the precise mode) -------------------------
  // Re-find each element by its stable data-analytics-id on the LIVE page and
  // draw a blob on the element's CURRENT box. Clicks recorded at a different
  // viewport still land on the right control, so heat stays consistent.
  function findByKey(key) {
    if (!key) return null;
    try {
      // data-analytics-id may contain characters needing CSS escaping; use
      // attribute selector with escaped quotes instead of building a selector.
      var all = document.querySelectorAll('[data-analytics-id]');
      for (var i = 0; i < all.length; i++) {
        if (all[i].getAttribute('data-analytics-id') === key) return all[i];
      }
      // Fall back to data-analytics-label / id-derived keys.
      if (key.indexOf('label:') === 0) {
        var want = key.slice(6);
        var labs = document.querySelectorAll('[data-analytics-label]');
        for (var j = 0; j < labs.length; j++) {
          var lv = (labs[j].getAttribute('data-analytics-label') || '').toLowerCase();
          if (lv === want) return labs[j];
        }
      }
      if (key.indexOf('id:') === 0) {
        var el = document.getElementById(key.slice(3));
        if (el) return el;
      }
    } catch (e) {}
    return null;
  }

  function clearLayers() {
    var old = document.getElementById('cf-heat-layer');
    if (old) old.remove();
    var cards = document.getElementById('cf-heat-cards');
    if (cards) cards.remove();
  }

  function heatColor(t) {
    // Same green -> yellow -> red ramp as the pixel mode, opaque core.
    var x = Math.min(1, Math.max(0, t));
    var stops = [
      [0.0, 34, 197, 94],
      [0.45, 250, 204, 21],
      [0.75, 249, 115, 22],
      [1.0, 239, 68, 68],
    ];
    for (var i = 1; i < stops.length; i++) {
      if (x <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i];
        var f = (x - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return [
          Math.round(a[1] + (b[1] - a[1]) * f),
          Math.round(a[2] + (b[2] - a[2]) * f),
          Math.round(a[3] + (b[3] - a[3]) * f),
        ];
      }
    }
    var l = stops[stops.length - 1];
    return [l[1], l[2], l[3]];
  }

  function fmtMoney(n) {
    return '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  function fmtInt(n) {
    return (n || 0).toLocaleString('en-US');
  }

  /**
   * Draw one blob + rank badge + hover card per hotspot element.
   * Uses absolutely-positioned DOM (not canvas) so each hotspot stays anchored
   * to its element as the page scrolls and reflows.
   */
  function drawElements(rows) {
    clearLayers();
    var maxClicks = rows.reduce(function (m, r) { return Math.max(m, r.clicks || 0); }, 0);
    if (maxClicks <= 0) return;

    var layer = document.createElement('div');
    layer.id = 'cf-heat-layer';
    layer.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:2147483646;';
    document.body.appendChild(layer);

    var cards = document.createElement('div');
    cards.id = 'cf-heat-cards';
    cards.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:2147483647;';
    document.body.appendChild(cards);

    var placed = 0;
    var anchors = [];
    rows.forEach(function (r) {
      var node = findByKey(r.element_key);
      var rect = null;
      if (node) {
        var b = node.getBoundingClientRect();
        var sx = window.pageXOffset || document.documentElement.scrollLeft || 0;
        var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
        if (b.width > 0 && b.height > 0) {
          rect = { x: b.left + sx, y: b.top + sy, w: b.width, h: b.height };
        }
      }
      if (!rect && r.rect) {
        // Stored box (element not present in current layout) — draw in place.
        rect = r.rect;
      }
      if (!rect) return; // element gone from this layout; skip cleanly
      placed++;
      anchors.push({ row: r, rect: rect, node: node });

      var t = Math.sqrt((r.clicks || 0) / maxClicks);
      var col = heatColor(t);
      var rw = Math.max(28, Math.round(rect.w * 0.62));
      var rh = Math.max(28, Math.round(rect.h * 0.62));
      var left = rect.x + rect.w / 2 - rw / 2;
      var top = rect.y + rect.h / 2 - rh / 2;

      // Soft elliptical blob centred on the element.
      var blob = document.createElement('div');
      blob.style.cssText =
        'position:absolute;border-radius:50%;pointer-events:none;' +
        'left:' + left + 'px;top:' + top + 'px;width:' + rw + 'px;height:' + rh + 'px;' +
        'background:radial-gradient(closest-side,rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.62),rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0.22) 55%,rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',0) 78%);' +
        'transition:opacity .2s;';
      layer.appendChild(blob);

      // Rank badge (green pill like the reference).
      var badgeEl = document.createElement('div');
      badgeEl.style.cssText =
        'position:absolute;pointer-events:none;display:flex;align-items:center;gap:4px;' +
        'font:700 11px/1 system-ui,sans-serif;color:#fff;' +
        'background:#16a34a;border-radius:999px;padding:3px 7px;' +
        'box-shadow:0 1px 4px rgba(0,0,0,.25);' +
        'left:' + Math.round(rect.x + rect.w / 2 - 16) + 'px;top:' + Math.round(rect.y - 12) + 'px;';
      badgeEl.textContent = '#' + (r.rank || '');
      layer.appendChild(badgeEl);

      // Invisible hover target covering the element + card anchor point.
      var hit = document.createElement('div');
      hit.style.cssText =
        'position:absolute;pointer-events:auto;cursor:pointer;' +
        'left:' + rect.x + 'px;top:' + rect.y + 'px;width:' + rect.w + 'px;height:' + rect.h + 'px;';
      hit.addEventListener('mouseenter', function () { showCard(cards, r, rect); });
      hit.addEventListener('mouseleave', function () { hideCard(cards); });
      layer.appendChild(hit);
    });

    if (placed === 0) {
      clearLayers();
      badge('Heat found for this page, but none of those elements exist in this layout.', false);
    }
  }

  function hideCard(cards) {
    var c = cards.querySelector('.cf-heat-card');
    if (c) c.remove();
  }

  /** Reference-style metric card for a single element. */
  function showCard(cards, r, rect) {
    hideCard(cards);
    var card = document.createElement('div');
    card.className = 'cf-heat-card';
    var money = (r.revenue || 0) > 0;
    var rows = [
      ['Sessions', fmtInt(r.sessions)],
      ['Clicks', fmtInt(r.clicks)],
      ['Purchases', fmtInt(r.purchases)],
      ['Revenue', fmtMoney(r.revenue || 0)],
      ['Avg. Order Value', fmtMoney(r.aov || 0)],
      ['Conversion Rate', (r.conversion_rate || 0).toFixed(2) + '%'],
      ['Rev. per click', fmtMoney(r.revenue_per_click || 0)],
      ['Rev. per session', fmtMoney(r.revenue_per_session || 0)],
    ];
    var html =
      '<div style="display:inline-block;background:#16a34a;color:#fff;font:700 11px/1 system-ui;border-radius:999px;padding:4px 8px;margin-bottom:6px;">#' +
      (r.rank || '') + '</div>' +
      '<div style="font:800 12px/1.3 system-ui,sans-serif;color:#111827;text-transform:uppercase;margin-bottom:6px;">' +
      (r.label || r.element_key || 'Element') + '</div>';
    rows.forEach(function (row) {
      html +=
        '<div style="display:flex;justify-content:space-between;gap:18px;font:500 11px/1.6 system-ui,sans-serif;color:#374151;border-top:1px solid #f1f5f9;padding:2px 0;">' +
        '<span>' + row[0] + '</span><span style="font-weight:700;color:#111827;">' + row[1] + '</span></div>';
    });
    card.innerHTML = html;
    card.style.cssText =
      'position:absolute;pointer-events:none;background:#fff;border-radius:14px;padding:12px 14px;min-width:230px;' +
      'box-shadow:0 8px 30px rgba(15,23,42,.22);border:1px solid #e2e8f0;';
    // Position near the element, flipping/clamping to stay on-screen.
    var W = 250, H = 300;
    var left = rect.x + rect.w / 2 + 12;
    if (left + W > window.scrollX + window.innerWidth - 8) {
      left = rect.x + rect.w / 2 - W - 12;
    }
    left = Math.max(window.scrollX + 8, left);
    var top = rect.y + rect.h / 2 - H / 2;
    top = Math.max(window.scrollY + 8, Math.min(top, window.scrollY + window.innerHeight - H - 8));
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    cards.appendChild(card);
  }

  function draw(clicks) {
    var old = document.getElementById('cf-heat-layer');
    if (old) old.remove();
    var cards = document.getElementById('cf-heat-cards');
    if (cards) cards.remove();
    var layer = document.createElement('div');
    layer.id = 'cf-heat-layer';
    layer.style.cssText =
      'position:absolute;top:0;left:0;pointer-events:none;z-index:2147483646;';
    var W = Math.max(
      document.documentElement.scrollWidth,
      document.body ? document.body.scrollWidth : 0,
      window.innerWidth
    );
    var H = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0,
      window.innerHeight
    );
    layer.style.width = W + 'px';
    layer.style.height = H + 'px';
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    layer.appendChild(canvas);
    document.body.appendChild(layer);

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    // True gaussian density surface (float grid, no clamping): overlapping
    // clicks sum into smooth hills with red cores and soft green/yellow
    // skirts, like professional heatmap tools.
    var R = 46;
    var sigma = R / 2.2;
    var rad = Math.ceil(sigma * 3);
    var twoS2 = 2 * sigma * sigma;
    var dens = new Float32Array(W * H);
    var peak = 0;
    var ci, x0, x1, y0, y1, x, y, dx, dy, v, idx;
    for (ci = 0; ci < clicks.length; ci++) {
      var c = clicks[ci];
      if (!isFinite(c.x) || !isFinite(c.y)) continue;
      x0 = Math.max(0, Math.floor(c.x - rad));
      x1 = Math.min(W - 1, Math.ceil(c.x + rad));
      y0 = Math.max(0, Math.floor(c.y - rad));
      y1 = Math.min(H - 1, Math.ceil(c.y + rad));
      for (y = y0; y <= y1; y++) {
        dy = y - c.y;
        for (x = x0; x <= x1; x++) {
          dx = x - c.x;
          v = Math.exp(-(dx * dx + dy * dy) / twoS2);
          idx = y * W + x;
          dens[idx] += v;
          if (dens[idx] > peak) peak = dens[idx];
        }
      }
    }
    if (peak <= 0) return;
    var out = ctx.createImageData(W, H);
    for (var i = 0; i < dens.length; i++) {
      v = dens[i];
      if (v <= 0.01) continue;
      var t = Math.sqrt(v / peak);
      if (t <= 0.02) continue;
      var col = ramp(t);
      var o = i * 4;
      out.data[o] = col[0];
      out.data[o + 1] = col[1];
      out.data[o + 2] = col[2];
      out.data[o + 3] = Math.round(col[3] * 0.6);
    }
    ctx.putImageData(out, 0, 0);
  }

  // Public control for host pages (e.g. the store's floating Heat button).
  function setVisible(show) {
    var layer = document.getElementById('cf-heat-layer');
    var badgeEl = document.getElementById('cf-heat-badge');
    if (layer) layer.style.display = show ? '' : 'none';
    if (badgeEl) badgeEl.style.display = show ? '' : 'none';
    var t = document.getElementById('cf-heat-toggle');
    if (t) t.textContent = show ? 'Hide' : 'Show';
    return show;
  }
  window.__cfHeat = {
    toggle: function () {
      var layer = document.getElementById('cf-heat-layer');
      if (!layer) {
        run();
        return true;
      }
      return setVisible(layer.style.display === 'none');
    },
    close: function () {
      var layer = document.getElementById('cf-heat-layer');
      var badgeEl = document.getElementById('cf-heat-badge');
      if (layer) layer.remove();
      if (badgeEl) badgeEl.remove();
      window.__cfHeatLoaded = false;
    },
  };

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function fetchClicks(url) {
    var cfg = config();
    return fetchJson(cfg.clicksEndpoint + '?url=' + encodeURIComponent(url) + '&source=' + cfg.source);
  }

  function fetchElements(url) {
    var cfg = config();
    return fetchJson(cfg.elementsEndpoint + '?url=' + encodeURIComponent(url) + '&source=' + cfg.source + '&limit=80');
  }

  function run() {
    var cfg = config();
    var candidates = [];
    // 1) exact URL, 2) without query/hash (SPA links often add params).
    candidates.push(cfg.pageUrl);
    var bare = cfg.pageUrl.split('?')[0].split('#')[0];
    if (bare !== cfg.pageUrl) candidates.push(bare);

    function elementPass(i) {
      if (i >= candidates.length) return pixelPass(0);
      return fetchElements(candidates[i]).then(
        function (body) {
          var rows = (body && body.data) || [];
          if (rows.length === 0) return elementPass(i + 1);
          drawElements(rows);
          var liveOnly = cfg.source === 'live';
          var rev = body.total_revenue || 0;
          badge(
            '🎯 ' + rows.length + ' elements ranked' +
              (liveOnly ? ' <span style="background:#10b981;border-radius:4px;padding:0 6px;">LIVE</span>' : '') +
              '<br><span style="opacity:.7">' + fmtInt(body.total_clicks) + ' clicks anchored to real controls' +
              (rev > 0 ? ' · ' + fmtMoney(rev) + ' revenue' : '') + '</span><br>' +
              '<span style="opacity:.7;display:block;margin-top:4px;">hover a product for its metrics</span>',
            false
          );
        },
        function () {
          // Element endpoint unavailable (older API) -> fall back to pixel mode.
          return pixelPass(0);
        }
      );
    }

    function pixelPass(i) {
      if (i >= candidates.length) {
        badge('No clicks recorded for this page yet.<br>Interact with the page, then re-run.', false);
        return;
      }
      fetchClicks(candidates[i]).then(
        function (body) {
          var data = (body && body.data) || [];
          if (data.length === 0) return pixelPass(i + 1);
          draw(data);
          var demo = data.some(function (c) {
            return c.data_source === 'demo';
          });
          var liveOnly = config().source === 'live';
          badge(
            '🔥 ' +
              data.length +
              (liveOnly ? ' live' : '') +
              ' clicks overlaid on this live page' +
              (demo ? ' <span style="background:#f59e0b;border-radius:4px;padding:0 6px;">DEMO</span>' : '') +
              (liveOnly ? ' <span style="background:#10b981;border-radius:4px;padding:0 6px;">LIVE</span>' : '') +
              '<br><span style="opacity:.7">positions from recorded x/y</span>',
            false
          );
        },
        function () {
          badge('Could not reach the analytics API.<br>Is the backend running?', true);
        }
      );
    }

    if (cfg.mode === 'pixels') return pixelPass(0);
    return elementPass(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
