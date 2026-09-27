export async function onRequestGet({ request }) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get('url');

  if (!target) {
    return new Response('Missing PDF URL.', { status: 400 });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response('Invalid PDF URL.', { status: 400 });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return new Response('Only HTTP(S) PDF URLs are supported.', { status: 400 });
  }

  const upstream = await fetch(targetUrl.toString(), {
    headers: { Accept: 'application/pdf,*/*;q=0.8' },
    redirect: 'follow'
  });

  if (!upstream.ok) {
    return new Response(`The PDF host returned ${upstream.status}.`, { status: upstream.status });
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    return new Response('The link returned a webpage, not a PDF file.', { status: 415 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
