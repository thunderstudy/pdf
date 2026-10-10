(function () {
  'use strict';
  var DEFAULT_PDF = '/assets/sample.pdf';
  var params = new URLSearchParams(location.search);
  var lib = window.TSPdf.lib;
  var book = document.querySelector('#book_pdf');
  var loading = document.querySelector('#reader-loading');
  var titleEl = document.querySelector('#reader-title');
  var title = params.get('title') || 'ThunderStudy PDF';
  function setTitle(t) { title = t; titleEl.textContent = t; document.title = t + ' | ThunderStudy PDF'; }
  setTitle(title);

  function fail(msg) {
    loading.innerHTML = '<div class="ds-state err"><div class="ds-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/></svg></div><h3>Couldn’t open this PDF</h3><p></p><a class="btn btn-primary" href="/pdf.html">Open another PDF</a></div>';
    loading.querySelector('p').textContent = msg;
  }
  function progress(text) { var s = loading.querySelector('span:last-child'); if (s) s.textContent = text; }

  /* download through the same-origin proxy, with progress, so the file can be saved in this browser */
  function fetchPdf(url) {
    return fetch(window.TSPdf.proxyUrl(url, title)).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) { throw new Error(t || ('The PDF host returned ' + r.status + '.')); });
      }
      var srcName = r.headers.get('x-pdf-name');
      if (srcName && !params.get('title')) { try { setTitle(decodeURIComponent(srcName)); } catch (e) {} }
      var total = +r.headers.get('content-length') || 0;
      if (!r.body || !r.body.getReader) return r.blob();
      var reader = r.body.getReader(), chunks = [], got = 0;
      return (function pump() {
        return reader.read().then(function (x) {
          if (x.done) return new Blob(chunks, { type: 'application/pdf' });
          chunks.push(x.value); got += x.value.length;
          progress(total ? 'Downloading your book… ' + Math.round(got / total * 100) + '%' : 'Downloading your book… ' + (got / 1048576).toFixed(1) + ' MB');
          return pump();
        });
      })();
    });
  }

  function resolve() {
    var id = params.get('id'), link = params.get('link');
    if (id) {
      return lib.get(id).then(function (item) {
        if (!item) throw new Error('This PDF is no longer saved in this browser. Open it again from the library.');
        if (params.get('title')) item.title = params.get('title');
        setTitle(item.title);
        if (item.blob) { lib.put({ id: id, title: item.title }); return item.blob; }
        if (item.url) return fetchAndSave(item.url, id);
        throw new Error('This saved PDF has no file.');
      });
    }
    if (link) {
      if (/fliphtml5\.com|flipbuilder\.com/i.test(link)) throw new Error('That link opens a flipbook webpage, not a PDF file. Paste the direct .pdf URL instead.');
      var bad = window.TSPdf.checkUrl(link); if (bad) throw new Error(bad);
      if (!params.get('title')) setTitle(window.TSPdf.driveId(link) ? 'Google Drive PDF' : window.TSPdf.titleFromUrl(link));
      var lid = lib.idFor(link);
      return lib.get(lid).catch(function () { return null; }).then(function (item) {
        if (item && item.blob) { lib.put({ id: lid, title: title, url: link }); return item.blob; }
        return fetchAndSave(link, lid);
      });
    }
    setTitle('Sample PDF');
    return fetch(DEFAULT_PDF).then(function (r) { return r.blob(); });
  }

  function fetchAndSave(url, id) {
    return fetchPdf(url).then(function (blob) {
      /* save in this browser under its title; if storage is full the book still opens */
      return lib.put({ id: id, title: title, url: url, blob: blob }).catch(function () {
        return lib.put({ id: id, title: title, url: url }).catch(function () {});
      }).then(function () { return blob; });
    });
  }

  function start() {
    Promise.resolve().then(resolve).then(function (blob) {
      var src = URL.createObjectURL(blob);
      book.setAttribute('source', src);
      window.option_book_pdf = { source: src, webgl: true, backgroundColor: 'transparent', sound: 'dflip/sound/turn.mp3', autoPlay: false, enableDownload: true, moreControls: 'pageMode,startPage,thumbnail,outline,more' };
      var script = document.createElement('script');
      script.src = 'dflip/js/dflip.min.js';
      script.onload = function () {
        if (loading) loading.remove();
        /* the toolbar's download button saves "<title>.pdf" */
        var n = 0, t = setInterval(function () {
          var a = document.querySelector('.df-ui-download');
          if (a) { a.setAttribute('download', window.TSPdf.fileName(title)); clearInterval(t); }
          if (++n > 40) clearInterval(t);
        }, 250);
      };
      script.onerror = function () { fail('The reader could not be loaded. Check your connection and try again.'); };
      document.body.appendChild(script);
    }).catch(function (e) { fail(e && e.message && e.message.length < 260 ? e.message : 'This PDF could not be opened.'); });
  }
  start();
})();
