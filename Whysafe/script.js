(function(){
  const toggle = document.querySelector('.theme-toggle');
  const root = document.documentElement;
  const logoImg = document.querySelector('.logo img');
  const footerLogo = document.querySelector('.footer-logo');

  function fadeTo(el, src) {
    if (!el) return;
    el.style.opacity = 0;
    setTimeout(() => { el.src = src; el.style.opacity = 1; }, 220);
  }

  function updateLogo(theme) {
    const src = theme === 'dark' ? 'Elementi/WHISAFE1.png' : 'Elementi/WHISAFE3.png';
    fadeTo(logoImg, src);
    fadeTo(footerLogo, src);
  }

  function setTheme(theme) {
    if (theme === 'dark') {
      root.setAttribute('data-theme','dark');
      if (toggle) { toggle.textContent = '☀️'; toggle.setAttribute('aria-label','Switch to light mode'); }
    } else {
      root.removeAttribute('data-theme');
      if (toggle) { toggle.textContent = '🌙'; toggle.setAttribute('aria-label','Switch to dark mode'); }
    }
    updateLogo(theme);
  }

  // Initialize theme from localStorage, or system preference
  const stored = localStorage.getItem('theme');
  if (stored) {
    setTheme(stored);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark');
  } else {
    setTheme('light');
  }

  // Toggle on click
  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
      localStorage.setItem('theme', next);
    });
  }

  // Optional: respond to system preference changes if user hasn't set a manual preference
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
      }
    });
  }

  /* ----------------- URL Checker ----------------- */
  function analyzeUrl(input) {
    const details = [];
    let score = 100;
    let urlStr = input.trim();

    // try to normalize
    if (!/^https?:\/\//i.test(urlStr)) {
      // try adding scheme to allow parsing
      urlStr = 'http://' + urlStr;
    }

    let urlObj;
    try {
      urlObj = new URL(urlStr);
    } catch (e) {
      details.push({rule:'valid', passed:false, weight:100, message:'URL non valido'});
      return { score:0, details };
    }

    // HTTPS check
    if (urlObj.protocol !== 'https:') {
      score -= 30; details.push({rule:'https', passed:false, weight:30, message:'Non usa HTTPS'});
    } else {
      details.push({rule:'https', passed:true, weight:0, message:'Usa HTTPS'});
    }

    // IP address instead of hostname
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(urlObj.hostname)) {
      score -= 25; details.push({rule:'ip', passed:false, weight:25, message:'Usa un indirizzo IP come host'});
    }

    // punycode
    if (urlObj.hostname.startsWith('xn--')) {
      score -= 10; details.push({rule:'punycode', passed:false, weight:10, message:'Hostname in punycode (possibile phishing)'});
    }

    // long url
    if (input.length > 75) {
      score -= 20; details.push({rule:'length', passed:false, weight:20, message:'URL molto lungo'});
    }

    // suspicious characters
    if (/[\@]/.test(input)) {
      score -= 15; details.push({rule:'at', passed:false, weight:15, message:"Contiene '@' (carattere sospetto)"});
    }

    // many dashes in host
    const dashCount = (urlObj.hostname.match(/-/g) || []).length;
    if (dashCount > 4) { score -= 10; details.push({rule:'dashes', passed:false, weight:10, message:'Molti trattini nel dominio'}); }

    // long query
    if (urlObj.search.length > 100) { score -= 10; details.push({rule:'query', passed:false, weight:10, message:'Query string molto lunga'}); }

    // ensure score bounds
    if (score < 0) score = 0;

    // add positive notes for checks passed
    if (urlObj.protocol === 'https:') {
      details.push({rule:'https-positive', passed:true, weight:0, message:'Connessione cifrata (HTTPS)'});
    }

    return { score, details };
  }

  function renderResult(report) {
    const resultEl = document.getElementById('result');
    const scoreValue = document.getElementById('scoreValue');
    const scoreLabel = document.getElementById('scoreLabel');
    const reasons = document.getElementById('reasons');

    if (!resultEl || !scoreValue || !reasons) return;

    // show result container
    resultEl.classList.remove('hidden');

    const s = report.score;
    scoreValue.textContent = s + '%';

    // color
    let color = '#7fc97f';
    let label = 'Sicuro';
    if (s >= 75) { color = '#4caf50'; label='Sicuro'; }
    else if (s >= 50) { color = '#ffb74d'; label='Sospetto'; }
    else { color = '#ff6b6b'; label='Pericoloso'; }

    scoreValue.style.background = color;
    scoreLabel.textContent = label;

    // reasons
    reasons.innerHTML = '';
    report.details.forEach(d => {
      const li = document.createElement('li');
      li.className = d.passed ? 'pass' : 'fail';
      li.textContent = (d.passed ? '✓ ' : '✕ ') + d.message + (d.passed || !d.weight ? '' : ` (−${d.weight}%)`);
      reasons.appendChild(li);
    });
  }

  // Hook form
  const form = document.getElementById('urlForm');
  const input = document.getElementById('urlInput');
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return input.focus();
      const report = analyzeUrl(val);
      renderResult(report);
    });
  }

})();