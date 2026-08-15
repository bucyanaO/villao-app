/**
 * LOD — le niveau de détail des bâtiments.
 *
 * Un bâtiment de cette ville est fait de dizaines d'objets : coques filaires,
 * dalles, mobilier, habitants. Superbe de près, ruineux de loin : 90 bâtiments
 * affichés en entier, c'est plus de 16 000 appels de dessin et 20 images par
 * seconde.
 *
 * On attache donc à chaque bâtiment un PROXY : une simple boîte translucide
 * calée sur sa boîte englobante, en 2 objets. Au-delà d'une distance, le
 * bâtiment complet s'efface et le proxy prend sa place — la silhouette de la
 * ville reste exactement la même, le coût s'effondre.
 *
 * (Et comme le proxy vit dans le même parent, tout le streaming/déchargement
 * existant continue de fonctionner sans rien savoir de tout ça.)
 */
import * as THREE from 'three';

const proxyGeo = new THREE.BoxGeometry(1, 1, 1);
const proxyEdges = new THREE.EdgesGeometry(proxyGeo);

const fillCache = new Map<number, THREE.Material>();
const lineCache = new Map<number, THREE.Material>();

function fillMat(color: number): THREE.Material {
  let m = fillCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, depthWrite: true });
    fillCache.set(color, m);
  }
  return m;
}
function lineMat(color: number): THREE.Material {
  let m = lineCache.get(color);
  if (!m) {
    m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    lineCache.set(color, m);
  }
  return m;
}

/**
 * Teinte dominante du bâtiment : la couleur de matériau la plus fréquente,
 * les gris neutres comptant moitié moins (sinon toutes les silhouettes
 * viraient au béton et la ville lointaine perdait ses couleurs).
 */
function dominantColor(obj: THREE.Object3D): number {
  const votes = new Map<number, number>();
  const c = new THREE.Color();
  obj.traverse((child: any) => {
    if (!child.isMesh) return;
    const mat = child.material;
    if (!mat || Array.isArray(mat) || !mat.color) return;
    const hex = mat.color.getHex();
    c.setHex(hex);
    const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
    const saturation = max - min;
    votes.set(hex, (votes.get(hex) ?? 0) + (saturation < 0.12 ? 0.5 : 1));
  });
  let best = 0x8899aa, bestVotes = 0;
  for (const [hex, n] of votes) if (n > bestVotes) { bestVotes = n; best = hex; }
  return best;
}

/**
 * Attache un proxy au bâtiment. À appeler une fois, juste après sa création.
 * Sans effet si le bâtiment est vide ou déjà équipé.
 */
export function attachLod(building: THREE.Object3D): void {
  if (building.userData.lodProxy || !building.parent) return;
  // Certains « bâtiments » sont en fait du paysage (square, ferme, parc
  // énergétique) : les réduire à une boîte pleine donnerait un bloc vert posé
  // au milieu de la ville. On les laisse tels quels, ils sont légers.
  if (building.userData.noLod) return;

  building.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(building);
  if (!isFinite(box.min.x) || box.isEmpty()) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  if (size.x < 0.5 || size.y < 0.5) return;

  const color = dominantColor(building);
  const proxy = new THREE.Group();
  const mesh = new THREE.Mesh(proxyGeo, fillMat(color));
  mesh.scale.copy(size);
  proxy.add(mesh);
  const edges = new THREE.LineSegments(proxyEdges, lineMat(color));
  edges.scale.copy(size);
  proxy.add(edges);

  // le proxy est un frère du bâtiment, exprimé dans le même repère
  const local = building.parent.worldToLocal(center.clone());
  proxy.position.copy(local);
  proxy.visible = false;
  proxy.userData = { isLodProxy: true, actId: building.userData.actId };
  building.parent.add(proxy);
  building.userData.lodProxy = proxy;
}

/**
 * Bascule détail/proxy selon la distance. À appeler à basse fréquence
 * (2×/s suffit largement : la transition passe inaperçue dans la brume).
 */
export function updateLod(buildings: readonly THREE.Object3D[], camera: THREE.Object3D, nearDist = 130): void {
  const cam = camera.position;
  const near2 = nearDist * nearDist;
  for (const b of buildings) {
    const proxy = b.userData.lodProxy as THREE.Group | undefined;
    if (!proxy) continue;
    if (b.userData.forcedHidden) continue;         // retiré par le God Mode
    const dx = b.position.x - cam.x, dz = b.position.z - cam.z, dy = b.position.y - cam.y;
    const detailed = dx * dx + dy * dy + dz * dz < near2;
    if (b.visible !== detailed) {
      b.visible = detailed;
      proxy.visible = !detailed;
    }
  }
}
