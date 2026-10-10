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
      return new Response('The link returned a webpage, not a PDF file.', {
        status: 415,
        headers: cors
      });
    }

    const headers = new Headers(cors);
    headers.set('Content-Type', 'application/pdf');
    headers.set('Cache-Control', 'public, max-age=3600');
    headers.set('Content-Disposition', 'inline');
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return new Response('Unable to access the PDF host.', { status: 502, headers: cors });
  }
}
