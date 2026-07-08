(function(){
  const LOGO = '/assets/branding/icon-192.png';
  const LOGO_MAIN = '/assets/branding/logo-main.png';

  function ensureCss(){
    if (document.querySelector('link[href="assets/logo-branding.css"],link[href="/assets/logo-branding.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/logo-branding.css';
    document.head.appendChild(link);
  }

  function hasImg(el, cls){
    return Boolean(el && el.querySelector(`img.${cls}`));
  }

  function install(){
    ensureCss();

    document.querySelectorAll('.brand').forEach((brand) => {
      if (hasImg(brand, 'jaxtri-brand-logo')) return;
      const img = document.createElement('img');
      img.src = LOGO;
      img.alt = 'Jaxtri Labs Academy';
      img.className = 'jaxtri-brand-logo';
      img.loading = 'eager';
      brand.prepend(img);
    });

    document.querySelectorAll('.side-brand').forEach((brand) => {
      if (hasImg(brand, 'jaxtri-side-logo')) return;
      const old = brand.querySelector('.side-mark');
      if (old) old.remove();
      const img = document.createElement('img');
      img.src = LOGO;
      img.alt = 'Jaxtri Labs Academy';
      img.className = 'jaxtri-side-logo';
      img.loading = 'eager';
      brand.prepend(img);
    });

    document.querySelectorAll('[data-jaxtri-logo-slot]').forEach((slot) => {
      if (slot.querySelector('img')) return;
      const img = document.createElement('img');
      img.src = slot.dataset.logoMain === '1' ? LOGO_MAIN : LOGO;
      img.alt = 'Jaxtri Labs Academy';
      img.loading = 'eager';
      slot.appendChild(img);
    });
  }

  window.installJaxtriBranding = install;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
