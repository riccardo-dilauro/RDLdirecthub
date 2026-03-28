# Whysafe - Sistema di Controllo URL Avanzato 🔍

## Panoramica

**Whysafe** è stato migliorato con un sistema di controllo URL **multi-livello** che combina:
- ✓ **Analisi locale avanzata** (eseguita istantaneamente nel browser)
- ✓ **Controlli API esterne** (database di siti malevoli globali)
- ✓ **Caching intelligente** (rispetta i rate limits delle API)

---

## 🏗️ Architettura del Sistema

### Livello 1: Analisi Locale (Instantanea)

Questi controlli vengono eseguiti direttamente nel browser senza contattare server esterni:

| Controllo | Peso | Descrizione |
|-----------|------|------------|
| **HTTPS** | -40% | Presenza di crittografia SSL/TLS |
| **IP Address** | -35% | Uso di IP instead di dominio (molto sospetto) |
| **Punycode/IDN** | -20% | Possibile spoofing di dominio internazionale |
| **TLD Sospetti** | -15% | Domini .tk, .ml, .ga, .cf, .su, .ru |
| **URL Lungo** | -8/-18% | Possibile obfuscation (>75 o >100 char) |
| **Caratteri @** | -25% | Tecnica di phishing nota (user@domain) |
| **Null Bytes** | -20% | Tentativo di injection (%00, %0d, %0a) |
| **Typosquatting** | -7/-15% | Molti trattini nel dominio (>3-5) |
| **URL Abbreviati** | -15% | URL shortener (bit.ly, tinyurl, goo.gl) |
| **Query Lungo** | -5/-12% | Query string sospettosamente lunga |

**Punteggio iniziale:** 100%

---

### Livello 2: Verifiche Esterne

#### 🟢 URLhaus (Gratuito - No API Key)
- **Cosa fa:** Controlla il database di URLhaus, un'iniziativa community che raccoglie siti malevoli
- **Sorgente:** I ricercatori di malware e ricercatori di sicurezza segnalano siti malevoli
- **Risultato:** Se trovato, riduce il punteggio di -50% e mostra:
  - Tipo di minaccia (malware, phishing, defacement, etc.)
  - Tag specifici (es. "Emotet", "Trickbot", etc.)
- **Privacy:** URLhaus non traccia gli utenti che fanno richieste

**Endpoint:** `https://urlhaus-api.abuse.ch/v1/url/`

---

#### 🔵 Google Safe Browsing (Gratuito - Richiede configurazione)
- **Cosa fa:** Controlla il database globale di Google che protegge +4 miliardi di dispositivi
- **Sorgente:** Google raccoglie segnalazioni da:
  - Ricercatori di sicurezza
  - Utenti che segnalano siti pericolosi
  - Crawler automatici di Google
- **Risultato:** Se rilevato, riduce il punteggio di -60% e mostra:
  - Tipo di minaccia (MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, etc.)
  - Classificazione esatta
- **Privacy:** Google riceve solo il digest dell'URL, non i tuoi dati personali

**Endpoint:** `https://safebrowsing.googleapis.com/v4/threatMatches:find`
**Richiede:** Chiave API (configurabile da UI)

---

## 🔑 Come Configurare Google Safe Browsing API

### Passo 1: Creare una chiave API

