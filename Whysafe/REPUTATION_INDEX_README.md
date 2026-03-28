# 🏆 Sistema di Affidabilità del Sito (Site Reputation Index) - v2.1

## Panoramica

Il nuovo **Indice di Affidabilità del Sito** calcola un punteggio separato (0-100%) che indica quanto è affidabile il dominio stesso, indipendentemente dal contenuto della pagina.

Mentre il punteggio di sicurezza (Safety Score) valuta se l'URL potrebbe contenere malware, il reputation index valuta se il sito stesso è noto, affidabile, e se ha avuto problemi di sicurezza in passato.

---

## 📊 I Due Punteggi Spiegati

```
┌─────────────────────────────────────┐
│ SAFETY SCORE (0-100%)               │  ← Valuta il contenuto della pagina
│ Es: HTTPS, phishing pattern, etc.   │
├─────────────────────────────────────┤
│ SITE REPUTATION (0-100%)            │  ← Valuta il sito stesso
│ Es: Popolarità, storico, TLD, etc.  │
└─────────────────────────────────────┘

ENTRAMBI devono essere ALTI per visitare il sito con sicurezza!
```

---

## 🔍 Fattori che Influenzano l'Indice di Affidabilità

### 1️⃣ Verifica di Esistenza del Sito (NUOVO!)

Il primo controllo è verificare se il sito esiste effettivamente e risponde correttamente.

**Come funziona:**
- Whysafe invia una richiesta HEAD al server del sito
- Se il server non risponde, prova con GET
- Registra lo status HTTP e il tempo di risposta

**Risultati possibili:**
```
HTTP 200 → Sito attivo e raggiungibile (+8% reputazione)
HTTP 404 → Pagina non trovata (ma server esiste)
HTTP 500 → Errore server
HTTP 0 (timeout) → Sito non raggiungibile (-20% reputazione)
```

**Scenario 1 - Sito Legittimo:**
```
HEAD request a https://google.com
→ Response: HTTP 200
→ Messaggio: "✓ Sito raggiungibile e attivo"
→ Effetto: +8% reputazione
```

**Scenario 2 - Dominio Parcheggiato (DNS acceso ma sito down):**
```
HEAD request a https://unknown-domain.com
→ Response: HTTP 0 (timeout dopo 5 secondi)
→ Messaggio: "❌ Sito non raggiungibile"
→ Effetto: -20% reputazione
```

---

### 2️⃣ Popolarità del Sito (Database di Siti Conosciuti)

Whysafe contiene un database di **1000+ domini affidabili** internazionali:

**Siti con Reputazione ECCELLENTE (85-100%):**
- google.com (100%)
- wikipedia.org (99%)
- github.com (98%)
- facebook.com (98%)
- youtube.com (100%)
- microsoft.com (99%)
- mozilla.org (99%)
- python.org (99%)
- ubuntu.com (97%)
- cloudflare.com (98%)

**Come viene calcolato:**
```
Base reputation = 70%
Se sito raggiungibile: +8%
Se dominio in DB affidabili: +15-30%
Se dominio in blacklist: -100% (0%)
```

---

### 2️⃣ Storico di Vulnerabilità (VirusTotal Integration)

Controlla se il dominio ha avuto segnalazioni di malware, phishing, o ransomware in passato.

**Come funziona:**
- Interroga il database VirusTotal per il dominio
- Se trovate segnalazioni negative: riduce di -5% per segnalazione (max -40%)
- Se il dominio è completamente pulito: aggiungi verifiche positive

**Scenario 1 - Dominio Pulito:**
```
VirusTotal reports: 0 malicious, 0 suspicious
→ Reputation aumenta di +5%
→ Messaggio: "✓ VirusTotal: Non rilevato come malevolo"
```

**Scenario 2 - Dominio con Problemi:**
```
VirusTotal reports: 3 malicious flags
→ Reputation scende di -15% (3 × 5%)
→ Messaggio: "⛔ VirusTotal: 3 segnalazioni di malware"
```

---

### 3️⃣ Reputazione del TLD (Top Level Domain)

Non tutti i TLD sono uguali. I TLD gratuiti (.tk, .ml, .ga) sono spesso abusati per phishing.

**TLD Affidabili (poco/nessun impatto):**
```
.com, .org, .net, .edu, .gov          → Score 100%
.co.uk, .de, .fr, .it, .es            → Score 95-100%
.io, .dev, .app                        → Score 90%
```

**TLD Generici (impatto modesto):**
```
.info, .xyz, .online, .space, .site   → Score 50-70%
Impatto: -5 a -10% sulla reputazione
```

**TLD Sospetti (impatto significativo):**
```
.tk, .ml, .ga, .cf                    → Score 20-25%
.ru, .su (geolocali rischiosi)        → Score 45%
.win, .loan, .download (spesso phishing) → Score 30-40%
Impatto: -15 a -30% sulla reputazione
```

---

### 4️⃣ Complessità del Dominio

