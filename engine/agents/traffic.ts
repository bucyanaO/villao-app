/**
 * CIRCULATION — des voitures qui suivent réellement le réseau.
 *
 * Le trafic d'origine glisse le long d'axes codés en dur. Ici on construit un
 * GRAPHE à partir du cadastre (les tronçons de voirie autour du joueur, quels
 * qu'ils soient : rues des quartiers, avenues d'extension, rues ouvertes par le
 * cabinet), et chaque véhicule roule d'un carrefour à l'autre, à droite, en
 * choisissant sa direction en arrivant — en évitant le demi-tour.
 *
 * Comme tout est local (rayon autour du joueur) et reconstruit périodiquement,
 * la circulation apparaît d'elle-même sur les rues qui viennent d'être tracées.
 */
import * as THREE from 'three';
import { CityAssets } from '../assets';
import { roadsNear, type RoadSeg } from '../world/zoning';

interface Edge {
  ax: number; az: number; bx: number; bz: number;
  len: number; ux: number; uz: number; w: number;
  a: string; b: string;
}

interface Car {
  mesh: THREE.Group;
  edge: Edge;
  forward: boolean;
  t: number;
  speed: number;
}

export interface Traffic {
  update(dt: number, player: THREE.Vector3): void;
  count(): number;
  dispose(): void;
}

const nodeKey = (x: number, z: number) => `${Math.round(x / 2)}:${Math.round(z / 2)}`;

export function createTraffic(scene: THREE.Object3D, opts: { cars?: number; radius?: number } = {}): Traffic {
  const MAX = opts.cars ?? 11;
  const RADIUS = opts.radius ?? 320;
  const cars: Car[] = [];
  let edges: Edge[] = [];
  const nodes = new Map<string, Edge[]>();
  let rebuild = 0;

  const buildGraph = (player: THREE.Vector3) => {
    edges = [];
    nodes.clear();
    for (const s of roadsNear({ x: player.x, z: player.z }, RADIUS * 1.5) as RoadSeg[]) {
      const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
      const len = Math.hypot(dx, dz);
      if (len < 3) continue;                    // (les arcs de rond-point sont courts : on les garde)
      const e: Edge = {
        ax: s.x1, az: s.z1, bx: s.x2, bz: s.z2,
        len, ux: dx / len, uz: dz / len, w: s.w,
        a: nodeKey(s.x1, s.z1), b: nodeKey(s.x2, s.z2),
      };
      edges.push(e);
      for (const k of [e.a, e.b]) {
        const list = nodes.get(k);
        if (list) list.push(e); else nodes.set(k, [e]);
      }
    }
  };

  /** Position sur la voie de droite d'un tronçon. */
  const place = (car: Car) => {
    const e = car.edge;
    const t = car.forward ? car.t : e.len - car.t;
    const dirX = car.forward ? e.ux : -e.ux;
    const dirZ = car.forward ? e.uz : -e.uz;
    const offset = Math.min(2.6, e.w / 2 - 1.4);
    const nx = dirZ, nz = -dirX;               // à droite du sens de marche
    car.mesh.position.set(
      e.ax + e.ux * t + nx * offset,
      0.1,
      e.az + e.uz * t + nz * offset,
    );
    // le modèle a ses phares vers -Z
    car.mesh.rotation.y = Math.atan2(-dirX, -dirZ);
  };

  const spawn = (player: THREE.Vector3): boolean => {
    if (!edges.length) return false;
    const near = edges.filter((e) => Math.hypot(e.ax - player.x, e.az - player.z) < RADIUS);
    const e = (near.length ? near : edges)[Math.floor(Math.random() * (near.length || edges.length))];
    const type = Math.random() > 0.85 ? 'bus' : Math.random() > 0.75 ? 'truck' : Math.random() > 0.6 ? 'taxi' : 'car';
    const mesh = CityAssets.Life.createVehicle(type as any);
    mesh.userData.isTraffic = true;
    scene.add(mesh);
    const car: Car = {
      mesh, edge: e, forward: Math.random() > 0.5,
      t: Math.random() * e.len,
      speed: 6 + Math.random() * 6,
    };
    place(car);
    cars.push(car);
    return true;
  };

  const remove = (c: Car) => {
    c.mesh.parent?.remove(c.mesh);
    const i = cars.indexOf(c);
    if (i >= 0) cars.splice(i, 1);
  };

  /** Au carrefour : on repart sur un tronçon connecté, tout droit de préférence. */
  const turn = (car: Car) => {
    const e = car.edge;
    const arrival = car.forward ? e.b : e.a;
    const options = (nodes.get(arrival) ?? []).filter((o) => o !== e);
    if (!options.length) { car.forward = !car.forward; car.t = 0; return; }

    const dirX = car.forward ? e.ux : -e.ux;
    const dirZ = car.forward ? e.uz : -e.uz;
    let best = options[0];
    let bestScore = -Infinity;
    for (const o of options) {
      const outForward = o.a === arrival;
      const ox = outForward ? o.ux : -o.ux;
      const oz = outForward ? o.uz : -o.uz;
      const align = dirX * ox + dirZ * oz;                 // 1 = tout droit, -1 = demi-tour
      const score = align + Math.random() * 0.7;
      if (score > bestScore) { bestScore = score; best = o; }
    }
    car.edge = best;
    car.forward = best.a === arrival;
    car.t = 0;
  };

  return {
    update(dt, player) {
      rebuild -= dt;
      if (rebuild <= 0) {
        rebuild = 4;
        buildGraph(player);
        for (const c of [...cars]) {
          if (Math.hypot(c.mesh.position.x - player.x, c.mesh.position.z - player.z) > RADIUS * 1.6) remove(c);
          else if (!edges.includes(c.edge)) remove(c);      // sa rue n'est plus chargée
        }
        while (cars.length < MAX) { if (!spawn(player)) break; }
      }

      // On regarde la voiture devant soi sur le même tronçon : sans cela, tout
      // le monde se superpose au premier carrefour.
      for (const c of cars) {
        let gap = Infinity;
        for (const o of cars) {
          if (o === c || o.edge !== c.edge || o.forward !== c.forward) continue;
          const d = o.t - c.t;
          if (d > 0 && d < gap) gap = d;
        }
        const target = gap < 7 ? 0 : gap < 16 ? c.speed * 0.45 : c.speed;
        c.t += target * dt;
        if (c.t >= c.edge.len) turn(c);
        place(c);
      }
    },
    count: () => cars.length,
    dispose() { for (const c of [...cars]) remove(c); },
  };
}
