/* ThunderStudy PDF helpers shared by the library, the open-a-PDF page and the reader.
   - TSPdf.readerUrl(url, title)   link that opens a PDF in the flipbook reader
   - TSPdf.download(url, title)    saves the PDF to the device as "<title>.pdf"
   - TSPdf.lib                     PDFs saved in this browser (IndexedDB) with their titles */
(function () {
  'use strict';

  function say(msg) { if (window.ThunderUI && window.ThunderUI.say) window.ThunderUI.say(msg); }

  function fileName(title) {
    var t = String(title || 'ThunderStudy PDF').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
    return (t || 'ThunderStudy PDF').slice(0, 150) + '.pdf';
  }

  /* "https://x.com/My%20Book_v2.pdf" -> "My Book v2" */
  function titleFromUrl(url) {
    try {
      var last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '');
      last = last.replace(/\.pdf$/i, '').replace(/[_+]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (last) return last.replace(/(^|\s)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
    } catch (e) {}
    return 'Linked PDF';
  }

  /* Google Drive: share links (/file/d/ID/view, open?id=, uc?id=) become a direct download link.
     Folders cannot be read as one PDF. */
  function driveId(url) {
    try {
      var u = new URL(url);
      if (!/(^|\.)(drive|docs)\.google\.com$/.test(u.hostname)) return null;
      var m = u.pathname.match(/\/file\/(?:u\/\d+\/)?d\/([\w-]{10,})/) || u.pathname.match(/\/d\/([\w-]{10,})/);
      return (m && m[1]) || u.searchParams.get('id') || null;
    } catch (e) { return null; }
  }
  function isDriveFolder(url) { return /drive\.google\.com\/(drive\/(u\/\d+\/)?)?folders\//.test(url) || /drive\.google\.com\/drive\/u\/\d+\/?$/.test(url); }
  function normalize(url) {
    var d = String(url).match(/^https:\/\/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([\w-]{10,})/);
    if (d) return 'https://docs.google.com/' + d[1] + '/d/' + d[2] + '/export?format=pdf';
    var id = driveId(url);
    return id ? 'https://drive.usercontent.google.com/download?id=' + encodeURIComponent(id) + '&export=download&confirm=t' : url;
  }
  function checkUrl(url) {
    if (isDriveFolder(url)) return 'That is a Google Drive folder. Open the PDF inside it, tap Share, set "Anyone with the link" and paste that file\u2019s link.';
    return '';
  }

  function readerUrl(url, title) {
    var t = title || (driveId(url) ? '' : titleFromUrl(url));
    return '/reader?link=' + encodeURIComponent(url) + (t ? '&title=' + encodeURIComponent(t) : '');
  }

  function proxyUrl(url, title, asDownload) {
    return '/api/pdf?url=' + encodeURIComponent(normalize(url)) + '&name=' + encodeURIComponent(fileName(title)) + (asDownload ? '&download=1' : '');
  }

  function saveBlob(blob, name) {
    var a = document.createElement('a');
    var u = URL.createObjectURL(blob);
    a.href = u; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
  }

  /* Cross-origin links cannot use <a download>, so fetch the file and save it under the book title.
     If the host blocks CORS, the same-origin /api/pdf proxy sends it with a Content-Disposition filename. */
  function download(url, title, btn) {
    var name = fileName(title);
    if (btn) { btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true'); }
    function done() { if (btn) { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); } }
    function viaProxy() {
      var a = document.createElement('a');
      a.href = proxyUrl(url, title, true); a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      say('Saving ' + name);
      setTimeout(done, 1500);
    }
    say('Downloading ' + name + '…');
    return fetch(normalize(url), { mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (blob) {
      if (!blob.size || /text\/html/i.test(blob.type)) throw new Error('not a pdf');
      saveBlob(blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }), name);
      say('Saved ' + name);
      done();
    }).catch(viaProxy);
  }

  /* ---------- PDFs saved in this browser ---------- */
  var DB = 'thunderstudy-library', STORE = 'items';
  function open() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), s = t.objectStore(STORE), out = fn(s);
        t.oncomplete = function () { db.close(); res(out && out.result !== undefined ? out.result : undefined); };
        t.onerror = t.onabort = function () { db.close(); rej(t.error); };
      });
    });
  }
  function hash(str) {
    var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'l' + (h >>> 0).toString(36);
  }
  var lib = {
    idFor: function (url) { return hash(url); },
    get: function (id) { return tx('readonly', function (s) { return s.get(id); }); },
    list: function () {
      return tx('readonly', function (s) { return s.getAll(); }).then(function (a) {
        return (a || []).sort(function (x, y) { return (y.savedAt || 0) - (x.savedAt || 0); });
      });
    },
    /* item: {id, title, url?, blob?}. Keeps an existing blob when the new item has none. */
    put: function (item) {
      return lib.get(item.id).catch(function () { return null; }).then(function (old) {
        var rec = Object.assign({}, old || {}, item, { savedAt: Date.now() });
        rec.size = rec.blob ? rec.blob.size : (rec.size || 0);
        return tx('readwrite', function (s) { s.put(rec); }).then(function () { return rec; });
      });
    },
    remove: function (id) { return tx('readwrite', function (s) { s.delete(id); }); },
    clear: function () { return tx('readwrite', function (s) { s.clear(); }); }
  };
  if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) {} }

  window.TSPdf = { normalize: normalize, driveId: driveId, checkUrl: checkUrl, fileName: fileName, titleFromUrl: titleFromUrl, readerUrl: readerUrl, proxyUrl: proxyUrl, download: download, saveBlob: saveBlob, lib: lib };
})();
