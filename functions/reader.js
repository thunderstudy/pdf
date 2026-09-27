async function servePage(context, filename) {
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = `/${filename}`;
  const request = new Request(assetUrl, context.request);
  return context.env?.ASSETS?.fetch ? context.env.ASSETS.fetch(request) : fetch(request);
}

export function onRequest(context) {
  return servePage(context, 'reader.html');
}
