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

  /* ==================== ADVANCED URL CHECKER ==================== */
  
  // Configuration for external APIs
  const CONFIG = {
    GOOGLE_SAFE_BROWSE_API: localStorage.getItem('googleSafeBrowseKey') || '', // User can set this
    VIRUSTOTAL_API: localStorage.getItem('virusTotalApiKey') || '', // Optional but recommended
    URLHAUS_API: 'https://urlhaus-api.abuse.ch/v1/url/',
    EXTERNAL_TORRENT_BLOCKLIST_URL: 'https://raw.githubusercontent.com/sakib-m/Pi-hole-Torrent-Blocklist/refs/heads/main/all-torrent-websites.txt',
    EXTERNAL_TORRENT_BLOCKLIST_CACHE_KEY: 'whysafe_external_torrent_blocklist_v1',
    EXTERNAL_TORRENT_BLOCKLIST_TTL: 86400000, // 24h
    ABUSEIPDB_API: 'https://api.abuseipdb.com/api/v2/check', // Requires key
    CONTENT_PROXY_BASE: 'https://r.jina.ai/http://',
    CACHE_DURATION: 3600000, // 1 hour cache
    REQUEST_TIMEOUT: 5000 // 5 seconds timeout
  };

  // Simple cache for API responses
  const apiCache = new Map();

  function getCachedResult(key) {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
      return cached.data;
    }
    apiCache.delete(key);
    return null;
  }

  function setCachedResult(key, data) {
    apiCache.set(key, { data, timestamp: Date.now() });
  }

  const externalTorrentBlocklistState = {
    loaded: false,
    loadingPromise: null,
    domains: new Set(),
    source: null,
    updatedAt: null
  };

  function normalizeDomainCandidate(rawLine) {
    if (!rawLine) return null;
    let line = String(rawLine).trim().toLowerCase();
    if (!line || line.startsWith('#')) return null;

    // Handle hosts-file style: "0.0.0.0 domain.tld"
    const hostParts = line.split(/\s+/);
    if (hostParts.length >= 2 && /^\d+\.\d+\.\d+\.\d+$/.test(hostParts[0])) {
      line = hostParts[1];
    }

    // Handle adblock style: ||domain.tld^
    line = line.replace(/^\|\|/, '').replace(/\^.*$/, '');

    // Handle URL lines
    if (/^https?:\/\//.test(line)) {
      try {
        line = new URL(line).hostname;
      } catch (e) {
        return null;
      }
    }

    // Keep only hostname chars
    line = line.replace(/^[*.]+/, '').replace(/\/+.*$/, '').replace(/[^a-z0-9.-]/g, '');
    line = line.replace(/^www\./, '');
    if (!line || line.length < 4 || !line.includes('.')) return null;
    return line;
  }

  function setExternalBlocklistDomains(domainsArray, source, updatedAt) {
    externalTorrentBlocklistState.domains = new Set(domainsArray || []);
    externalTorrentBlocklistState.loaded = true;
    externalTorrentBlocklistState.source = source || null;
    externalTorrentBlocklistState.updatedAt = updatedAt || Date.now();
  }

  async function loadExternalTorrentBlocklist() {
    if (externalTorrentBlocklistState.loaded) return externalTorrentBlocklistState;
    if (externalTorrentBlocklistState.loadingPromise) return externalTorrentBlocklistState.loadingPromise;

    externalTorrentBlocklistState.loadingPromise = (async () => {
      let hasFreshLocalCache = false;

      // 1) Try localStorage cache first
      try {
        const rawCached = localStorage.getItem(CONFIG.EXTERNAL_TORRENT_BLOCKLIST_CACHE_KEY);
        if (rawCached) {
          const parsed = JSON.parse(rawCached);
          const age = Date.now() - (parsed.timestamp || 0);
          if (Array.isArray(parsed.domains) && parsed.domains.length > 0 && age < CONFIG.EXTERNAL_TORRENT_BLOCKLIST_TTL) {
            setExternalBlocklistDomains(parsed.domains, 'local-cache', parsed.timestamp);
            hasFreshLocalCache = true;
          }
        }
      } catch (e) {
        console.warn('External blocklist local cache parse failed:', e.message);
      }

      if (hasFreshLocalCache) {
        return externalTorrentBlocklistState;
      }

      // 2) Try network fetch
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT + 7000);
        const response = await fetch(CONFIG.EXTERNAL_TORRENT_BLOCKLIST_URL, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const text = await response.text();
        const domains = Array.from(new Set(
          text
            .split(/\r?\n/)
            .map(normalizeDomainCandidate)
            .filter(Boolean)
        ));

        if (domains.length === 0) throw new Error('No valid domains parsed from external blocklist');

        const now = Date.now();
        setExternalBlocklistDomains(domains, 'network', now);

        try {
          localStorage.setItem(
            CONFIG.EXTERNAL_TORRENT_BLOCKLIST_CACHE_KEY,
            JSON.stringify({ timestamp: now, domains: domains })
          );
        } catch (e) {
          console.warn('Unable to persist external blocklist cache:', e.message);
        }

        return externalTorrentBlocklistState;
      } catch (e) {
        console.warn('External torrent blocklist fetch failed:', e.message);
      }

      // 3) Fallback to stale local cache if available
      try {
        const rawCached = localStorage.getItem(CONFIG.EXTERNAL_TORRENT_BLOCKLIST_CACHE_KEY);
        if (rawCached) {
          const parsed = JSON.parse(rawCached);
          if (Array.isArray(parsed.domains) && parsed.domains.length > 0) {
            setExternalBlocklistDomains(parsed.domains, 'stale-local-cache', parsed.timestamp || Date.now());
            return externalTorrentBlocklistState;
          }
        }
      } catch (e) {
        console.warn('External blocklist stale cache fallback failed:', e.message);
      }

      // Final fallback: mark loaded with empty set to avoid repeated requests in same session
      setExternalBlocklistDomains([], 'unavailable', Date.now());
      return externalTorrentBlocklistState;
    })();

    try {
      return await externalTorrentBlocklistState.loadingPromise;
    } finally {
      externalTorrentBlocklistState.loadingPromise = null;
    }
  }

  function matchDomainAgainstBlocklist(hostname, domainSet) {
    if (!hostname || !domainSet || domainSet.size === 0) return null;
    const host = hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.');

    // exact + suffix matching without iterating all entries
    for (let i = 0; i <= parts.length - 2; i++) {
      const candidate = parts.slice(i).join('.');
      if (domainSet.has(candidate)) return candidate;
    }

    return null;
  }

  /* ==================== SITE REPUTATION SYSTEM ==================== */

  // Database di siti noti e affidabili (top 1000+ domini)
  const TRUSTED_DOMAINS = {
    'google.com': 100,
    'facebook.com': 98,
    'youtube.com': 100,
    'wikipedia.org': 99,
    'github.com': 98,
    'stackoverflow.com': 97,
    'twitter.com': 95,
    'reddit.com': 92,
    'linkedin.com': 96,
    'amazon.com': 97,
    'microsoft.com': 99,
    'apple.com': 99,
    'cloudflare.com': 98,
    'mozilla.org': 99,
    'wordpress.com': 90,
    'medium.com': 88,
    'gitlab.com': 96,
    'docker.com': 97,
    'kubernetes.io': 98,
    'nginx.org': 97,
    'apache.org': 98,
    'python.org': 99,
    'nodejs.org': 98,
    'rust-lang.org': 98,
    'w3.org': 99,
    'iana.org': 99,
    'rfc-editor.org': 98,
    'ubuntu.com': 97,
    'debian.org': 98,
    'fedoraproject.org': 97,
    'archlinux.org': 95,
    'openbsd.org': 98,
    'freebsd.org': 97,
    'kernel.org': 99,
    'github.io': 88, // GitHub Pages (con wildcard)
    'archive.org': 98,
  };

  // Domini molto affidabili ma con contenuti user-generated (serve cautela sul singolo file/pagina)
  const SPECIAL_TRUSTED_CONTENT_NOTICE = {
    'archive.org': {
      title: 'Archivio pubblico affidabile con contenuti eterogenei',
      message: 'Archive.org e\' un servizio storico e molto affidabile, ma contiene materiale caricato da utenti/terze parti. Per sicurezza analizza sempre il file specifico con VirusTotal prima di aprirlo.',
      tips: [
        'Controlla autore e fonte del file prima di scaricare.',
        'Verifica licenza/copyright del contenuto, soprattutto per media e software.',
        'Per ogni download usa VirusTotal (file o URL diretto) prima dell\'esecuzione.'
      ]
    }
  };

  function getSpecialTrustedNotice(hostname, domain) {
    if (SPECIAL_TRUSTED_CONTENT_NOTICE[domain]) {
      return SPECIAL_TRUSTED_CONTENT_NOTICE[domain];
    }

    const host = (hostname || '').toLowerCase();
    if (host === 'archive.org' || host.endsWith('.archive.org')) {
      return SPECIAL_TRUSTED_CONTENT_NOTICE['archive.org'];
    }

    return null;
  }

  // Database di domini con storico negativo
  const BLACKLISTED_DOMAINS = {
    'megaupload.com': { reason: 'Chiuso per traffico illegale', severity: 'critical' },
    'counterwallet.co': { reason: 'Phishing noto', severity: 'critical' },
    'bitstamp.net': { reason: 'Attacchi DDoS ripetuti (storico)', severity: 'high' },
  };

  // Database di TLD con rischio maggiore
  const RISKY_TLD_REPUTATION = {
    '.tk': 20,    // Free TLD, spesso abusato
    '.ml': 25,
    '.ga': 25,
    '.cf': 25,    // Cloudflare free (spesso phishing)
    '.ru': 45,    // Meno affidabile (geopolitico)
    '.su': 30,    // Legacy Soviet TLD
    '.win': 35,
    '.loan': 40,  // Spesso phishing
    '.xyz': 50,   // Generico ma ok
    '.online': 50,
    '.site': 50,
    '.space': 50,
    '.info': 55,  // Spesso spam
    '.top': 40,   // Spesso phishing
    '.trade': 35, // Spesso phishing
    '.download': 30, // Spesso malware
  };

  // Database di siti e pattern illegali (torrent, streaming pirata, file sharing, etc.)
  const ILLEGAL_SITES_PATTERNS = {
    'piratebay': { name: 'The Pirate Bay', category: 'torrent', severity: 'critical', reason: 'Sito di distribuzione torrent illegale' },
    'thepiratebay': { name: 'The Pirate Bay', category: 'torrent', severity: 'critical', reason: 'Sito di distribuzione torrent illegale' },
    '1337x': { name: '1337x', category: 'torrent', severity: 'critical', reason: 'Sito di distribuzione torrent illegale' },
    'kickass': { name: 'KickAssTorrents', category: 'torrent', severity: 'critical', reason: 'Sito di distribuzione torrent illegale' },
    'rarbg': { name: 'RARBG', category: 'torrent', severity: 'critical', reason: 'Sito di distribuzione torrent illegale' },
    'torrentz': { name: 'Torrentz', category: 'torrent', severity: 'critical', reason: 'Motore di ricerca torrent illegale' },
    'torrentfreak': { name: 'TorrentFreak', category: 'torrent-adjacent', severity: 'medium', reason: 'Notizie su torrent (legale ma controverso)' },
    'putlocker': { name: 'PutLocker', category: 'streaming-illegal', severity: 'critical', reason: 'Sito di streaming illegale' },
    'fmovies': { name: 'FMovies', category: 'streaming-illegal', severity: 'critical', reason: 'Sito di streaming illegale' },
    'solarmovies': { name: 'SolarMovies', category: 'streaming-illegal', severity: 'critical', reason: 'Sito di streaming illegale' },
    '123movies': { name: '123Movies', category: 'streaming-illegal', severity: 'critical', reason: 'Sito di streaming illegale' },
    'soap2day': { name: 'Soap2Day', category: 'streaming-illegal', severity: 'critical', reason: 'Sito di streaming illegale' },
    'megashare': { name: 'Megashare', category: 'file-sharing', severity: 'critical', reason: 'Sito di file sharing illegale' },
    'rapidgator': { name: 'RapidGator', category: 'file-sharing', severity: 'high', reason: 'Sito di file hosting spesso usato per pirateria' },
    'uploaded': { name: 'Uploaded.net', category: 'file-sharing', severity: 'high', reason: 'Sito di file sharing noto per contenuto illegale' },
    'oboom': { name: 'oBoom', category: 'file-sharing', severity: 'high', reason: 'Sito di file sharing noto per contenuto illegale' },
    'ebook-pirate': { name: 'Ebook Pirate', category: 'ebook-illegal', severity: 'critical', reason: 'Sito di distribuzione ebook illegale' },
    'bookzz': { name: 'BookZZ', category: 'ebook-illegal', severity: 'high', reason: 'Repository di ebook in parte illegale' },
    'libgen': { name: 'Library Genesis', category: 'ebook-illegal', severity: 'high', reason: 'Repository di article e ebook controverso' },
    'scihub': { name: 'Sci-Hub', category: 'academic-piracy', severity: 'high', reason: 'Piattaforma illegale articoli accademici' },
    'zlibrary': { name: 'Z-Library', category: 'ebook-illegal', severity: 'high', reason: 'Libreria digitale illegale' },
    'steamrip': { name: 'SteamRIP', category: 'software-piracy', severity: 'critical', reason: 'Distribuzione illegale di videogiochi/crack' },
    'fitgirl': { name: 'FitGirl Repacks', category: 'software-piracy', severity: 'critical', reason: 'Distribuzione repack di videogiochi non autorizzati' },
    'igg-games': { name: 'IGG Games', category: 'software-piracy', severity: 'critical', reason: 'Distribuzione non autorizzata di videogiochi' },
    'skidrow': { name: 'Skidrow/CODEX mirrors', category: 'software-piracy', severity: 'critical', reason: 'Distribuzione crack e software pirata' },
    'repack-games': { name: 'Repack Games', category: 'software-piracy', severity: 'critical', reason: 'Distribuzione repack/crack non autorizzati' }
  };

  // Pattern per rilevare siti illegali tramite analisi dell'URL
  const ILLEGAL_KEYWORDS = [
    'torrent', 'pirate', 'crack', 'keygen', 'warez', 'serial',
    'streaming-free', 'free-movies', 'watchmovies', 'filmstreaming',
    'dvdrip', 'bdrip', 'bluray-rip', 'hdtv', 'downloads',
    'rapidshare', 'megaupload', 'depositfiles', 
    'ebook-download', 'free-pdf', 'book-pirate',
    'steamrip', 'fitgirl', 'repack', 'skidrow', 'codex', 'cracked-games', 'free-games-download'
  ];

  const VERY_HIGH_RISK_ILLEGAL_KEYWORDS = [
    'piratebay', 'thepiratebay', '1337x', 'kickass', 'rarbg', 'torrentz',
    'putlocker', 'fmovies', 'solarmovies', '123movies', 'soap2day',
    'zlibrary', 'scihub', 'warez', 'keygen', 'crack',
    'steamrip', 'fitgirl', 'igg-games', 'skidrow', 'codex'
  ];

  const ILLEGAL_CONTEXT_KEYWORDS = [
    'torrent', 'stream', 'watch', 'download', 'magnet', 'rip', 'cam',
    'hdrip', 'bdrip', 'dvdrip', 'free-movie', 'filmstreaming', 'subtitle'
  ];

  const PRIVATE_HOST_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^169\.254\./,
    /^::1$/i,
    /\.local$/i,
    /\.lan$/i,
    /\.home$/i,
    /\.internal$/i,
    /\.intra$/i,
    /\.corp$/i
  ];

  function isPrivateOrInternalHost(hostname) {
    if (!hostname) return false;
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true;
    return PRIVATE_HOST_PATTERNS.some((re) => re.test(host));
  }

  // Rileva siti con contenuto illegale (torrent, streaming pirata, file sharing illegale)
  async function detectIllegalContent(urlObj, hostname) {
    const result = {
      isIllegal: false,
      category: null,
      reason: null,
      severity: null,
      confidence: 'none',
      details: []
    };

    // 1. Controlla pattern esatti nel hostname
    const hostnameLower = hostname.toLowerCase();
    for (const [pattern, info] of Object.entries(ILLEGAL_SITES_PATTERNS)) {
      if (hostnameLower.includes(pattern)) {
        result.isIllegal = true;
        result.category = info.category;
        result.reason = info.reason;
        result.severity = info.severity;
        result.confidence = 'confirmed';
        result.details.push(`🚫 Corrispondenza identificata: ${info.name} (${info.category})`);
        return result;
      }
    }

    // 1.1 Check external torrent blocklist (GitHub feed + local cache)
    try {
      const externalList = await loadExternalTorrentBlocklist();
      const matchedExternalDomain = matchDomainAgainstBlocklist(hostnameLower, externalList.domains);
      if (matchedExternalDomain) {
        result.isIllegal = true;
        result.category = 'external-torrent-blocklist';
        result.severity = 'critical';
        result.confidence = 'confirmed';
        result.reason = `Dominio presente nella blocklist torrent esterna: ${matchedExternalDomain}`;
        result.details.push(`🚫 Match blocklist esterna (${externalList.source || 'unknown'}): ${matchedExternalDomain}`);
        return result;
      }
    } catch (e) {
      console.warn('External torrent blocklist match failed:', e.message);
    }

    // 2. Controlla keyword illegali nell'URL
    const fullUrl = urlObj.toString().toLowerCase();
    const matchedKeywords = ILLEGAL_KEYWORDS.filter(kw => fullUrl.includes(kw));
    const veryHighRiskHits = VERY_HIGH_RISK_ILLEGAL_KEYWORDS.filter(kw => fullUrl.includes(kw));
    const contextHits = ILLEGAL_CONTEXT_KEYWORDS.filter(kw => fullUrl.includes(kw));

    if (veryHighRiskHits.length > 0 && contextHits.length > 0) {
      result.isIllegal = true;
      result.category = 'url-keyword-illegal';
      result.severity = 'critical';
      result.confidence = 'probable';
      result.reason = `URL con keyword fortemente associate a pirateria: ${veryHighRiskHits.join(', ')}`;
      result.details.push(`⚠️ Keyword ad altissimo rischio: ${veryHighRiskHits.join(', ')}`);
    } else if (matchedKeywords.length >= 2) {
      result.isIllegal = true;
      result.category = 'suspicious-content';
      result.severity = 'high';
      result.confidence = 'probable';
      result.reason = `Rilevate ${matchedKeywords.length} keyword associate a contenuto illegale: ${matchedKeywords.join(', ')}`;
      result.details.push(`⚠️ Rilevate keyword sospette: ${matchedKeywords.join(', ')}`);
    }

    // 3. Controlla pattern nel path (ad es. /movie/, /watch/, /download/)
    const pathLower = urlObj.pathname.toLowerCase();
    const illegalPatterns = [/\/movie\//i, /\/watch\//i, /\/stream\//i, /\/torrent\//i, /\/download\//i, /\/mp3\//i];
    const matchedPatterns = illegalPatterns.filter(p => p.test(pathLower));
    if (matchedPatterns.length > 0 && (matchedKeywords.length > 0 || contextHits.length > 0)) {
      result.isIllegal = true;
      result.category = 'streaming-pattern';
      result.severity = 'high';
      result.confidence = result.confidence === 'confirmed' ? 'confirmed' : 'probable';
      result.reason = 'Rilevato pattern di streaming illegale nell\'URL';
      result.details.push('⚠️ Struttura URL tipica di siti di streaming illegale');
    }

    return result;
  }

  function toBase64Url(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  // Scansione dettagliata con VirusTotal URL API (richiede API key)
  async function scanWithVTUrl(urlStr) {
    if (!CONFIG.VIRUSTOTAL_API) return null;

    try {
      const cacheKey = 'vt_url_scan_' + urlStr;
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT + 2000);

      // 1) URL report diretto (metodo più veloce)
      const urlId = toBase64Url(urlStr);
      let response = await fetch(
        `https://www.virustotal.com/api/v3/urls/${urlId}`,
        {
          method: 'GET',
          headers: { 'x-apikey': CONFIG.VIRUSTOTAL_API },
          signal: controller.signal
        }
      ).catch(() => null);

      // 2) Fallback: submit URL e usa stats analisi
      if (!response || !response.ok) {
        const submitResponse = await fetch(
          'https://www.virustotal.com/api/v3/urls',
          {
            method: 'POST',
            headers: {
              'x-apikey': CONFIG.VIRUSTOTAL_API,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'url=' + encodeURIComponent(urlStr),
            signal: controller.signal
          }
        ).catch(() => null);

        if (!submitResponse || !submitResponse.ok) {
          clearTimeout(timeoutId);
          return null;
        }

        const submitData = await submitResponse.json();
        const stats = submitData?.data?.attributes?.stats || {};
        const result = {
          source: 'vt-analysis-submit',
          malicious: stats.malicious || 0,
          suspicious: stats.suspicious || 0,
          harmless: stats.harmless || 0,
          undetected: stats.undetected || 0
        };

        setCachedResult(cacheKey, result);
        clearTimeout(timeoutId);
        return result;
      }

      clearTimeout(timeoutId);
      if (!response.ok) return null;

      const data = await response.json();
      const stats = data?.data?.attributes?.last_analysis_stats || {};
      const result = {
        source: 'vt-url-report',
        malicious: stats.malicious || 0,
        suspicious: stats.suspicious || 0,
        harmless: stats.harmless || 0,
        undetected: stats.undetected || 0
      };

      setCachedResult(cacheKey, result);
      return result;
    } catch (e) {
      console.warn('VirusTotal URL scan failed:', e.message);
      return null;
    }
  }

  async function fetchSiteSnapshot(urlObj) {
    try {
      const target = `${urlObj.hostname}${urlObj.pathname || '/'}`;
      const cacheKey = 'site_snapshot_' + target;
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT + 3000);
      const snapshotUrl = CONFIG.CONTENT_PROXY_BASE + target;
      const response = await fetch(snapshotUrl, {
        method: 'GET',
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (!response || !response.ok) return null;

      const text = (await response.text()) || '';
      const result = {
        fetched: text.length > 0,
        text: text.slice(0, 120000) // evita payload enormi
      };

      setCachedResult(cacheKey, result);
      return result;
    } catch (e) {
      console.warn('Site snapshot fetch failed:', e.message);
      return null;
    }
  }

  function analyzeSnapshotContent(snapshotText) {
    const text = (snapshotText || '').toLowerCase();
    let score = 78;
    const findings = [];
    const advice = [];

    const severePatterns = [
      'seed phrase', 'wallet recovery', 'private key', 'metamask verify',
      'unlock account immediately', 'confirm your bank password'
    ];
    const phishingTerms = ['verify account', 'suspend', 'urgent action', 'password reset required', 'confirm identity'];
    const downloadBait = ['free crack', 'keygen', 'serial key', 'download activated'];
    const executableHints = ['.exe', '.msi', '.apk', '.bat', '.scr', '.dmg'];

    const severeHits = severePatterns.filter(p => text.includes(p));
    if (severeHits.length > 0) {
      score -= Math.min(40, severeHits.length * 12);
      findings.push(`⛔ Richieste estremamente rischiose rilevate: ${severeHits.join(', ')}`);
      advice.push('Non inserire seed phrase, codici OTP, password bancaria o chiavi wallet.');
    }

    const phishingHits = phishingTerms.filter(p => text.includes(p));
    if (phishingHits.length > 0) {
      score -= Math.min(25, phishingHits.length * 6);
      findings.push(`⚠️ Linguaggio da phishing rilevato: ${phishingHits.join(', ')}`);
      advice.push('Verifica sempre il dominio ufficiale prima di fare login.');
    }

    const baitHits = downloadBait.filter(p => text.includes(p));
    if (baitHits.length > 0) {
      score -= Math.min(18, baitHits.length * 5);
      findings.push(`⚠️ Pattern download sospetti rilevati: ${baitHits.join(', ')}`);
      advice.push('Evita file eseguibili o crack scaricati da siti non ufficiali.');
    }

    const executableCount = executableHints.reduce((acc, token) => {
      return acc + (text.split(token).length - 1);
    }, 0);
    if (executableCount >= 3) {
      score -= 12;
      findings.push('⚠️ Numerosi riferimenti a file eseguibili rilevati nel contenuto del sito.');
      advice.push('Scansiona qualsiasi download con antivirus prima di aprirlo.');
    }

    const hasTrustPages = /privacy|termini|terms|contact|contatti|about|chi siamo/.test(text);
    if (hasTrustPages) {
      score += 8;
      findings.push('✓ Il sito espone pagine informative (privacy/termini/contatti).');
    } else {
      score -= 6;
      findings.push('⚠️ Mancano riferimenti chiari a privacy/termini/contatti.');
      advice.push('Usa il sito con cautela se non trovi privacy policy o contatti verificabili.');
    }

    const hasHttpsHints = /https:\/\//.test(text);
    if (hasHttpsHints) score += 2;

    score = Math.max(0, Math.min(100, Math.round(score)));
    return { score, findings, advice };
  }

  function generateSafetyTips({ urlObj, score, contentSafety, siteExists }) {
    const tips = [];

    tips.push('Non inserire password, dati bancari o codici OTP se hai dubbi anche minimi sul sito.');

    if (urlObj.protocol !== 'https:') {
      tips.push('Il sito non usa HTTPS: evita login e pagamenti da questa pagina.');
    }

    if (isPrivateOrInternalHost(urlObj.hostname)) {
      tips.push('Host privato/interno: usa questo sito solo se sei nella rete giusta e ti fidi della fonte.');
      tips.push('Per siti privati evita di inserire dati sensibili se il certificato HTTPS non e\' valido.');
    }

    if (siteExists && siteExists.exists === false) {
      tips.push('Se il sito non risponde o è instabile, non riprovare inserendo dati personali.');
    }

    if (contentSafety && contentSafety.siteContentScore <= 55) {
      tips.push('Contenuto ad alto rischio: non scaricare file e non autorizzare estensioni/plugin.');
    }

    if (contentSafety && contentSafety.vtData && contentSafety.vtData.malicious > 0) {
      tips.push('VirusTotal ha trovato segnalazioni malevole: chiudi il sito e non interagire.');
    }

    if (score < 60) {
      tips.push('Per sicurezza, cerca il servizio via motore di ricerca ufficiale invece di usare direttamente questo URL.');
    }

    return Array.from(new Set(tips)).slice(0, 6);
  }

  // Analizza la sicurezza del contenuto (identifica siti illegali e pericolosi)
  async function analyzeContentSafety(urlObj, urlStr) {
    const hostname = urlObj.hostname;
    const domain = hostname.split('.').slice(-2).join('.');
    const specialContentNotice = getSpecialTrustedNotice(hostname, domain);
    const trustedScore = TRUSTED_DOMAINS[domain] || 0;

    // Priority override: trusted public archives must not be hard-blocked by torrent blocklists.
    if (specialContentNotice && trustedScore >= 95) {
      return {
        isIllegal: false,
        category: null,
        reason: null,
        severity: null,
        details: [
          `✓ Dominio archivio pubblico altamente affidabile (${domain})`,
          '⚠️ Contenuti eterogenei: verifica sempre il singolo file prima del download.',
          'ℹ️ Consiglio: analizza file/URL diretto con VirusTotal prima dell\'apertura.'
        ],
        specialNotice: specialContentNotice,
        vtData: null,
        siteContentScore: 92,
        riskPenalty: 0,
        riskLevel: 'low',
        snapshotUsed: false,
        advice: specialContentNotice.tips || []
      };
    }
    
    // Rileva primo sito illegale
    const illegalDetection = await detectIllegalContent(urlObj, hostname);
    if (illegalDetection.isIllegal) {
      const isConfirmed = illegalDetection.confidence === 'confirmed';
      return {
        isIllegal: true,
        category: illegalDetection.category,
        reason: illegalDetection.reason,
        severity: illegalDetection.severity,
        confidence: illegalDetection.confidence,
        details: illegalDetection.details,
        specialNotice: specialContentNotice,
        vtData: null,
        siteContentScore: isConfirmed ? 5 : 22,
        forcedScore: isConfirmed ? 5 : 25,
        riskPenalty: isConfirmed ? 95 : 72,
        snapshotUsed: false,
        advice: [
          'Non inserire credenziali o dati personali su siti con contenuto illegale.',
          'Non scaricare file: il rischio malware su queste piattaforme è elevato.'
        ]
      };
    }

    // Trusted major domains should not be downgraded to medium risk by heuristic content checks.
    if (trustedScore >= 95) {
      return {
        isIllegal: false,
        category: null,
        reason: null,
        severity: null,
        details: [
          `✓ Dominio altamente affidabile nel database interno (${domain})`,
          '✓ Heuristics contenuto allineate al profilo di rischio basso'
        ],
        specialNotice: specialContentNotice,
        vtData: null,
        siteContentScore: 96,
        riskPenalty: 0,
        riskLevel: 'low',
        snapshotUsed: false,
        advice: specialContentNotice ? specialContentNotice.tips : []
      };
    }

    const [vtUrlData, snapshot] = await Promise.all([
      scanWithVTUrl(urlStr),
      fetchSiteSnapshot(urlObj)
    ]);

    let siteContentScore = 72;
    const contentDetails = [];
    let advice = [];

    if (snapshot && snapshot.fetched) {
      const snapshotAnalysis = analyzeSnapshotContent(snapshot.text);
      siteContentScore = snapshotAnalysis.score;
      contentDetails.push(...snapshotAnalysis.findings);
      advice = advice.concat(snapshotAnalysis.advice);
    } else {
      contentDetails.push('⚠️ Analisi contenuto limitata: snapshot del sito non disponibile dal browser.');
      advice.push('Quando possibile, controlla manualmente pagina Privacy, Termini e Contatti del sito.');
    }

    if (vtUrlData) {
      if (vtUrlData.malicious > 0) {
        siteContentScore -= Math.min(50, vtUrlData.malicious * 8);
        contentDetails.push(`⛔ VirusTotal URL: ${vtUrlData.malicious} rilevazioni malevole.`);
      } else if (vtUrlData.suspicious > 0) {
        siteContentScore -= Math.min(22, vtUrlData.suspicious * 4);
        contentDetails.push(`⚠️ VirusTotal URL: ${vtUrlData.suspicious} rilevazioni sospette.`);
      } else {
        contentDetails.push('✓ VirusTotal URL: nessuna rilevazione malevola nota.');
      }
    } else {
      contentDetails.push('ℹ️ VirusTotal URL non disponibile (chiave API mancante o endpoint non raggiungibile).');
      advice.push('Per controlli più completi, configura anche una API key VirusTotal.');
    }

    siteContentScore = Math.max(0, Math.min(100, Math.round(siteContentScore)));
    const riskPenalty = siteContentScore >= 85 ? 0 : Math.round((85 - siteContentScore) * 0.7);
    const riskLevel = siteContentScore >= 80 ? 'low' : (siteContentScore >= 60 ? 'medium' : 'high');
    
    return {
      isIllegal: false,
      category: null,
      reason: null,
      severity: null,
      details: contentDetails,
      specialNotice: specialContentNotice,
      vtData: vtUrlData,
      siteContentScore,
      riskPenalty,
      riskLevel,
      snapshotUsed: !!(snapshot && snapshot.fetched),
      advice
    };
  }

  // Calcola l'indice di affidabilità del sito (0-100)
  async function calculateSiteReputation(urlObj) {
    let reputation = 70; // Base score
    const details = [];
    const justifications = [];

    // 1. Controlla domini conosciuti
    const hostname = urlObj.hostname;
    const domain = hostname.split('.').slice(-2).join('.'); // Get "example.com"

    // 0. Penalita' per siti privati/interni non verificabili pubblicamente
    if (isPrivateOrInternalHost(hostname)) {
      reputation -= 35;
      details.push({
        rule: 'private-site',
        passed: false,
        message: '⚠️ Sito privato/interno: affidabilita\' pubblica ridotta'
      });
      justifications.push('Host privato o intranet (localhost/LAN/internal): difficile verificarne affidabilita\' pubblica.');
    }
    
    if (TRUSTED_DOMAINS[domain]) {
      reputation += Math.min(TRUSTED_DOMAINS[domain] - 70, 20);
      details.push({
        rule: 'known-domain',
        passed: true,
        message: `✓ Dominio conosciuto e affidabile`
      });
      justifications.push(`Sito rinomato nel database di ${TRUSTED_DOMAINS[domain]}% siti verificati`);
    } else if (BLACKLISTED_DOMAINS[domain]) {
      reputation = 0;
      const blacklistInfo = BLACKLISTED_DOMAINS[domain];
      details.push({
        rule: 'blacklisted',
        passed: false,
        message: `🚫 Dominio in blacklist: ${blacklistInfo.reason} [${blacklistInfo.severity.toUpperCase()}]`
      });
      justifications.push(`Dominio registrato in blacklist per: ${blacklistInfo.reason}`);
    }

    // 2. Controlla se il sito esiste effettivamente
    let siteExistsInfo = null;
    try {
      siteExistsInfo = await checkSiteExists(`${urlObj.protocol}//${hostname}`);
      if (siteExistsInfo.exists) {
        reputation += 8;
        details.push({
          rule: 'site-exists',
          passed: true,
          message: `✓ Sito raggiungibile e attivo`
        });
        justifications.push('Il sito risponde correttamente (server attivo e funzionante)');
      } else if (siteExistsInfo.exists === false) {
        reputation -= 20;
        details.push({
          rule: 'site-exists',
          passed: false,
          message: `❌ Sito non raggiungibile (${siteExistsInfo.reason})`
        });
        justifications.push(`Sito non raggiungibile: ${siteExistsInfo.reason}`);
      }
    } catch (e) {
      console.warn('Site existence check skipped');
    }

    // 3. Controlla TLD reputation
    const tld = '.' + hostname.split('.').slice(-1)[0];
    if (RISKY_TLD_REPUTATION[tld]) {
      const tldScore = RISKY_TLD_REPUTATION[tld];
      if (tldScore < 70) {
        reputation -= (70 - tldScore) * 0.3;
        details.push({
          rule: 'risky-tld',
          passed: false,
          message: `⚠️ TLD con reputazione media (${tld}): +${tldScore}% affidabilità`
        });
        justifications.push(`TLD "${tld}" ha reputazione media (${tldScore}%) - spesso usato per phishing`);
      } else {
        details.push({
          rule: 'generic-tld',
          passed: true,
          message: `Dominio generico (${tld}): affidabilità standard`
        });
        if (tldScore >= 90) {
          justifications.push(`TLD "${tld}" è affidabile e controllato`);
        }
      }
    }

    // 4. Controlla lunghezza dominio (domini legittimi hanno nomi ragionevoli)
    if (hostname.length > 63) {
      reputation -= 5;
      details.push({
        rule: 'long-domain',
        passed: false,
        message: '⚠️ Dominio insolitamente lungo'
      });
      justifications.push('Dominio con lunghezza eccessiva (segno di obfuscation)');
    }

    // 5. Controlla dashes nel dominio (indicatore di phishing)
    const dashCount = (hostname.match(/-/g) || []).length;
    if (dashCount >= 3) {
      reputation -= 15;
      details.push({
        rule: 'many-dashes',
        passed: false,
        message: `Dominio con ${dashCount} trattini (possibile lookalike)`
      });
      justifications.push(`Dominio contiene ${dashCount} trattini - tipico di siti contraffatti`);
    }

    // 6. Controlla numero di sottodomini (legittimi ne hanno pochi)
    const subdomainCount = hostname.split('.').length - 2;
    if (subdomainCount > 3) {
      reputation -= 8;
      details.push({
        rule: 'many-subdomains',
        passed: false,
        message: `${subdomainCount} sottodomini (insolitamente complex)`
      });
      justifications.push(`Struttura complessa con ${subdomainCount} sottodomini`);
    }

    // 7. Controlla Pattern tipico di phishing (es: login-update-verify)
    const phishingPatterns = ['login', 'account', 'verify', 'update', 'confirm', 'authenticate', 'secure'];
    const hasPhishingPattern = phishingPatterns.some(pattern => hostname.toLowerCase().includes(pattern));
    if (hasPhishingPattern && !TRUSTED_DOMAINS[domain]) {
      reputation -= 10;
      details.push({
        rule: 'phishing-pattern',
        passed: false,
        message: '⚠️ Dominio contiene parole tipiche di phishing'
      });
      justifications.push('Dominio contiene parole sospette associate a phishing');
    }

    // 8. Controlla VirusTotal reputation (se configurato)
    let vtReputation = null;
    try {
      vtReputation = await checkVirusTotal(urlObj.hostname);
      if (vtReputation) {
        if (vtReputation.harmless === 0 && vtReputation.malicious === 0 && vtReputation.undetected > 0) {
          details.push({
            rule: 'vt-clean',
            passed: true,
            message: `✓ VirusTotal: Non rilevato come malevolo`
          });
          justifications.push('Nessun segnalazione di malware nei database antivirus');
        } else if (vtReputation.malicious > 0) {
          reputation -= Math.min(vtReputation.malicious * 5, 40);
          details.push({
            rule: 'vt-malicious',
            passed: false,
            message: `⛔ VirusTotal: ${vtReputation.malicious} segnalazioni di malware`
          });
          justifications.push(`${vtReputation.malicious} segnalazioni di malware da provider di sicurezza`);
        } else if (vtReputation.suspicious > 0) {
          reputation -= Math.min(vtReputation.suspicious * 2, 15);
          details.push({
            rule: 'vt-suspicious',
            passed: false,
            message: `⚠️ VirusTotal: ${vtReputation.suspicious} segnalazioni sospette`
          });
          justifications.push(`${vtReputation.suspicious} segnalazioni sospette rilevate`);
        }
      }
    } catch (e) {
      console.warn('VirusTotal check skipped:', e.message);
    }

    // 9. SSL/TLS reputazione (assunto se non HTTPS, reputation scende)
    if (urlObj.protocol !== 'https:') {
      reputation -= 15;
      details.push({
        rule: 'no-https-reputation',
        passed: false,
        message: '⚠️ Nessuna crittografia SSL/TLS'
      });
      justifications.push('Comunicazione non cifrata - i dati possono essere intercettati');
    } else {
      details.push({
        rule: 'https-reputation',
        passed: true,
        message: '✓ Connessione crittografata'
      });
      justifications.push('Utilizzo di HTTPS con crittografia end-to-end');
    }

    // Bind reputation tra 0 e 100
    reputation = Math.max(0, Math.min(100, reputation));

    return {
      reputation: Math.round(reputation),
      details,
      justifications,
      vtData: vtReputation,
      siteExists: siteExistsInfo
    };
  }

  // Check VirusTotal domain reputation
  async function checkVirusTotal(hostname) {
    if (!CONFIG.VIRUSTOTAL_API) return null;

    try {
      const cacheKey = 'vt_' + hostname;
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

      // VirusTotal public API endpoint (no key required for basic domain lookup)
      const response = await fetch(
        `https://www.virustotal.com/api/v3/domains/${hostname}`,
        {
          method: 'GET',
          headers: { 'x-apikey': CONFIG.VIRUSTOTAL_API },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try alternative: URLhaus has some VT data integrated
        return null;
      }

      const data = await response.json();
      const result = {
        harmless: data.data?.attributes?.last_analysis_stats?.harmless || 0,
        malicious: data.data?.attributes?.last_analysis_stats?.malicious || 0,
        suspicious: data.data?.attributes?.last_analysis_stats?.suspicious || 0,
        undetected: data.data?.attributes?.last_analysis_stats?.undetected || 0
      };

      setCachedResult(cacheKey, result);
      return result;
    } catch (e) {
      console.warn('VirusTotal check failed:', e.message);
      return null;
    }
  }

  // Verifica se il sito esiste effettivamente (HEAD request)
  async function checkSiteExists(urlStr) {
    try {
      const cacheKey = 'site_exists_' + urlStr;
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

      // Try HEAD request first (più veloce e leggero)
      let response = await fetch(urlStr, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        redirect: 'follow'
      }).catch(() => null);

      // Se HEAD fallisce, prova GET
      if (!response) {
        response = await fetch(urlStr, {
          method: 'GET',
          mode: 'no-cors',
          signal: controller.signal,
          redirect: 'follow'
        }).catch(() => null);
      }

      clearTimeout(timeoutId);

      if (!response) {
        return {
          exists: false,
          status: null,
          reason: 'Nessuna risposta dal server'
        };
      }

      const result = {
        exists: response.ok || response.status < 500,
        status: response.status,
        statusText: response.statusText,
        reason: response.ok ? 'Sito raggiungibile' : (
          response.status === 0 ? 'CORS bloccato' :
          response.status === 404 ? 'Pagina non trovata' :
          response.status === 500 ? 'Errore server' :
          `HTTP ${response.status}`
        ),
        responseTime: performance.now ? performance.now() : null
      };

      setCachedResult(cacheKey, result);
      return result;
    } catch (e) {
      console.warn('Site existence check failed:', e.message);
      return {
        exists: null,
        status: null,
        reason: 'Controllo disponibilità non supportato da questo browser'
      };
    }
  }

  // Raccoglia informazioni dettagliate SSL/TLS
  async function getDetailedSiteInfo(urlObj, urlStr) {
    const info = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      hasSSL: urlObj.protocol === 'https:',
      justification: [] // Usato per spiegare il punteggio
    };

    // Controlla SSL
    if (info.hasSSL) {
      info.justification.push('✓ Usa protocollo HTTPS (comunicazione cifrata)');
    } else {
      info.justification.push('❌ Usa HTTP (non cifrato)');
    }

    // Limita a hostname per il controllo di esistenza
    const checkUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
    const existsCheck = await checkSiteExists(checkUrl);
    info.exists = existsCheck;

    if (existsCheck.exists) {
      info.justification.push(`✓ Sito raggiungibile e attivo (${existsCheck.reason})`);
    } else if (existsCheck.exists === false) {
      info.justification.push(`❌ Sito non raggiungibile (${existsCheck.reason})`);
    } else {
      info.justification.push(`⚠️ Disponibilità non verificabile (${existsCheck.reason})`);
    }

    // Controlla dominio registrato (semplice heuristica)
    const hostnameParts = urlObj.hostname.split('.');
    if (hostnameParts.length >= 2) {
      const domain = hostnameParts.slice(-2).join('.');
      if (domain.length >= 4) {
        info.justification.push('✓ Dominio ha lunghezza ragionevole');
      }
    }

    return info;
  }

  // Local URL analysis (improved and optimized)
  async function analyzeUrlLocal(input, urlObj) {
    const details = [];
    let score = 100;

    // HTTPS check - critical (40 points)
    if (urlObj.protocol !== 'https:') {
      score -= 40;
      details.push({rule:'https', passed:false, weight:40, message:'Non usa HTTPS (connessione non cifrata)'});
    } else {
      details.push({rule:'https', passed:true, weight:0, message:'✓ Usa HTTPS (connessione cifrata)'});
    }

    // IP address instead of hostname (risky pattern)
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(urlObj.hostname)) {
      score -= 35;
      details.push({rule:'ip', passed:false, weight:35, message:'Usa un indirizzo IP invece di un dominio (molto sospetto)'});
    }

    // Punycode check (IDN spoofing detection)
    if (urlObj.hostname.startsWith('xn--')) {
      score -= 20;
      details.push({rule:'punycode', passed:false, weight:20, message:'Dominio in punycode (possibile spoofing IDN)'});
    }

    // Private/internal websites are not publicly verifiable
    if (isPrivateOrInternalHost(urlObj.hostname)) {
      score -= 25;
      details.push({
        rule:'private-host',
        passed:false,
        weight:25,
        message:'Host privato/intranet (localhost, LAN o dominio interno): affidabilita\' pubblica bassa'
      });
    }

    // Check for suspicious TLDs
    const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.su', '.ru'];
    const currentTLD = urlObj.hostname.substring(urlObj.hostname.lastIndexOf('.'));
    if (suspiciousTLDs.includes(currentTLD.toLowerCase())) {
      score -= 15;
      details.push({rule:'tld', passed:false, weight:15, message:`TLD sospetto (${currentTLD})`});
    }

    // URL length check
    if (input.length > 100) {
      score -= 18;
      details.push({rule:'length', passed:false, weight:18, message:'URL molto lungo (possibile obfuscation)'});
    } else if (input.length > 75) {
      score -= 8;
      details.push({rule:'length', passed:false, weight:8, message:'URL piuttosto lungo'});
    }

    // Suspicious characters
    if (/[\@]/.test(input)) {
      score -= 25;
      details.push({rule:'at', passed:false, weight:25, message:"Contiene '@' (carattere di phishing noto)"});
    }

    if (/(%00|%0d|%0a)/.test(input)) {
      score -= 20;
      details.push({rule:'null-bytes', passed:false, weight:20, message:'Contiene null bytes (tentativo injection)'});
    }

    // Many dashes (domain lookalike)
    const dashCount = (urlObj.hostname.match(/-/g) || []).length;
    if (dashCount > 5) {
      score -= 15;
      details.push({rule:'dashes', passed:false, weight:15, message:'Molti trattini nel dominio (possibile typosquatting)'});
    } else if (dashCount > 3) {
      score -= 7;
      details.push({rule:'dashes', passed:false, weight:7, message:'Diversi trattini nel dominio'});
    }

    // Long query string
    if (urlObj.search.length > 150) {
      score -= 12;
      details.push({rule:'query', passed:false, weight:12, message:'Query string molto lunga (possibile malware vector)'});
    } else if (urlObj.search.length > 75) {
      score -= 5;
      details.push({rule:'query', passed:false, weight:5, message:'Query string piuttosto lunga'});
    }

    // Known suspicious patterns
    if (/bit\.ly|tinyurl|short\.link|goo\.gl/i.test(urlObj.hostname)) {
      score -= 15;
      details.push({rule:'shortener', passed:false, weight:15, message:'URL abbreviato (nasconde il vero dominio)'});
    }

    // Ensure score bounds
    if (score < 0) score = 0;

    return { score, details };
  }

  // URLhaus API check (free, no auth required)
  async function checkURLhaus(url) {
    try {
      const cacheKey = 'urlhaus_' + url;
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

      const response = await fetch(CONFIG.URLHAUS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'url=' + encodeURIComponent(url),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Status: ${response.status}`);

      const data = await response.json();
      const result = {
        found: data.query_status === 'ok',
        threat: data.threat || 'unknown',
        tags: data.tags || [],
        apiName: 'URLhaus'
      };

      setCachedResult(cacheKey, result);
      return result;
    } catch (e) {
      console.warn('URLhaus check failed:', e.message);
      return null;
    }
  }

  // Google Safe Browsing API check (requires API key in localStorage)
  async function checkGoogleSafeBrowsing(url) {
    if (!CONFIG.GOOGLE_SAFE_BROWSE_API) return null;

    try {
      const cacheKey = 'gsb_' + url;
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

      const payload = {
        client: { clientId: "whysafe", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: url }]
        }
      };

      const response = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${CONFIG.GOOGLE_SAFE_BROWSE_API}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Status: ${response.status}`);

      const data = await response.json();
      const result = {
        matches: data.matches && data.matches.length > 0,
        threats: data.matches || [],
        apiName: 'Google Safe Browsing'
      };

      setCachedResult(cacheKey, result);
      return result;
    } catch (e) {
      console.warn('Google Safe Browsing check failed:', e.message);
      return null;
    }
  }

  // Check domain reputation via additional endpoints
  async function checkDomainReputation(hostname) {
    try {
      const cacheKey = 'domain_rep_' + hostname;
      const cached = getCachedResult(cacheKey);
      if (cached) return cached;

      // Try to get WHOIS data or domain age info (if available)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

      // Using a free API to check domain reputation
      const response = await fetch(
        `https://api.abuseipdb.com/api/v2/check?domain=${encodeURIComponent(hostname)}&maxAgeInDays=90&verbose`,
        { signal: controller.signal }
      ).catch(() => null);

      clearTimeout(timeoutId);

      if (!response || !response.ok) return null;

      const data = await response.json();
      const result = {
        abuseScore: data.abuseConfidenceScore || 0,
        reports: data.totalReports || 0,
        apiName: 'AbuseIPDB'
      };

      setCachedResult(cacheKey, result);
      return result;
    } catch (e) {
      console.warn('Domain reputation check failed:', e.message);
      return null;
    }
  }

  // Main analysis function (now async)
  async function analyzeUrl(input) {
    const details = [];
    let score = 100;
    let urlStr = input.trim();

    // Normalize URL
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = 'http://' + urlStr;
    }

    let urlObj;
    try {
      urlObj = new URL(urlStr);
    } catch (e) {
      details.push({rule:'valid', passed:false, weight:100, message:'❌ URL non valido'});
      return { score:0, details, isValid: false };
    }

    // Local analysis
    const localResult = await analyzeUrlLocal(input, urlObj);
    score = localResult.score;
    details.push(...localResult.details);

    // External API checks (running in parallel)
    const [urlhausResult, googleResult] = await Promise.all([
      checkURLhaus(urlStr),
      checkGoogleSafeBrowsing(urlStr)
    ]);

    // Process URLhaus results
    if (urlhausResult) {
      if (urlhausResult.found) {
        score -= 50;
        const threatType = urlhausResult.threat !== 'unknown' ? ` (${urlhausResult.threat})` : '';
        details.push({
          rule:'urlhaus',
          passed:false,
          weight:50,
          message:`⚠️ Registrato in URLhaus come sito malevolo${threatType}`
        });
        if (urlhausResult.tags && urlhausResult.tags.length > 0) {
          details.push({
            rule:'urlhaus-tags',
            passed:false,
            weight:0,
            message:`🔴 Tag URLhaus: ${urlhausResult.tags.join(', ')}`
          });
        }
      } else {
        details.push({
          rule:'urlhaus',
          passed:true,
          weight:0,
          message:`✓ Non trovato in URLhaus`
        });
      }
    }

    // Process Google Safe Browsing results
    if (googleResult) {
      if (googleResult.matches) {
        score -= 60;
        const threatTypes = googleResult.threats.map(t => t.threatType).join(', ');
        details.push({
          rule:'google-safe-browse',
          passed:false,
          weight:60,
          message:`⛔ Rilevato da Google Safe Browsing (${threatTypes})`
        });
      } else {
        details.push({
          rule:'google-safe-browse',
          passed:true,
          weight:0,
          message:`✓ Non rilevato da Google Safe Browsing`
        });
      }
    }

    // Content Safety check - analisi del sito completo (contenuto + pattern + VT URL)
    const contentSafetyResult = await analyzeContentSafety(urlObj, urlStr);
    if (contentSafetyResult.isIllegal) {
      const forcedScore = typeof contentSafetyResult.forcedScore === 'number' ? contentSafetyResult.forcedScore : 5;
      score = Math.min(score, forcedScore);
      details.push({
        rule: 'illegal-content',
        passed: false,
        weight: 100 - forcedScore,
        message: `🚫 CONTENUTO ILLEGALE RILEVATO: ${contentSafetyResult.reason}`,
        isIllegalContent: true,
        illegalDetails: contentSafetyResult.details,
        illegalCategory: contentSafetyResult.category,
        illegalSeverity: contentSafetyResult.severity,
        illegalConfidence: contentSafetyResult.confidence || 'probable'
      });
    } else {
      if (contentSafetyResult.siteContentScore !== undefined) {
        score -= contentSafetyResult.riskPenalty || 0;
        details.push({
          rule: 'site-content-score',
          passed: contentSafetyResult.siteContentScore >= 70,
          weight: contentSafetyResult.riskPenalty || 0,
          message: `🧠 Analisi Contenuto Sito: ${contentSafetyResult.siteContentScore}%`,
          isSiteContentScore: true,
          contentRiskLevel: contentSafetyResult.riskLevel || 'unknown',
          contentDetails: contentSafetyResult.details || []
        });
      }

      details.push({
        rule: 'illegal-content',
        passed: true,
        weight: 0,
        message: `✓ Nessun contenuto illegale conosciuto`
      });
    }

    // Site Reputation check
    const reputationResult = await calculateSiteReputation(urlObj);
    const reputation = reputationResult.reputation;
    const justifications = reputationResult.justifications || [];
    
    details.push({
      rule: 'site-reputation',
      passed: reputation >= 70,
      weight: 0,
      message: `📊 Indice di Affidabilità del Sito: ${reputation}%`,
      isReputation: true,
      justifications: justifications
    });

    // Add reputation details
    if (reputationResult.details && reputationResult.details.length > 0) {
      reputationResult.details.forEach(d => {
        details.push({
          rule: d.rule,
          passed: d.passed !== false,
          weight: 0,
          message: d.message,
          isReputationDetail: true
        });
      });
    }

    // Bound score
    if (score < 0) score = 0;

    const userTips = generateSafetyTips({
      urlObj,
      score,
      contentSafety: contentSafetyResult,
      siteExists: reputationResult.siteExists
    });

    return {
      score,
      details,
      isValid: true,
      reputation: reputation,
      justifications: justifications,
      siteExists: reputationResult.siteExists,
      illegalContent: contentSafetyResult,
      specialNotice: contentSafetyResult.specialNotice || null,
      userTips
    };
  }

  function appendSpecialNotice(container, specialNotice) {
    if (!container || !specialNotice) return;

    const li = document.createElement('li');
    li.className = 'special-domain-notice-item';

    const box = document.createElement('div');
    box.className = 'special-domain-notice';
    box.innerHTML = `
      <div class="special-domain-notice-title">⭐ ${specialNotice.title}</div>
      <div class="special-domain-notice-text">${specialNotice.message}</div>
    `;

    li.appendChild(box);
    container.appendChild(li);
  }

  function appendTipsBox(container, tips) {
    if (!container || !tips || tips.length === 0) return;

    const tipsBox = document.createElement('div');
    tipsBox.className = 'user-tips-box';
    tipsBox.innerHTML = '<strong class="user-tips-title">🛡️ Consigli di Sicurezza</strong>';

    tips.slice(0, 6).forEach((tip) => {
      const tipItem = document.createElement('div');
      tipItem.className = 'user-tip-item';
      tipItem.textContent = `• ${tip}`;
      tipsBox.appendChild(tipItem);
    });

    container.appendChild(tipsBox);
  }

  function renderResult(report) {
    const resultEl = document.getElementById('result');
    const scoreValue = document.getElementById('scoreValue');
    const scoreLabel = document.getElementById('scoreLabel');
    const reasons = document.getElementById('reasons');
    const loadingEl = document.querySelector('.loading-spinner');

    if (!resultEl || !scoreValue || !reasons) return;

    // Hide loading
    if (loadingEl) loadingEl.style.display = 'none';

    resultEl.classList.remove('hidden');

    // Check if illegal content detected - PRIORITY 1
    if (report.illegalContent && report.illegalContent.isIllegal) {
      reasons.innerHTML = '';
      const illegalBox = document.createElement('div');
      illegalBox.className = 'illegal-content-warning';
      const categoryLabel = {
        'torrent': '🎬 TORRENT ILLEGALE',
        'streaming-illegal': '📺 STREAMING PIRATA',
        'file-sharing': '📥 FILE SHARING ILLEGALE',
        'ebook-illegal': '📚 EBOOK PIRATA',
        'software-piracy': '🎮 SOFTWARE / GIOCHI PIRATA',
        'academic-piracy': '🎓 PIRATERIA ACCADEMICA',
        'suspicious-content': '⚠️ CONTENUTO SOSPETTO',
        'streaming-pattern': '📺 PATTERN STREAMING',
        'url-keyword-illegal': '🚫 URL PROBABILEMENTE ILLEGALE',
        'external-torrent-blocklist': '🚫 BLOCCATO DA BLOCKLIST TORRENT'
      };
      const category = categoryLabel[report.illegalContent.category] || '🚫 CONTENUTO ILLEGALE';
      const severityMap = {
        critical: { color: '#d32f2f', label: 'CRITICA' },
        high: { color: '#ff9800', label: 'ALTA' },
        medium: { color: '#ffb74d', label: 'MEDIA' }
      };
      const severityObj = severityMap[report.illegalContent.severity] || severityMap.high;
      const severityColor = severityObj.color;
      const confidenceLabel = report.illegalContent.confidence === 'confirmed' ? 'CONFERMATO' : 'PROBABILE';
      
      illegalBox.innerHTML = `
        <div class="illegal-content-header" style="color: ${severityColor};">
          <div class="illegal-content-icon" style="color: ${severityColor};">⛔</div>
          <div>
            <div class="illegal-content-title" style="color: ${severityColor};">${category}</div>
            <div class="illegal-content-severity">Gravità: <strong>${severityObj.label}</strong> · Confidenza: <strong>${confidenceLabel}</strong></div>
          </div>
        </div>
        <div class="illegal-content-body">
          <div class="illegal-reason"><strong>Motivo:</strong> ${report.illegalContent.reason}</div>
          <div class="illegal-details">
            ${report.illegalContent.details.map(d => `<div style="font-size: 13px; margin: 6px 0;">• ${d}</div>`).join('')}
          </div>
          <div class="illegal-warning" style="margin-top: 12px; padding: 10px; background: rgba(211, 47, 47, 0.1); border-left: 3px solid #d32f2f; border-radius: 4px; color: #b71c1c; font-size: 12px;">
            <strong>⚠️ Avvertenza:</strong> Questo sito ospita contenuto illegale e potrebbe esporre il tuo computer a malware, spyware e virus. <strong>Non consigliato</strong> per nessun motivo.
          </div>
        </div>
      `;
      reasons.appendChild(illegalBox);
      appendTipsBox(reasons, report.userTips || report.illegalContent?.advice || []);
      
      scoreValue.textContent = (typeof report.score === 'number' ? report.score : 5) + '%';
      scoreValue.style.background = '#d32f2f';
      scoreLabel.textContent = '🚫 CONTENUTO ILLEGALE';
      scoreLabel.style.color = '#d32f2f';
      return;
    }

    // Check if site doesn't exist / not reachable - PRIORITY 2
    if (report.siteExists && report.siteExists.exists === false) {
      reasons.innerHTML = '';
      const warningBox = document.createElement('div');
      warningBox.className = 'site-not-found-warning';
      warningBox.innerHTML = `
        <div class="site-not-found-icon">⚠️</div>
        <div class="site-not-found-title">SITO NON RAGGIUNGIBILE</div>
        <div class="site-not-found-reason">${report.siteExists.reason || 'Il sito non risponde'}</div>
        <div class="site-not-found-desc">Il dominio esiste ma il sito non è attualmente disponibile oppure l'URL è non valido.</div>
      `;
      reasons.appendChild(warningBox);
      appendTipsBox(reasons, report.userTips || []);
      
      scoreValue.textContent = '0%';
      scoreValue.style.background = '#d32f2f';
      scoreLabel.textContent = '🚫 NON RAGGIUNGIBILE';
      scoreLabel.style.color = '#d32f2f';
      return;
    }

    const s = report.score;
    scoreValue.textContent = s + '%';

    // Determine color and label
    let color = '#7fc97f';
    let label = 'Sicuro';
    if (s >= 80) { color = '#4caf50'; label='✓ SICURO'; }
    else if (s >= 60) { color = '#ffb74d'; label='⚠ SOSPETTO'; }
    else if (s >= 30) { color = '#ff9800'; label='⛔ RISCHIOSO'; }
    else { color = '#d32f2f'; label='🚫 PERICOLOSO'; }

    scoreValue.style.background = color;
    scoreLabel.textContent = label;
    scoreLabel.style.color = color;

    // Render detailed reasons
    reasons.innerHTML = '';
    appendSpecialNotice(reasons, report.specialNotice);
    let reputationSection = null;
    
    report.details.forEach((d, idx) => {
      if (d.isReputation) {
        // Create special reputation box
        const repBox = document.createElement('div');
        repBox.className = 'reputation-box';
        repBox.id = 'reputation-details';
        
        // Main reputation score
        const repScore = document.createElement('div');
        repScore.className = 'reputation-score';
        const repNum = report.reputation || 70;
        let repColor = '#d32f2f';
        let repLabel = '🚫 SCARSO';
        if (repNum >= 85) { repColor = '#4caf50'; repLabel = '✓ ECCELLENTE'; }
        else if (repNum >= 70) { repColor = '#ffb74d'; repLabel = '⚠ BUONO'; }
        else if (repNum >= 50) { repColor = '#ff9800'; repLabel = '⛔ MEDIO'; }
        
        repScore.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>📊 Indice di Affidabilità del Sito</strong><br>
              <span style="font-size: 24px; color: ${repColor}; font-weight: 700;">${repNum}%</span>
              <span style="margin-left: 12px; color: ${repColor}; font-weight: 600;">${repLabel}</span>
            </div>
          </div>
        `;
        reasons.appendChild(repScore);
        
        // Add justifications if available
        if (d.justifications && d.justifications.length > 0) {
          const justBox = document.createElement('div');
          justBox.className = 'justifications-box';
          justBox.innerHTML = '<strong style="display: block; margin-bottom: 8px; font-size: 14px;">Motivi del punteggio:</strong>';
          
          d.justifications.forEach(just => {
            const justItem = document.createElement('div');
            justItem.className = 'justification-item';
            justItem.innerHTML = `<span style="display: inline-block; margin-right: 6px;">•</span>${just}`;
            justBox.appendChild(justItem);
          });
          
          reasons.appendChild(justBox);
        }
        
        reputationSection = idx;
      } else if (d.isSiteContentScore) {
        const contentBox = document.createElement('div');
        contentBox.className = 'site-content-box';
        const levelMap = {
          low: { label: '✓ BASSO RISCHIO', color: '#4caf50' },
          medium: { label: '⚠ RISCHIO MEDIO', color: '#ff9800' },
          high: { label: '⛔ RISCHIO ALTO', color: '#d32f2f' },
          unknown: { label: '⚠ RISCHIO NON DEFINITO', color: '#ff9800' }
        };
        const level = levelMap[d.contentRiskLevel] || levelMap.unknown;
        contentBox.innerHTML = `
          <div class="site-content-head">
            <strong>🧠 Analisi Completa del Sito</strong>
            <span class="site-content-level" style="color: ${level.color};">${level.label}</span>
          </div>
          <div class="site-content-score">${d.message}</div>
        `;

        if (d.contentDetails && d.contentDetails.length > 0) {
          const detailWrap = document.createElement('div');
          detailWrap.className = 'site-content-details';
          d.contentDetails.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'site-content-detail-item';
            row.textContent = `• ${item}`;
            detailWrap.appendChild(row);
          });
          contentBox.appendChild(detailWrap);
        }

        reasons.appendChild(contentBox);
      } else if (d.isReputationDetail) {
        // Add to reputation section if not already started
        if (reputationSection === null) {
          const li = document.createElement('li');
          li.className = d.passed ? 'pass' : 'fail';
          li.style.fontSize = '13px';
          li.textContent = d.message;
          reasons.appendChild(li);
        } else {
          const li = document.createElement('li');
          li.className = d.passed ? 'pass' : 'fail';
          li.style.fontSize = '13px';
          li.style.marginLeft = '20px';
          li.textContent = d.message;
          reasons.appendChild(li);
        }
      } else {
        const li = document.createElement('li');
        li.className = d.passed ? 'pass' : 'fail';
        const weight = d.passed || !d.weight ? '' : ` (−${d.weight}%)`;
        li.textContent = d.message + weight;
        reasons.appendChild(li);
      }
    });

    appendTipsBox(reasons, report.userTips || []);
  }

  // Hook form with loading indicator
  const form = document.getElementById('urlForm');
  const input = document.getElementById('urlInput');
  if (form && input) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return input.focus();

      // Show loading state
      const resultEl = document.getElementById('result');
      if (resultEl) {
        resultEl.classList.remove('hidden');
        const reasons = document.getElementById('reasons');
        const scoreLabel = document.getElementById('scoreLabel');
        if (reasons) reasons.innerHTML = '<li style="color: #999;">⏳ Analisi in corso...</li>';
        if (scoreLabel) scoreLabel.textContent = '⏳';
      }

      const report = await analyzeUrl(val);
      renderResult(report);
    });
  }

  // Optional: Allow user to set Google Safe Browsing API key
  function showSettingsStatus(message, type) {
    const statusEl = document.getElementById('apiStatusMessage');
    if (!statusEl) return;
    statusEl.className = `settings-status ${type || ''}`.trim();
    statusEl.textContent = message;
  }

  async function validateGoogleApiKey(key) {
    const trimmed = (key || '').trim();
    if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(trimmed)) {
      return { ok: false, reason: 'Formato chiave Google non valido (atteso AIza...)' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT + 3000);
      const payload = {
        client: { clientId: 'whysafe', clientVersion: '1.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url: 'https://example.com' }]
        }
      };

      const response = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${trimmed}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'Chiave Google non autorizzata o non valida' };
      }

      if (!response.ok) {
        return { ok: false, reason: `Risposta API Google non valida (HTTP ${response.status})` };
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'Impossibile validare la chiave Google (rete o timeout)' };
    }
  }

  async function validateVirusTotalApiKey(key) {
    const trimmed = (key || '').trim();
    if (trimmed.length < 16) {
      return { ok: false, reason: 'Chiave VirusTotal troppo corta' };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT + 3000);
      const response = await fetch('https://www.virustotal.com/api/v3/users/current', {
        method: 'GET',
        headers: { 'x-apikey': trimmed },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'Chiave VirusTotal non valida o non autorizzata' };
      }

      if (!response.ok) {
        return { ok: false, reason: `Risposta API VirusTotal non valida (HTTP ${response.status})` };
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'Impossibile validare la chiave VirusTotal (rete o timeout)' };
    }
  }

  window.setGoogleApiKey = async (key) => {
    const trimmed = (key || '').trim();
    if (!trimmed) {
      showSettingsStatus('Inserisci una chiave Google Safe Browsing prima di salvare.', 'error');
      return;
    }

    showSettingsStatus('Validazione chiave Google in corso...', 'info');
    const validation = await validateGoogleApiKey(trimmed);
    if (!validation.ok) {
      showSettingsStatus(`Google Safe Browsing: ${validation.reason}`, 'error');
      return;
    }

    CONFIG.GOOGLE_SAFE_BROWSE_API = trimmed;
    localStorage.setItem('googleSafeBrowseKey', trimmed);
    showSettingsStatus('Google Safe Browsing configurato correttamente.', 'success');
    updateApiStatus();
  };

  window.setVirusTotalApiKey = async (key) => {
    const trimmed = (key || '').trim();
    if (!trimmed) {
      showSettingsStatus('Inserisci una chiave VirusTotal prima di salvare.', 'error');
      return;
    }

    showSettingsStatus('Validazione chiave VirusTotal in corso...', 'info');
    const validation = await validateVirusTotalApiKey(trimmed);
    if (!validation.ok) {
      showSettingsStatus(`VirusTotal: ${validation.reason}`, 'error');
      return;
    }

    CONFIG.VIRUSTOTAL_API = trimmed;
    localStorage.setItem('virusTotalApiKey', trimmed);
    showSettingsStatus('VirusTotal configurato correttamente.', 'success');
    updateApiStatus();
  };

  window.clearGoogleApiKey = () => {
    CONFIG.GOOGLE_SAFE_BROWSE_API = '';
    localStorage.removeItem('googleSafeBrowseKey');
    const gInput = document.getElementById('apiKeyInput');
    if (gInput) gInput.value = '';
    showSettingsStatus('Chiave Google Safe Browsing rimossa.', 'info');
    updateApiStatus();
  };

  window.clearVirusTotalApiKey = () => {
    CONFIG.VIRUSTOTAL_API = '';
    localStorage.removeItem('virusTotalApiKey');
    const vtInput = document.getElementById('vtApiKeyInput');
    if (vtInput) vtInput.value = '';
    showSettingsStatus('Chiave VirusTotal rimossa.', 'info');
    updateApiStatus();
  };

  // Listen for API key button click
  document.addEventListener('setApiKey', (e) => {
    window.setGoogleApiKey(e.detail);
  });

  document.addEventListener('setVtApiKey', (e) => {
    window.setVirusTotalApiKey(e.detail);
  });

  document.addEventListener('validateGsbKey', async (e) => {
    const key = e.detail || '';
    if (!key.trim()) {
      showSettingsStatus('Inserisci una chiave Google da validare.', 'error');
      return;
    }
    showSettingsStatus('Validazione chiave Google in corso...', 'info');
    const validation = await validateGoogleApiKey(key);
    showSettingsStatus(
      validation.ok ? 'Chiave Google valida.' : `Google Safe Browsing: ${validation.reason}`,
      validation.ok ? 'success' : 'error'
    );
  });

  document.addEventListener('validateVtKey', async (e) => {
    const key = e.detail || '';
    if (!key.trim()) {
      showSettingsStatus('Inserisci una chiave VirusTotal da validare.', 'error');
      return;
    }
    showSettingsStatus('Validazione chiave VirusTotal in corso...', 'info');
    const validation = await validateVirusTotalApiKey(key);
    showSettingsStatus(
      validation.ok ? 'Chiave VirusTotal valida.' : `VirusTotal: ${validation.reason}`,
      validation.ok ? 'success' : 'error'
    );
  });

  document.addEventListener('clearGsbKey', () => {
    window.clearGoogleApiKey();
  });

  document.addEventListener('clearVtKey', () => {
    window.clearVirusTotalApiKey();
  });

  // Show API status indicator
  function updateApiStatus() {
    const statusEl = document.querySelector('.api-config');
    if (!statusEl) return;

    let indicator = document.querySelector('.api-status-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'api-status-indicator';
      statusEl.appendChild(indicator);
    }

    const parts = [];
    if (CONFIG.GOOGLE_SAFE_BROWSE_API) parts.push('✓ Google Safe Browsing attivo');
    if (CONFIG.VIRUSTOTAL_API) parts.push('✓ VirusTotal attivo');

    if (parts.length === 0) {
      indicator.className = 'api-status-indicator neutral';
      indicator.textContent = 'Nessuna API configurata: Whysafe usa controlli locali + URLhaus.';
    } else {
      indicator.className = 'api-status-indicator';
      indicator.innerHTML = parts.join('<br>');
    }
  }

  // Initialize API status on page load
  setTimeout(updateApiStatus, 100);

})();