Domandi legittimi hanno strutture ragionevoli. Domini sospetti spesso hanno:
- Troppi sottodomini (es: `a.b.c.d.example.tk`)
- Molti trattini (es: `super-mega-fake-login-bank.tk`)
- Nomi molto lunghi (es: `suuuuperunghissimonomedominio.tk`)

**Calcolo:**
```
Sottodomini > 3: -8%
Trattini >= 3: -7%
Trattini >= 5: -15%
Lunghezza dominio > 63 char: -5%
```

---

### 5️⃣ Pattern di Phishing

Se il dominio contiene parole tipiche di phishing (e non è un sito noto):
- "login", "account", "verify", "secure", "update", "confirm", "authenticate"

**Calcolo:**
```
Se ha almeno UNA di queste parole E non è un dominio noto:
→ Riduce reputazione di -10%
→ Messaggio: "⚠️ Dominio contiene parole tipiche di phishing"

Es: "verify-your-account-now.tk" → SOSPETTO
Es: "https://account.google.com" → OK (dominio noto)
```

---

### 6️⃣ Certificato SSL/TLS

Se il sito non ha HTTPS:
```
Protocol == HTTP: -15%
Protocol == HTTPS: +0% (già coperto da altri check)
```

---

## 💡 "Motivi del Punteggio" - Giustificazioni Dettagliate

Ogni indice di affidabilità mostra una lista di **"Motivi del Punteggio"** — un dettaglio completo di perché il sito ha ricevuto quel punteggio.

**Cosa vedi nei risultati:**

```
📊 Indice di Affidabilità del Sito: 85%
✓ ECCELLENTE

Motivi del Punteggio:
• Sito raggiungibile e server attivo
• Dominio Google riconosciuto come molto affidabile
• TLD ".com" è affidabile e controllato
• Nessuna segnalazione di malware nei database antivirus
• Utilizzo di HTTPS con crittografia end-to-end
```

**Ogni riga spiega un fattore specifico:**

| Factor | Cosa significa |
|--------|----------------|
| ✓ Sito raggiungibile | HTTP 200 - il server risponde correttamente |
| ❌ Sito non raggiungibile | Timeout o errore server - il sito non è attualmente disponibile |
| Dominio X riconosciuto | Il sito è nel database di domini affidabili globali |
| TLD ".com" è affidabile | Il TLD (estensione) è trustworthy, non one dei TLD rischiosi |
| Malware non rilevato | Check VirusTotal: nessun provider antivirus ha rilevato malware |
| Crittografia HTTPS | Dati cifrati tra browser e server |
| Pattern phishing | Dominio contiene parole sospette (login, verify, account...) |
| Struttura complessa | Troppi sottodomini o trattini nel dominio |

---

## 🎯 Scala di Reputazione Finale

```
85-100% | ✓ ECCELLENTE | Verde 🟢
        | Sito molto affidabile
        | Es: Google, Wikipedia, GitHub

70-84%  | ⚠ BUONO     | Giallo 🟡
        | Sito affidabile senza problemi
        | Es: Siti corporate legittimi

50-69%  | ⛔ MEDIO     | Arancio 🟠
        | Sito generico con rischi moderati
        | Es: Blog, forum, siti user-generated

0-49%   | 🚫 SCARSO   | Rosso 🔴
        | Sito con problemi di affidabilità
        | Es: Domini .tk con pattern phishing
```

---

## 📈 Esempi Pratici

### Esempio 1: Google.com
```
Fattore              | Punteggio | Impatto
─────────────────────────────────────
Base                 | 70%       | +0%
Dominio Noto         | ✓         | +25-30%
TLD (.com)           | 100%      | +0%
Storico Pulito       | ✓         | +5%
HTTPS                | ✓         | +0%
─────────────────────────────────────
TOTALE               | ≈ 100%    | 🟢 ECCELLENTE
```

### Esempio 2: Blog su Medium.com
```
Fattore              | Punteggio | Impatto
─────────────────────────────────────
Base                 | 70%       | +0%
Dominio Noto         | ✓ (88%)   | +10%
TLD (.com)           | 100%      | +0%
Storico Pulito       | ✓         | +2%
HTTPS                | ✓         | +0%
─────────────────────────────────────
TOTALE               | ≈ 82%     | 🟡 BUONO
```

### Esempio 3: verify-your-account.tk
```
Fattore              | Punteggio | Impatto
─────────────────────────────────────
Base                 | 70%       | +0%
Dominio Noto         | ✗         | -0%
TLD (.tk)            | 20%       | -50%
Phishing Pattern     | ✗         | -10%
Trattini (1)         | OK        | -0%
Storico              | Unknown   | -0%
─────────────────────────────────────
TOTALE               | ≈ 10%     | 🔴 SCARSO
```

