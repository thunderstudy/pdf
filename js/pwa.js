/* Registers the service worker and wires up the optional "Install app" buttons. */
(function(){
  var secure=location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
  if('serviceWorker' in navigator&&secure){
    window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})});
  }
  var deferred=null;
  function toggle(show){document.querySelectorAll('[data-install]').forEach(function(b){b.hidden=!show})}
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;toggle(true)});
  window.addEventListener('appinstalled',function(){deferred=null;toggle(false)});
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('[data-install]');if(!b||!deferred)return;
    deferred.prompt();deferred.userChoice.finally(function(){deferred=null;toggle(false)});
  });
})();
