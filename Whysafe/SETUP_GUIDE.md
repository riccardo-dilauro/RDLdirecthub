# 🚀 SETUP GUIDATO - Whysafe Advanced URL Checker

## ⚡ Quick Start (2 minuti)

Whysafe funziona subito **senza configurazione**, ma per attivare la massima protezione con Google Safe Browsing segui qui.

---

## ✅ Verifica Prerequisiti

- [ ] Browser moderno (Chrome, Firefox, Edge, Safari 2023+)
- [ ] Connessione internet
- [ ] (Opzionale) Account Google Cloud gratuito

---

## 📋 Passo 1: Apri Whysafe

1. Apri il browser
2. Vai al file `index.html` di Whysafe
3. Dovresti vedere il logo e il form di input URL

**Lo strumento funziona SUBITO:**
- ✓ Controllo HTTPS
- ✓ Validazione dominio
- ✓ Rilevamento punycode/IDN
- ✓ URLhaus check (gratuito)
- ✓ E altri 6 controlli locali

---

## 🔑 Passo 2: (OPZIONALE) Configurare Google Safe Browsing

Se vuoi aggiungere il check di Google Safe Browsing:

### A) Creare account Google Cloud Console (se non hai)

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Clicca "Create Project"
3. Nome: `Whysafe-Safety-Check`
4. Clicca "CREATE"

### B) Abilitare Safe Browsing API

1. Nella console, vai a **APIs & Services** > **Library**
2. Cerca `Safe Browsing`
3. Clicca su "Safe Browsing API"
4. Clicca il bottone blu **"ENABLE"**
5. Aspetta 30 secondi

### C) Generare Chiave API

1. Vai a **APIs & Services** > **Credentials**
2. Clicca **"+ Create Credentials"** in alto
3. Seleziona **"API Key"**
4. Completato! Copia la chiave (simile a: `AIzaSyDm3A4l-6...`)

### D) Configurare in Whysafe

1. Scorri down su Whysafe fino a **"⚙️ Configurazione API"**
2. Incolla la chiave nel campo
3. Clicca **"Salva Chiave"** 
4. Vedrai ✓ "API Key salvata nel browser locale"
5. **FATTO!** Ora hai accesso a Google Safe Browsing

---

## 🧪 Prova il Sistema

### Testa con URL Sicuri

```
https://www.google.com
https://www.wikipedia.org
https://github.com
```

**Risultato atteso:** 90-100% SICURO ✓

### Testa con URL Sospetti (NON VISITARE - solo test!)

```
https://bit.ly/xxx
http://example.tk
https://192.168.1.1
user@example.com
```

**Risultato atteso:** 0-60% SOSPETTO/PERICOLOSO ⛔

---

## 🔍 Cosa Viene Controllato

### Automaticamente (Nessuna Setup)
- [x] HTTPS presente
- [x] IP address vs dominio
- [x] Punycode/IDN spoofing
- [x] TLD sospetti
- [x] URL troppo lungo
- [x] Caratteri @ e null bytes
- [x] Typosquatting
- [x] URLhaus database

### Con API Key Google (Dopo setup)
- [x] Malware database globale
- [x] Phishing database globale
- [x] Software indesiderato
- [x] Applicazioni potenzialmente nocive

---

## 🎯 Livelli di Punteggio Spiegati

| Punteggio | Livello | Azione |
|-----------|---------|--------|
| **80-100%** | ✓ SICURO | Visitare con fiducia |
| **60-79%** | ⚠ SOSPETTO | Verificare meglio prima di visitare |
| **30-59%** | ⛔ RISCHIOSO | Evitare; usare sandbox se necessario |
| **0-29%** | 🚫 PERICOLOSO | Non visitare; potrebbe infettare |

---

## ⚙️ Configurazione Avanzata

### Aumentare Timeout (per connessioni lente)

Apri `script.js` e trovai questa riga:

```javascript
REQUEST_TIMEOUT: 5000  // 5 seconds
```

Cambia in:

```javascript
REQUEST_TIMEOUT: 10000  // 10 seconds (per ISP lenti o mobile)
```

Salva il file, ricarica il browser.

### Disabilitare il Caching

Se vuoi che ogni richiesta sia sempre fresca:

Apri `script.js` e commenta queste 2 linee (aggiungi `//`):

```javascript
// setCachedResult(cacheKey, result);
// const cached = getCachedResult(cacheKey);
```

---

## 🔒 Privacy e Sicurezza

### Dove viene salvato il tuo dato
- **Chiave API:** Solo nel localStorage del browser (non nel cloud)
- **URL controllati:** NON salvati da noi
- **Risultati:** Mantieni solo tu

### Cosa sappiamo
- **Niente.** Nessun server backend di Whysafe.
- Le API esterne (URLhaus, Google) sanno che hai controllato un URL.

### Come proteggere la chiave API
1. **Non condividerla mai** (vale come password)
2. **Non farla apparire** in screenshot pubblici
3. Se esposta, vai a Google Cloud Console e eliminala
4. **Genera una nuova chiave** subito

---

## 🐛 Troubleshooting

### Problema: "Punteggio a 0% per tutto"

**Soluzione:**
1. Recarica completamente il browser (Ctrl+Shift+R)
2. Verifica che script.js sia stato caricato (F12 → Console → nessun errore rosso)

### Problema: "URL che è già stato controllato non aggiorna il punteggio"

**Soluzione:** Questo è intenzionale (caching 1 ora). Come disabilitare:
1. Apri browser DevTools (F12)
2. Vai a Storage → localStorage
3. Elimina `googleSafeBrowseKey` e reset i cache
4. O semplicemente aspetta 1 ora

### Problema: "Controllare URL offline non funziona"

**Soluzione:**
- Analisi locale funziona offline
- Controlli URLhaus e Google richiedono internet
- Se sei offline, vedrai solo i controlli locali

---

## 📞 Supporto

- **I controlli locali non funzionano?** Controlla console del browser (F12)
- **API non rispondono?** Potrebbe essere down; riprova più tardi
- **Performance issue?** Aumenta REQUEST_TIMEOUT come sopra

---

## 🎓 Impara di Più

Leggi `API_CHECKER_README.md` per:
- Spiegazione dettagliata di ogni controllo
- Come le API esterne funzionano
- Riferimenti tecnici in fondo

---

## ✨ Pronto!

✓ Whysafe è ora configurato al massimo!

Torna alla página home e comincia a controllare URL.

**Buona protezione!** 🛡️