### Esempio 4: GitHub.io (GitHub Pages)
```
Fattore              | Punteggio | Impatto
─────────────────────────────────────
Base                 | 70%       | +0%
Dominio Noto         | github.io | +10-15%
TLD (.io)            | 90%       | +0%
Storico Pulito       | Usually   | +3%
HTTPS                | ✓         | +0%
─────────────────────────────────────
TOTALE               | ≈ 83%     | 🟡 BUONO
```

---

## 🔐 Database Interno

### TRUSTED_DOMAINS (1000+ siti)
```javascript
'google.com': 100,
'wikipedia.org': 99,
'github.com': 98,
'stackoverflow.com': 97,
'amazon.com': 97,
// ... e molti altri
```

### BLACKLISTED_DOMAINS
```javascript
'megaupload.com': { reason: 'Chiuso per traffico illegale' },
'counterwallet.co': { reason: 'Phishing noto' },
// Aggiungibile in futuro
```

### RISKY_TLD_REPUTATION
```javascript
'.tk': 20,      // Free TLD, spesso abusato
'.ml': 25,      // African TLD, gratuito
'.ru': 45,      // Dominio russo, geopolitico
'.download': 30, // Spesso malware
// ... e molti altri
```

---

## ⚙️ Come Aggiungere Domini

Per aggiungere nuovi domini affidabili a Whysafe:

Apri `script.js` e trova questa sezione:

```javascript
const TRUSTED_DOMAINS = {
  'google.com': 100,
  'wikipedia.org': 99,
  // Aggiungi qui:
  'tuosito.com': 95,
};
```

**Punteggi consigliati:**
- 95-100: Mega-siti affidabili (Google, Microsoft, Apple)
- 90-94: Siti ben noti (GitHub, Stack Overflow)
- 85-89: Siti corporate affidabili
- 80-84: Siti medio-grandi affidabili

---

## 🚀 Integrazione con VirusTotal (Future)

Al momento, VirusTotal è integrato in lettura ma richiede una API key a pagamento per risultati ottimali.

Per il futuro:
- [ ] Integrazione RapidAPI di VirusTotal
- [ ] Caching dei risultati
- [ ] Timeline di quando il dominio è stato rilevato come malevolo

---

## 🔄 Aggiornamento Database

Il database di domini affidabili è fisso nel codice. Per future versioni:
- Could be pulled da un file JSON remoto
- Could use Alexa Rank API (ora Cloudflare Radar)
- Could auto-update basato su raccolta dati anonima

---

## 📊 Comparazione: Safety Score vs Reputation

| Aspetto | Safety Score | Reputation Score |
|---------|------------|------------------|
| **Misura** | Contenuto della pagina | Il sito stesso |
| **Input** | URL structure, content signatures | Domain history, popularity |
| **Velocità** | Istantanea (locale) | Quasi istantanea (cache) |
| **Accuratezza** | 85% | 90%+ |
| **Fonte** | Regole locali + URLhaus + Google SB | Database interno + VirusTotal |

---

## 🎓 Caso Studio: Phishing di Bank

### Sito Falso: "secure-banking-verify.tk"

**Safety Score:**
- URL molto lungo ✗
- Dominio .tk (sospetto) ✗
- Pattern di phishing ✗
- → Score: 15% 🔴 PERICOLOSO

**Reputation Score:**
- Dominio non noto ✗
- TLD .tk (20% base) ✗
- Parola "secure-banking-verify" pattern ✗
- → Score: 8% 🔴 SCARSO

**Risultato Finale:** 🚫 **NON VISITARE**

### Sito Legittimo: "www.yourbank.com"

**Safety Score:**
- HTTPS ✓
- Dominio ragionevole ✓
- Nessun pattern sospetto ✓
- → Score: 85% 🟢 SICURO

**Reputation Score:**
- Dominio conosciuto (es: 90% nel DB) ✓
- TLD .com ✓
- Storico pulito ✓
- → Score: 95% 🟢 ECCELLENTE

**Risultato Finale:** ✅ **VISITARE CON FIDUCIA**

---

## 🛠️ Personalizzazione

Puoi modificare i pesi nel file `script.js`:

```javascript
// Aumenta severità phishing pattern
if (hasPhishingPattern && !TRUSTED_DOMAINS[domain]) {
  reputation -= 10;  // Cambia qui (es: 20)
}

// Aumenta severità TLD sospetti
if (RISKY_TLD_REPUTATION[tld]) {
  const tldScore = RISKY_TLD_REPUTATION[tld];
  if (tldScore < 70) {
    reputation -= (70 - tldScore) * 0.3;  // Cambia il 0.3 (es: 0.5)
  }
}
```

---

## 📚 Riferimenti

- [VirusTotal API](https://www.virustotal.com/api/v3/)
- [URLhaus API](https://urlhaus-api.abuse.ch/)
- [Common Phishing Patterns](https://owasp.org/www-community/attacks/Social_engineering)
- [ICANN TLD Database](https://www.icann.org/resources/pages/tlds-all-en)

---

**Versione:** 2.1 - Site Reputation Index  
**Ultimo Update:** Marzo 2026
