COSMOS — Contrôle gestuel
=========================

Application 100% locale, aucune connexion internet requise.

STRUCTURE
---------
cosmos-local/
├── index.html          ← Ouvrir ce fichier dans Chrome/Edge
└── js/
    ├── three.min.js                         ← Three.js r128
    ├── hands.js                             ← MediaPipe Hands 0.4
    ├── camera_utils.js                      ← MediaPipe Camera Utils
    ├── hands_solution_wasm_bin.wasm         ← WebAssembly inference
    ├── hands_solution_simd_wasm_bin.wasm    ← WASM SIMD (plus rapide)
    ├── hands_solution_packed_assets.data    ← Modèle ML
    ├── hand_landmark_full.tflite            ← Landmarks haute précision
    ├── hand_landmark_lite.tflite            ← Landmarks rapide
    └── ...

LANCEMENT
---------
⚠️  Ne pas ouvrir directement avec double-clic (file://)
    MediaPipe requiert un serveur HTTP local pour les fichiers WASM.

Option A — Python (recommandé) :
  cd cosmos-local
  python3 -m http.server 8080
  → ouvrir http://localhost:8080 dans Chrome

Option B — Node.js :
  npx serve cosmos-local
  → ouvrir l'URL affichée

Option C — VS Code :
  Installer l'extension "Live Server"
  Clic droit sur index.html → "Open with Live Server"

CONTRÔLES
---------
  Main ouverte    = pointeur libre sur l'écran
  Fermer le poing = active l'action
  Poing + gauche/droite = vitesse de rotation
  Poing + haut/bas      = zoom / changement d'échelle
  Pointer un astre + fermer = focus & infos détaillées
