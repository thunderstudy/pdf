export async function onRequest({ request }) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('url');
  const cors = { 'Access-Control-Allow-Origin': '*' };

  if (!target) {
    return new Response('A PDF URL is required.', { status: 400, headers: cors });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response('The PDF URL is invalid.', { status: 400, headers: cors });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return new Response('Only HTTP and HTTPS PDF URLs are supported.', { status: 400, headers: cors });
  }

  try {
    const upstream = await fetch(targetUrl, {
      redirect: 'follow',
      headers: {
        Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 ThunderStudy PDF Reader'
      }
    });

    if (!upstream.ok) {
      return new Response(`The PDF host returned ${upstream.status}.`, {
        status: 502,
        headers: cors
      });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return new Response('The link returned a webpage, not a PDF file. For Google Drive, set sharing to "Anyone with the link".', {
        status: 415,
        headers: cors
      });
    }

    const headers = new Headers(cors);
    headers.set('Content-Type', 'application/pdf');
    headers.set('Cache-Control', 'public, max-age=3600');
    const name = (requestUrl.searchParams.get('name') || '').replace(/[\r\n"\\]+/g, ' ').trim();
    const kind = requestUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline';
    if (name) {
      const ascii = name.replace(/[^\x20-\x7e]+/g, '_');
      headers.set('Content-Disposition', `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    } else {
      headers.set('Content-Disposition', kind);
    }
    const up = upstream.headers.get('content-disposition') || '';
    const m = up.match(/filename\*=UTF-8''([^;]+)/i) || up.match(/filename="?([^";]+)"?/i);
    if (m) { try { headers.set('X-Pdf-Name', encodeURIComponent(decodeURIComponent(m[1]).replace(/\.pdf$/i, ''))); } catch {} }
    headers.set('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, X-Pdf-Name');
    const len = upstream.headers.get('content-length');
    if (len && !upstream.headers.get('content-encoding')) headers.set('Content-Length', len);
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return new Response('Unable to access the PDF host.', { status: 502, headers: cors });
  }
}