1. Vai a **[Google Cloud Console](https://console.cloud.google.com/)**
2. Crea un nuovo progetto (o usa uno esistente)
3. Vai a **APIs & Services** → **Library**
4. Cerca **"Safe Browsing API"** e clicca **Enable**
5. Vai a **APIs & Services** → **Credentials**
6. Clicca **"Create Credentials"** → **API Key**
7. Copia la chiave generata

### Passo 2: Configurare in Whysafe

1. Sulla pagina di Whysafe, scorri fino a **"⚙️ Configurazione API"**
2. Incolla la chiave nel campo di input
3. Clicca **"Salva Chiave"**
4. Apparirà un messaggio di conferma ✓
5. **La chiave è salvata solo nel tuo browser** (localStorage)

```
💡 La chiave è PERSONALE e RISERVATA. Non condividerla!
Se compromessa, eliminala da Google Cloud Console.
```

---

## 📊 Scala di Punteggio

```
80-100% | ✓ SICURO          | Verde  | Probabilmente legittimo
60-79%  | ⚠ SOSPETTO        | Giallo | Verificare con attenzione
30-59%  | ⛔ RISCHIOSO      | Arancio| Evitare se possibile
0-29%   | 🚫 PERICOLOSO    | Rosso  | Non visitare
```

---

## 🚀 Flusso di Analisi

```
Input URL (es: "example.com")
    ↓
[STEP 1] Normalizzazione URL → "https://example.com"
    ↓
[STEP 2] Validazione (è un URL valido?)
    ↓
[STEP 3] Analisi Locale (tutti i 9 controlli)
    ↓ Punteggio intermedio (es: 100% → 70%)
    ↓
[STEP 4] Verifiche Esterne in PARALLELO:
    ├─→ URLhaus API (timeout: 5s)
    └─→ Google Safe Browsing API (timeout: 5s, se configurato)
    ↓
[STEP 5] Aggregazione risultati
    ↓ Punteggio finale (es: 70% → 10% se trovato)
    ↓
[STEP 6] Rendering UI con spiegazioni dettagliate
```

---

## ⏱️ Performance e Caching

### Timeout
- Ogni richiesta API ha un timeout di **5 secondi**
- Se l'API non risponde, il controllo viene saltato (non penalizza il punteggio)
- L'analisi locale è sempre completata (instantanea)

### Caching
- I risultati sono memorizzati nel browser per **1 ora**
- Se verifichi lo stesso URL entro 1 ora, usi il risultato in cache
- Riduce il carico sulle API esterne

### Rate Limiting
- URLhaus: Illimitato (pubblico)
- Google Safe Browsing: 10,000 richieste/giorno (gratuito), poi pagato

---

## 🔒 Privacy e Sicurezza

### Cosa sappiamo di te
- **Niente.** Zero tracciamento.
- Nessun cookie, nessun local storage di identificatori

### Cosa sanno le API esterne
| API | Cosa riceve | Non riceve |
|-----|------------|-----------|
| **URLhaus** | URL della richiesta | Nessun identificatore di utente |
| **Google Safe Browsing** | Hash dell'URL (non l'URL completo) | Nessun identificatore di utente |

### Dove archiviamo la chiave API
- **Solo nel tuo browser** (localStorage)
- **Non è mai inviata** a server esterni (eccetto Google Safe Browsing quando la usi)
- Se cancelli il cache del browser, è eliminata

---

## 🛠️ Configurazione Avanzata

### Variabili di Ambiente (nel file `script.js`)

```javascript
const CONFIG = {
  GOOGLE_SAFE_BROWSE_API: localStorage.getItem('googleSafeBrowseKey') || '',
  URLHAUS_API: 'https://urlhaus-api.abuse.ch/v1/url/',
  ABUSEIPDB_API: 'https://api.abuseipdb.com/api/v2/check',
  CACHE_DURATION: 3600000,  // 1 ora in millisecondi
  REQUEST_TIMEOUT: 5000     // 5 secondi timeout
};
```

### Modificare il Timeout
Cambia `REQUEST_TIMEOUT` in `script.js`:
```javascript
REQUEST_TIMEOUT: 10000  // 10 secondi (per connessioni lente)
```

### Disabilitare il Caching
Commenta le linee di caching:
```javascript
// setCachedResult(cacheKey, result);  // Disabilitato
// const cached = getCachedResult(cacheKey);  // Disabilitato
```

---

## 📝 Struttura del Risultato

Ogni controllo restituisce un oggetto con:
```javascript
{
  rule: 'https',              // ID del controllo
  passed: false,              // Risultato (true/false)
  weight: 40,                 // Punti detratti se fallito
  message: '❌ Non usa HTTPS' // Messaggio per l'utente
}
```

---

## 🐛 Troubleshooting

### "La chiave API non funziona"
1. Verifica che sia una chiave **Browser** originale di Google Cloud
2. Assicurati che **Safe Browsing API** sia abilitata nel progetto
3. Controlla la [Google Cloud Console](https://console.cloud.google.com/) per gli errori

### "I controlli sono lenti"
1. Aumenta `REQUEST_TIMEOUT` da 5000 a 10000 ms
2. Verifica la tua connessione internet
3. Prova a cancellare il cache del browser

### "URLhaus non funziona"
1. È possibile che il servizio sia temporaneamente down
2. Prova con un altro URL
3. I controlli locali continueranno a funzionare comunque

---

## 📚 Riferimenti

- [URLhaus API Documentation](https://urlhaus-api.abuse.ch/)
- [Google Safe Browsing Documentation](https://developers.google.com/safe-browsing)
- [Google Safe Browsing Privacy](https://safebrowsing.google.com/)
- [OWASP URL Security](https://owasp.org/www-community/attacks/Social_engineering)

---

## ✨ Versioni Future (Roadmap)

- [ ] Supporto per VirusTotal API
- [ ] Analisi della reputazione del dominio (WHOIS)
- [ ] Check certificato SSL dettagliato
- [ ] Storico delle analisi (nel browser)
- [ ] Export risultati in PDF/JSON
- [ ] Integrazione browser extension

---

**Ultima aggiornamento:** Marzo 2026  
**Versione:** 2.0 - Advanced Multi-API Checker
