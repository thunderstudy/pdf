import{proxyPdf}from'../../js/pdf-proxy.js';

export async function onRequest({request}){
  const url=new URL(request.url);
  return proxyPdf(url.searchParams.get('url'));
}
