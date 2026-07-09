'use strict';

// ======================================
// GO LIVE — LIVE-RELOAD CLIENT | MARK: INJECT
// ======================================
//
// A tiny client injected into every served HTML document. It opens a
// WebSocket back to the dev server and, on a file change, either reloads the
// page or hot-swaps stylesheets (CSS changes without a full reload). It also
// survives server restarts: while disconnected it silently retries, and
// reloads once the server comes back so the page always reflects the latest
// build.

/** Dedicated upgrade path so we never collide with an app's own WebSockets. */
export const RELOAD_PATH = '/__atm-go-live';

// Kept as a plain string (not a webview asset) so it needs no bundling or
// packaging rules — it is spliced straight into the HTML byte stream.
const CLIENT = `(function () {
  if (window.__atmGoLive) return;
  window.__atmGoLive = true;
  var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  var url = proto + location.host + '${RELOAD_PATH}';
  var connectedOnce = false;
  var retry;

  function reloadCss() {
    var links = document.querySelectorAll('link[rel="stylesheet"][href]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      try {
        var next = new URL(link.href, location.href);
        next.searchParams.set('__atm', Date.now().toString());
        var clone = link.cloneNode();
        clone.href = next.href;
        // Swap once the fresh sheet is ready to avoid a flash of unstyled content.
        clone.onload = function () { if (link.parentNode) link.parentNode.removeChild(link); };
        link.parentNode.insertBefore(clone, link.nextSibling);
      } catch (e) { location.reload(); return; }
    }
  }

  function connect() {
    var socket;
    try { socket = new WebSocket(url); } catch (e) { schedule(); return; }

    socket.onopen = function () {
      // A reconnect means the server restarted while we were away -> refresh.
      if (connectedOnce) location.reload();
      connectedOnce = true;
    };
    socket.onmessage = function (event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      if (msg.type === 'reload') location.reload();
      else if (msg.type === 'css') reloadCss();
    };
    socket.onclose = schedule;
    socket.onerror = function () { try { socket.close(); } catch (e) {} };
  }

  function schedule() {
    clearTimeout(retry);
    // While the server is down we just keep polling; no reload happens until a
    // connection actually succeeds, so a stopped server never loops the page.
    retry = setTimeout(connect, 1000);
  }

  connect();
})();`;

const SNIPPET = `\n<!-- ATM Go Live -->\n<script>\n${CLIENT}\n</script>\n`;

/**
 * Inject the reload client into an HTML document. Prefer inserting right
 * before </body> (falls back to </html>, then to appending) so the script
 * runs after the page's own markup.
 */
export function injectReloadClient(html: string): string {
  const lower = html.toLowerCase();
  const bodyClose = lower.lastIndexOf('</body>');
  if (bodyClose !== -1) {
    return html.slice(0, bodyClose) + SNIPPET + html.slice(bodyClose);
  }
  const htmlClose = lower.lastIndexOf('</html>');
  if (htmlClose !== -1) {
    return html.slice(0, htmlClose) + SNIPPET + html.slice(htmlClose);
  }
  return html + SNIPPET;
}
