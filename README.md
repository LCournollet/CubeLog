# CubeLog

**Chronomètre de speedcubing local** — une alternative simple, fiable et agréable à csTimer, pensée pour un timer externe **Stackmat-like** (QiYi / QY Toys) branché sur l'entrée micro du PC.

CubeLog enregistre tes temps, génère les mélanges (notation technique **et** version débutant avec flèches), calcule les statistiques WCA et stocke tout en local dans une base SQLite. Application **desktop** construite avec **Tauri 2 + React + TypeScript** (UI) et **Rust** (audio, base de données, exports).

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Lancement en développement](#lancement-en-développement)
- [Build Windows](#build-windows)
- [Branchement du timer](#branchement-du-timer)
- [Diagnostic & dépannage audio](#diagnostic--dépannage-audio)
- [Tests](#tests)
- [Schéma SQLite](#schéma-sqlite)
- [Licence](#licence)

---

## Fonctionnalités

- **3 modes de chronométrage**
  - 🎙 **Timer externe** via micro (décodage du signal Stackmat-like).
  - ⌨ **Clavier** (maintien de la barre Espace = prêt, relâche = départ, appui = arrêt).
  - ✎ **Saisie manuelle** d'un temps.
- **Inspection WCA 15 s** optionnelle (alertes 8 s / 12 s, +2 et DNF selon les règles).
- **Mélanges 3x3** générés avec contraintes anti-redondance, architecture extensible aux autres puzzles.
- **Double affichage du mélange** : notation technique à gauche, **version débutant avec flèches** et explications à droite — pour apprendre et comparer.
- **Gestion des solves** : +2, DNF, suppression/restauration, notes, copie du temps et du mélange.
- **Statistiques WCA** : best/worst single, moyenne, Ao5/Ao12/Ao50/Ao100 (courantes et meilleures), taux de DNF, courbes d'évolution et distribution.
- **Sessions multiples** (3x3 entraînement, OH, compétition maison…).
- **Import/Export** CSV et JSON.
- **Diagnostic audio** intégré (vumètre, octets décodés, auto-test sans micro, calibration).
- **Thème sombre/clair**, formats de temps configurables.

---

## Architecture

Séparation stricte entre logique métier, UI et backend.

```
CubeLog/
├── src/                      # Frontend React + TypeScript
│   ├── core/                 # Logique métier PURE (testée, sans React)
│   │   ├── scramble/         # génération, parser, notation débutant
│   │   ├── stats/            # moyennes WCA, séries de graphiques
│   │   ├── timing/           # state machine clavier, inspection
│   │   ├── format/           # formatage / parsing des temps
│   │   └── solve/            # calcul des pénalités
│   ├── api/                  # wrappers typés des commandes Tauri (seul point d'accès au backend)
│   ├── store/                # état global (zustand)
│   ├── hooks/                # hooks React (timers, audio, format)
│   ├── components/           # composants UI réutilisables
│   ├── pages/                # écrans (Timer, Stats, Sessions, Connexion, Diagnostic, Paramètres)
│   └── styles/               # CSS global + thèmes
└── src-tauri/                # Backend Rust
    └── src/
        ├── db/               # SQLite : migrations, modèles, repos (sessions/solves/settings)
        ├── audio/            # capture micro (cpal) + décodeur Stackmat
        ├── export/           # CSV / JSON
        ├── commands.rs       # commandes exposées au frontend
        └── lib.rs            # bootstrap Tauri
```

Principes : types TypeScript stricts, aucune logique métier dans les composants React (tout passe par les stores et `core/`), gestion d'erreurs unifiée côté Rust (`AppError`).

---

## Prérequis

- **Node.js** ≥ 18 et **npm**.
- **Rust** (toolchain stable, cible `x86_64-pc-windows-msvc` sur Windows) — voir <https://rustup.rs>.
- **Microsoft C++ Build Tools** (linker MSVC + Windows SDK) sur Windows.
  - Si l'espace disque sur `C:` est limité, on peut installer sur un autre disque :
    ```powershell
    winget install --id Rustlang.Rustup
    # Build Tools (composants minimaux) — adapter --installPath au besoin :
    & "$env:TEMP\vs_BuildTools.exe" --quiet --wait --norestart `
      --installPath "D:\VS\BuildTools" `
      --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
      --add Microsoft.VisualStudio.Component.Windows11SDK.22621
    ```
- **WebView2 Runtime** (préinstallé sur Windows 11 ; sinon disponible chez Microsoft).

> macOS / Linux : l'app est cross-platform. Sur Linux, installer les dépendances système Tauri (WebKitGTK, etc.) — voir la doc Tauri. Sur macOS, installer les Xcode Command Line Tools.

---

## Installation

```bash
git clone <repo> CubeLog
cd CubeLog
npm install
```

---

## Lancement en développement

```bash
npm run tauri:dev
```

Cela démarre le serveur Vite (port 1420) **et** l'application Tauri avec rechargement à chaud du frontend. La base SQLite est créée automatiquement au premier lancement dans le dossier de données de l'application.

Autres scripts utiles :

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur Vite seul (UI dans le navigateur, sans backend Tauri). |
| `npm run test` | Tests unitaires TypeScript (vitest). |
| `npm run typecheck` | Vérification de types stricte. |
| `cargo test` *(dans `src-tauri/`)* | Tests Rust (décodeur Stackmat, base de données). |

---

## Build Windows

```bash
npm run tauri:build
```

Génère un exécutable et des installateurs dans `src-tauri/target/release/bundle/` :

- `msi/CubeLog_x.y.z_x64_en-US.msi`
- `nsis/CubeLog_x.y.z_x64-setup.exe`

L'exécutable seul se trouve dans `src-tauri/target/release/CubeLog.exe`.

---

## Branchement du timer

CubeLog lit le signal **audio** émis par un timer Stackmat-like (SpeedStacks Gen3/4, QiYi/QY Toys) — comme csTimer.

1. Branche le **jack** du timer sur l'**entrée micro / ligne** du PC (via une rallonge jack mâle-mâle si besoin).
2. Mets des **piles neuves** dans le timer (un signal faible vient souvent de piles usées).
3. Dans Windows, ouvre les **paramètres de son** et :
   - sélectionne le bon périphérique d'entrée,
   - **désactive** les améliorations/réductions de bruit du micro,
   - monte le **volume d'entrée** à ~80–100 %.
4. Dans CubeLog → onglet **Connexion timer** :
   - choisis le périphérique d'entrée,
   - clique **Démarrer la capture**,
   - lance une résolution sur le timer : tu dois voir le vumètre bouger, l'état passer à *En cours* puis *Arrêté*, et la **qualité de décodage** monter.
5. Passe en mode **🎙 Timer** sur l'écran principal : les temps s'enregistrent automatiquement à l'arrêt du chrono.

> CubeLog n'enregistre un solve que lors de la transition **running → stopped** avec un temps valide, ignore les glitches courts (< 200 ms) et applique un **anti-rebond** configurable pour éviter les doublons.

---

## Diagnostic & dépannage audio

Onglet **Diagnostic audio**. Le décodeur est paramétrable (inversion, seuil/sensibilité) et fournit un **mode debug** affichant les octets décodés.

**Marche à suivre recommandée :**

1. **Auto-test (sans micro)** : génère un signal Stackmat synthétique et le décode. S'il réussit ✅, la chaîne de décodage fonctionne — le problème vient du réglage micro.
2. **Vumètre** : si le niveau ne bouge pas → mauvais périphérique, jack mal branché, ou entrée muette dans Windows.
3. **Signal détecté mais 0 trame décodée** : la **polarité est auto-détectée** (le décodeur teste les deux sens en parallèle), donc inutile de la régler. Si rien ne se décode :
   - vérifie que le **bon périphérique** est choisi et que le vumètre bouge,
   - ajuste le **seuil / sensibilité** (0,20–0,30 en général ; baisse-le si le signal est faible),
   - monte le **volume d'entrée** et désactive les améliorations micro.
4. **Doubles enregistrements** : augmente l'**anti-rebond** (Paramètres → Audio).
5. **Octets debug** : une trame valide fait **10 octets** et se termine par `0A 0D` (LF CR), p. ex. `20 37 33 35 39 34 35 61 0A 0D` (statut + 6 chiffres + checksum + LF + CR). Du bruit aléatoire indique un mauvais seuil ou un signal trop faible.

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| Vumètre plat | Mauvais périphérique / entrée muette | Choisir le bon micro, monter le volume |
| Signal présent, jamais décodé | Seuil inadapté / signal faible | Baisser le seuil, monter le volume (la polarité est auto-détectée) |
| Décodage instable | Piles faibles | Changer les piles du timer |
| Temps enregistré en double | Rebond | Augmenter l'anti-rebond |

> **Protocole décodé** (vérifié sur un timer QiYi réel) : UART 1200 bauds, 8N1, **polarité auto-détectée**. Trame de 10 octets `[statut][6 chiffres M:SS.mmm][checksum = 64 + Σ chiffres][LF][CR]`.

---

## Tests

- **TypeScript (vitest)** — scramble (parser, générateur, notation débutant), statistiques WCA, formatage, machine de timing/inspection :
  ```bash
  npm run test
  ```
- **Rust (cargo)** — décodeur Stackmat (round-trip de trames, signal synthétique, polarité inversée) et base de données (migrations, solves, pénalités, cascade) :
  ```bash
  cd src-tauri && cargo test
  ```

---

## Schéma SQLite

Base locale, migrations versionnées via `PRAGMA user_version` (`src-tauri/src/db/sql/`).

- **sessions** `(id, name, puzzle, created_at, settings)`
- **solves** `(id, session_id, puzzle, created_at, scramble, time_ms, penalty, final_time_ms, comment, source, status)`
- **settings** `(key, value)` — réglages applicatifs (JSON).
- **audio_devices_cache** `(id, name, last_seen, invert, threshold, sensitivity)` — calibration mémorisée par périphérique.

`penalty ∈ {none, plus2, dnf}` · `source ∈ {external_timer, keyboard, manual}` · `status ∈ {normal, deleted, archived}`.

---

## Licence

Code original sous licence **MIT**. Le protocole Stackmat a été **réimplémenté proprement** à partir de sa description publique : **aucun code GPL** (csTimer ou autre) n'a été copié. Aucune dépendance GPL n'est utilisée.
