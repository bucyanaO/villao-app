# Le monde (engine/world)

Le paquet `engine/world/*` transforme la scène en un **monde persistant, presque
infini, bâti par des agents**. Trois idées le structurent.

## 1. Le registre est la vérité, la 3D n'est qu'une fenêtre

`ledger.ts` tient la liste des **actes** : « quartier X, graine G », « bâtiment
« usine » en (x,z), graine G, signé Bruno », « rue de A à B ». Un acte pèse
quelques octets et suffit à reconstruire l'objet **à l'identique**, parce que
toutes les fabriques sont déterministes (`rng.ts` : même graine → même
bâtiment).

Conséquences directes :

- **rien ne disparaît au rechargement** — le registre est écrit dans
  `localStorage` (à chaque ouvrage livré, et sur `pagehide`) ;
- **la mémoire reste bornée** — `expansion.ts` ne matérialise que les actes
  proches du joueur (`LOAD_RADIUS`) et détruit les autres ; on peut donc bâtir
  sans limite.

## 2. Le cadastre décide de ce qui est possible

`zoning.ts` connaît **toutes** les routes et toutes les emprises, y compris
celles des quartiers situés à des kilomètres (le cadastre est rejoué en entier
au démarrage, seule la 3D est streamée). D'où :

- aucun bâtiment ne peut se poser sur la chaussée (`isBuildable`,
  `resolveBuildSite`) ;
- une rue nouvelle déclasse les parcelles qu'elle traverse ;
- les inscriptions sont **idempotentes** et **nominatives** (`owner`) : rejouer
  un quartier ne duplique rien et il peut ignorer ses propres empreintes.

`landuse.ts` ajoute la couche « souhaitable » : des **distances de priorité**
entre familles d'usages (une usine à 130 m des logements, 150 m des écoles) et
des **pôles** (l'industrie se regroupe, l'habitat se disperse).

## 3. Ce sont des agents qui construisent

`agents/studio.ts` — le **cabinet d'architectes** : il compare le parc bâti au
plan d'urbanisme, choisit le programme le plus déficitaire, le confie à l'agent
le plus compétent (en partageant le travail et en évitant les répétitions),
cherche un terrain « sur rue », et **ouvre une rue neuve** quand il n'y a plus
de foncier. Chaque ouvrage livré donne de l'expérience : les niveaux montent
(1→5) et débloquent des bâtiments plus riches. La progression est sauvegardée.

`agents/autonomy.ts` — les **habitants** bâtissent leur propre projet (le
boulanger sa boutique, le médecin sa clinique), le programme étant choisi par
le modèle *dans le rôle*, jamais l'emplacement.

## Le décor

- `terrain.ts` — sol et forêt en tuiles engendrées autour du joueur. Un arbre
  pousse là où le cadastre dit que le sol est libre : clairsemé en ville, dense
  dès qu'on s'en éloigne. **Aucun bord n'est jamais visible.**
- `haze.ts` — nappes volumétriques qui suivent la caméra et dissolvent la
  frontière de génération.
- `districts.ts` — les quartiers thématiques (faubourg, tours, vieille ville,
  jardins, zone industrielle, cité béton, futuriste, mégastructure) : `plan…`
  (pur, déterministe, alimente le cadastre) puis `build…` (rendu).
- `programs.ts` — le catalogue des usages : maison, immeuble, bureau, magasin,
  marché, entrepôt, usine, atelier, école, clinique, mairie, square.
- `streets.ts` — le pavage unique (chaussée, trottoirs, axe, lampadaires) et le
  tracé de corridor : une rue ne traverse jamais le bâti existant.

## Vérifier

Les invariants (rien sur la chaussée, personne qui flotte, séparation
industrie/habitat, ville identique après rechargement, mémoire bornée) se
testent sans navigateur — voir les scripts de contrôle décrits dans
`docs/ENGINE.md`.
