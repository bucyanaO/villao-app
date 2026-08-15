# Command System (God Mode)

The red console button (top-right) opens a chat where you type natural-language
commands. Two execution paths share one pipeline (`applyCommandResult`):

1. **Local parser** (`lib/commandParser.ts`) — offline, instant, no API key.
2. **Gemini 2.5 Flash** — used only for commands the local parser doesn't recognize,
   and only if a real `GEMINI_API_KEY` is set. Gemini sees the canvas + telemetry and
   returns a JSON `AICommand`.

If a command isn't recognized locally and no key is configured, the console replies
with a hint instead of failing silently.

## Built-in commands (local)

| Phrase (examples) | Effect |
|-------------------|--------|
| `commande une voiture`, `appelle une voiture`, `voiture` | A car spawns and drives to you; press **F** to enter |
| `appelle un taxi` / `commande un camion` / `commande un bus` | Same, with that vehicle type |
| `supprime les voitures`, `enlève la voiture` | Removes vehicles |
| `fait pleuvoir` / `fait de la neige` / `soleil` | Weather: rain / snow / clear |
| `met la nuit` / `coucher de soleil` / `met le jour` | Lighting preset |
| `fais apparaître un arbre en or` | Spawns a gold tree (`fais apparaître un arbre` for a normal one) |
| `disco` | Disco special FX |
| `kaiju` / `monstre` | Kaiju special FX |
| `construis une école`, `il manque une clinique`, `bâtis une usine`… | Ouvre un chantier : le cabinet d'architectes confie le programme à l'agent compétent et lui cherche un terrain conforme (28 programmes reconnus) |
| `où en est la ville ?`, `rapport`, `il manque quoi ?` | Population, emplois et besoins prioritaires |
| `emmène-moi au nouveau quartier` | Rejoint le dernier quartier sorti de terre |
| `ramène-moi au centre` | Retour au centre-ville |

The parser normalizes accents/case/punctuation and matches keywords, with guards so
greetings like `bonjour` don't trigger anything and `arbre orange` doesn't become gold.

## The "command a car" flow

1. `commande une voiture` → parser returns `{ summon: { type: 'car' } }`.
2. `useCommandEngine.applyCommandResult` sets `aiCommand.summon`.
3. `NeighborhoodScene`'s `[aiCommand]` effect calls `engine/godOperations.summonVehicle`.
4. A vehicle is placed ~34 m in front of the player with `userData.summonTarget` set.
5. The animation loop steers it toward the player and stops ~6 m away (in the crosshair).
6. The interaction HUD shows **CONDUIRE**; press **F** to enter and drive (`ZQSD`).

## Extending

Add a new local command in `lib/commandParser.ts`: append a rule to the relevant
`*_RULES` array or add a new branch returning a `ParsedCommand` with `settings`,
`godOperations`, and/or `summon`. The engine side already understands
`GodOperation` actions (`engine/types.ts`) and the `summon` intent.

For Gemini, the prompt in `hooks/useCommandEngine.ts` lists the capabilities and the
expected JSON schema; new engine capabilities should be advertised there too.
