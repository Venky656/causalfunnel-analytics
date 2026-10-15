/**
 * CausalFunnel Analytics — standalone tracking script.
 *
 * Installation (needs permission to instrument the target site):
 *
 *   <script
 *     async
 *     src="https://YOUR-BACKEND-DOMAIN/tracker.js"
 *     data-api-url="https://YOUR-BACKEND-DOMAIN/api/events">
 *   </script>
 *
 * What it collects (nothing else — no passwords, form contents, or page text):
 * - page_view: session_id, event_type, page_url, timestamp, viewport/page size
 * - click:     everything above plus x/y coordinates in document pixels,
 *              plus element identity (tag, id, classes, visible text or
 *              image alt, link target, nearest section) so the business
 *              knows exactly which text, image, card or button was clicked,
 *              plus a stable element_key and the element's box (element_rect)
 *              so heatmaps can anchor to a real control instead of a region.
 * - purchase:  recorded only via window.CausalFunnelAnalytics.purchase(), so
 *              the site decides what a conversion is. Carries revenue and items.
 *
 * Mark your own controls for stable analytics names:
 *   <button data-analytics-id="add-to-cart:sku-123">Add to cart</button>
 * This is preferred over scraped text because it survives copy and redesign.
 *
 * Sessions live in localStorage (`cf_session_id`) and are reused across
 * navigation. After 30 minutes of inactivity a new session is created.
 * SPA route changes (pushState/replaceState/popstate) emit one page_view
 * per route — the script guards against double-counting.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'cf_session_id';
  var ACTIVITY_KEY = 'cf_session_last_active';
  var INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  // Opt-out for embedded previews (e.g. heatmap iframes use ?notrack=1) so
  // rendering a preview never records phantom page views.
  try {
    if (/[?&]notrack=1\b/.test(window.location.search)) return;
  } catch (e) {}

  function currentScript() {
    if (document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  }

  function resolveEndpoint() {
    try {
      if (window.ANALYTICS_ENDPOINT) return window.ANALYTICS_ENDPOINT;
      var s = currentScript();
      if (s && s.getAttribute('data-api-url')) return s.getAttribute('data-api-url');
      if (s && s.src) return new URL('/api/events', s.src).toString();
    } catch (e) {}
    return 'http://localhost:5000/api/events';
  }

  var ENDPOINT = resolveEndpoint();

  function now() {
    return Date.now();
  }

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {}
  }

  function newId() {
    return 'sess_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function getSessionId() {
    var id = read(SESSION_KEY);
    var last = parseInt(read(ACTIVITY_KEY) || '0', 10);
    if (!id || !last || now() - last > INACTIVITY_TIMEOUT_MS) {
      id = (window.__cfSessionId = newId());
      write(SESSION_KEY, id);
    } else if (!window.__cfSessionId) {
      window.__cfSessionId = id;
    }
    write(ACTIVITY_KEY, String(now()));
    return window.__cfSessionId || id;
  }

  function touch() {
    write(ACTIVITY_KEY, String(now()));
  }

  function send(payload) {
    var body;
    try {
      body = JSON.stringify(payload);
    } catch (e) {
      return;
    }
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(ENDPOINT, blob)) return;
      }
    } catch (e) {}
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  // Analytics-only flags (?heatmap=1, ?notrack=1, ?cart=1) are stripped so
  // the stored page_url stays canonical and heat lookups match.
  function cleanUrl(href) {
    try {
      var u = new URL(href);
      u.searchParams.delete('heatmap');
      u.searchParams.delete('notrack');
      u.searchParams.delete('cart');
      return u.toString();
    } catch (e) {
      return href;
    }
  }

  function dims() {    var doc = document.documentElement;
    return {
      viewport_width: window.innerWidth || null,
      viewport_height: window.innerHeight || null,
      page_width: (doc && doc.scrollWidth) || null,
      page_height: (doc && doc.scrollHeight) || null,
    };
  }

  // Identify WHAT was clicked: tag, id, classes, visible text, link target
  // and nearest page section. Form field values, passwords and tokens are
  // NEVER collected — inputs only report their tag/type, never content.
  function clip(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s ? s.slice(0, n) : null;
  }

  // Deterministic fallback identity: hash of tag + stable classes + text/href,
// so the same control yields the same key across sessions even when it has no
// explicit data-analytics-id.
function hash32(s) {
    var h = 0;
    s = String(s);
    for (var i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return (h >>> 0).toString(36);
  }

  function autoKey(anchor, out) {
    var parts = [((anchor.tagName || '') + '').toUpperCase()];
    // Drop layout/styling classes (they churn with responsive design) but keep
    // semantic ones like 'product-card', 'filter-pill', 'add-to-cart'.
    var cls = anchor.className && typeof anchor.className === 'string'
      ? anchor.className.split(/\s+/).filter(Boolean).slice(0, 4).join('.')
      : '';
    if (cls) parts.push(cls);
    var t = clip(out.element_text || '', 60) || clip(anchor.getAttribute && anchor.getAttribute('href'), 60) || '';
    if (t) parts.push(t.toLowerCase());
    return 'auto:' + hash32(parts.join('|'));
  }

  // Heuristic: a product/card container is a strong anchor for its inner image,
  // title, price and add-to-cart button.
  function pnIsCard(node) {
    if (!node || !node.getAttribute) return false;
    var role = node.getAttribute('role');
    if (role === 'article' || role === 'listitem') return true;
    var t = ((node.tagName || '') + '').toUpperCase();
    if (t === 'ARTICLE' || t === 'LI') return true;
    var c = node.className && typeof node.className === 'string' ? node.className : '';
    return /(^|\s)(product|card|item|product-card|grid-item)(\s|$)/i.test(c);
  }

  function describeTarget(target) {
    var out = {
      element_tag: null,
      element_id: null,
      element_classes: null,
      element_text: null,
      element_href: null,
      element_section: null,
      element_key: null,
      element_rect: null,
    };
    try {
      var el = target;
      if (!el || el.nodeType !== 1) return out;
      var tag = ((el.tagName || '') + '').toUpperCase();
      var sensitive =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
      out.element_tag = tag || null;
      if (el.id) out.element_id = clip(el.id, 120);
      if (el.className && typeof el.className === 'string') {
        out.element_classes = clip(
          el.className.split(/\s+/).filter(Boolean).slice(0, 4).join(' '),
          200
        );
      }
      if (tag === 'IMG' && el.alt) out.element_text = clip(el.alt, 120);

      // Climb a few levels: the raw target may be a bare SPAN/SVG PATH
      // inside the real interactive element (link, button, card…).
      var node = el;
      var hops = 0;
      while (node && node !== document && hops < 4) {
        var tn = ((node.tagName || '') + '').toUpperCase();
        if (!sensitive && !out.element_text && tn !== 'INPUT' && tn !== 'TEXTAREA' && tn !== 'SELECT') {
          var t = node.innerText != null ? node.innerText : node.textContent;
          out.element_text = clip(t, 120) || out.element_text;
        }
        if (tn === 'A' && node.href && !out.element_href) {
          out.element_href = clip(node.href, 500);
        }
        if ((tn === 'BUTTON' || tn === 'A') && !sensitive) {
          out.element_tag = tn;
          if (node.id && !out.element_id) out.element_id = clip(node.id, 120);
          if (out.element_text) break;
        }
        node = node.parentElement;
        hops++;
      }

      // Approved analytics labels win over raw text: site owners can mark
      // key controls with data-analytics-label="Add to Cart" for clean,
      // privacy-safe names instead of scraped DOM text.
      var labeled = el.closest ? el.closest('[data-analytics-label]') : null;
      if (labeled) {
        var lab = clip(labeled.getAttribute('data-analytics-label'), 120);
        if (lab) out.element_text = lab;
        var ltag = ((labeled.tagName || '') + '').toUpperCase();
        if (ltag) out.element_tag = ltag;
        if (labeled.id && !out.element_id) out.element_id = clip(labeled.id, 120);
      }

      // ---- Stable element key (element-anchored heatmaps) ----
      // Preference order, most to least reliable:
      //   1. data-analytics-id  — app-owned, survives copy/visual changes
      //   2. data-analytics-label — human label, stable enough
      //   3. element id         — unique but styling-dependent
      //   4. deterministic hash of tag + first stable classes + text/href
      // The key is what lets a stored click be re-anchored to the exact same
      // DOM element later, so heat blobs land on real controls, not regions.
      var anchor = el.closest ? el.closest('[data-analytics-id],[data-analytics-label]') : null;
      if (!anchor) {
        // No marked ancestor: prefer a real interactive node within a few hops.
        var probe = el;
        var phops = 0;
        while (probe && probe !== document && phops < 4) {
          var ptn = ((probe.tagName || '') + '').toUpperCase();
          if (
            probe.hasAttribute &&
            (probe.hasAttribute('data-analytics-id') || probe.hasAttribute('data-analytics-label'))
          ) {
            anchor = probe;
            break;
          }
          if (ptn === 'A' || ptn === 'BUTTON' || ptn === 'IMG' || pnIsCard(probe)) {
            anchor = anchor || probe;
          }
          probe = probe.parentElement;
          phops++;
        }
      }
      if (anchor) {
        var explicit = anchor.getAttribute
          ? clip(anchor.getAttribute('data-analytics-id'), 160)
          : null;
        if (explicit) {
          out.element_key = explicit;
        } else {
          var aLabel = clip(anchor.getAttribute && anchor.getAttribute('data-analytics-label'), 120);
          var aId = clip(anchor.id, 120);
          if (aId) out.element_key = 'id:' + aId;
          else if (aLabel) out.element_key = 'label:' + aLabel.toLowerCase();
          else out.element_key = autoKey(anchor, out);
        }
        // The element's own text is a better display name than scraped noise.
        var aText = clip(anchor.innerText != null ? anchor.innerText : anchor.textContent, 120);
        if (aText && (!out.element_text || out.element_text.length > aText.length)) {
          out.element_text = aText;
        }
        // Capture the box so the overlay can rescale the blob to the element's
        // current position (document pixels, matching x/y).
        try {
          var r = anchor.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) {
            var sx = window.pageXOffset || document.documentElement.scrollLeft || 0;
            var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
            out.element_rect = {
              x: Math.round(r.left + sx),
              y: Math.round(r.top + sy),
              w: Math.round(r.width),
              h: Math.round(r.height),
            };
          }
        } catch (e2) {}
      }

      var zone = el.closest
        ? el.closest('[data-track-section], section, article, header, footer, nav, main')
        : null;
      if (zone) {
        out.element_section = clip(
          zone.getAttribute('data-track-section') ||
            zone.getAttribute('aria-label') ||
            zone.id ||
            (zone.tagName || '').toLowerCase(),
          120
        );
      }
    } catch (e) {}
    return out;
  }

  function basePayload() {
    var p = {
      session_id: getSessionId(),
      page_url: cleanUrl(window.location.href),
      timestamp: new Date().toISOString(),
      data_source: 'live',
    };
    var d = dims();
    for (var k in d) p[k] = d[k];
    return p;
  }

  var lastTrackedUrl = null;
  function trackPageView() {
    var url = window.location.href;
    if (url === lastTrackedUrl) return; // guard against double-counting
    lastTrackedUrl = url;
    var p = basePayload();
    p.event_type = 'page_view';
    send(p);
  }

  // Initial page load.
  trackPageView();

  // SPA route changes: history API + back/forward buttons.
  function patchHistory(method) {
    var original = history[method];
    if (!original || original.__cfPatched) return;
    var wrapped = function () {
      var result = original.apply(this, arguments);
      window.setTimeout(trackPageView, 0);
      return result;
    };
    wrapped.__cfPatched = true;
    history[method] = wrapped;
  }
  try {
    patchHistory('pushState');
    patchHistory('replaceState');
    window.addEventListener('popstate', function () {
      window.setTimeout(trackPageView, 0);
    });
  } catch (e) {}

  // Clicks with document-pixel coordinates + element identity.
  document.addEventListener(
    'click',
    function (e) {
      touch();
      var p = basePayload();
      p.event_type = 'click';
      p.x = e.pageX !== undefined && e.pageX !== null ? e.pageX : e.clientX;
      p.y = e.pageY !== undefined && e.pageY !== null ? e.pageY : e.clientY;
      var el = describeTarget(e.target);
      for (var k in el) p[k] = el[k];
      send(p);
    },
    { capture: true, passive: true }
  );

  // Public API — record a conversion so element heatmaps can report revenue,
  // AOV and conversion rate (not just clicks).
  //
  //   window.CausalFunnelAnalytics.purchase({
  //     revenue: 219.48,
  //     currency: 'USD',
  //     elementKey: 'product:aero-headphones', // optional: attribute to an element
  //     items: [{ product_id: 'aero-headphones', name: 'Aero…', qty: 1, unit_price: 149 }],
  //   });
  window.CausalFunnelAnalytics = {
    purchase: function (opts) {
      opts = opts || {};
      var p = basePayload();
      p.event_type = 'purchase';
      p.revenue = Number(opts.revenue);
      if (!isFinite(p.revenue)) return false;
      p.currency = opts.currency || 'USD';
      if (opts.order_id) p.order_id = String(opts.order_id).slice(0, 64);
      if (Array.isArray(opts.items)) p.items = opts.items.slice(0, 100);
      if (opts.elementKey) {
        p.element_key = String(opts.elementKey).slice(0, 160);
        p.element_tag = p.element_tag || 'A';
      }
      send(p);
      return true;
    },
  };
})();
