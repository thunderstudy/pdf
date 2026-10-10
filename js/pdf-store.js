/* Local PDF library: every PDF the reader opens or the user downloads is kept on this device (IndexedDB) under its title.
   Shared by the home page, the open-a-PDF page and the reader. */
(function () {
  'use strict';
  var DB = 'thunderstudy-reader', VER = 2;

  function db() {
    return new Promise(function (resolve, reject) {
      var r = indexedDB.open(DB, VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('documents')) d.createObjectStore('documents');
        if (!d.objectStoreNames.contains('saved')) d.createObjectStore('saved', { keyPath: 'key' });
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(store, mode), out = fn(t.objectStore(store));
        t.oncomplete = function () { resolve(out && 'result' in out ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  /* "Title" -> "Title.pdf", safe for every OS */
  function fileName(title) {
    var n = String(title || 'document').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document';
    return /\.pdf$/i.test(n) ? n : n + '.pdf';
  }
  /* readable title from a PDF address, e.g. .../HOME%20SCIENCE%20QB_compressed.pdf -> "HOME SCIENCE QB compressed" */
  function titleFromUrl(url) {
    try {
      var last = decodeURIComponent(new URL(url, location.href).pathname.split('/').filter(Boolean).pop() || '');
      return last.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Linked PDF';
    } catch (e) { return 'Linked PDF'; }
  }
  function isRemote(url) { return /^https?:\/\//i.test(url); }

  /* fetch through the same-origin proxy so any host works (CORS) */
  function fetchPdf(url, onProgress) {
    var src = isRemote(url) ? '/api/pdf?url=' + encodeURIComponent(url) : url;
    return fetch(src).then(function (res) {
      if (!res.ok) throw new Error('The PDF host returned ' + res.status + '.');
      var total = +res.headers.get('content-length') || 0;
      if (!res.body || !onProgress || !total) return res.blob();
      var reader = res.body.getReader(), chunks = [], got = 0;
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) return new Blob(chunks, { type: 'application/pdf' });
          chunks.push(r.value); got += r.value.length; onProgress(got / total);
          return pump();
        });
      })();
    }).then(function (blob) {
      if (blob.type && /text\/html/i.test(blob.type)) throw new Error('The link returned a webpage, not a PDF file.');
      return blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    });
  }

  function save(entry) {
    var rec = { key: entry.key, title: entry.title, url: entry.url || '', size: entry.blob.size, savedAt: Date.now(), blob: entry.blob };
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    return tx('saved', 'readwrite', function (s) { s.put(rec); }).then(function () { return rec; });
  }
  function get(key) {
    return tx('saved', 'readonly', function (s) { return s.get(key); });
  }
  function remove(key) { return tx('saved', 'readwrite', function (s) { s.delete(key); }); }
  /* metadata only, newest first */
  function list() {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var out = [], req = d.transaction('saved', 'readonly').objectStore('saved').openCursor();
        req.onsuccess = function () {
          var c = req.result;
          if (!c) { out.sort(function (a, b) { return b.savedAt - a.savedAt; }); return resolve(out); }
          var v = c.value; out.push({ key: v.key, title: v.title, url: v.url, size: v.size, savedAt: v.savedAt }); c.continue();
        };
        req.onerror = function () { reject(req.error); };
      });
    });
  }
  function keys() { return list().then(function (l) { return l.map(function (x) { return x.key; }); }); }

  /* hand the blob to the browser as a real file named after the title */
  function download(blob, title) {
    var a = document.createElement('a'), u = URL.createObjectURL(blob);
    a.href = u; a.download = fileName(title);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  /* saved copy if we have one, otherwise fetch it; either way it ends up saved locally with its title */
  function ensure(url, title, onProgress) {
    return get(url).catch(function () { return null; }).then(function (rec) {
      if (rec && rec.blob) return { blob: rec.blob, cached: true };
      return fetchPdf(url, onProgress).then(function (blob) {
        return save({ key: url, title: title, url: url, blob: blob }).catch(function () {}).then(function () { return { blob: blob, cached: false }; });
      });
    });
  }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  window.PdfStore = { fileName: fileName, titleFromUrl: titleFromUrl, isRemote: isRemote, fetchPdf: fetchPdf, save: save, get: get, remove: remove, list: list, keys: keys, download: download, ensure: ensure, fmtSize: fmtSize };
})();
