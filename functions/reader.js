export function onRequest(context) {
  if (!context.env?.ASSETS?.fetch) {
    return new Response('Cloudflare Pages asset binding is not available.', { status: 500 });
  }

  const assetUrl = new URL('/reader.html', context.request.url);
  return context.env.ASSETS.fetch(new Request(assetUrl, context.request));
}
