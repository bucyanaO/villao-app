/**
 * HAZE — la brume volumétrique qui mange le lointain.
 *
 * Le monde est engendré autour du joueur : il y a forcément une frontière de
 * génération. Plutôt que de la cacher par un mur de brouillard uniforme, on
 * empile quelques nappes translucides à hauteur d'homme (additif, doux) qui
 * suivent la caméra : la lumière s'y accumule avec la distance, l'horizon se
 * dissout, et les tuiles qui apparaissent au loin ne « pop » jamais.
 *
 * Trois nappes suffisent : au-delà, on paie du fill rate pour rien.
 */
import * as THREE from 'three';

export interface Haze {
  /** Recentre la brume sur la caméra et l'anime doucement. */
  update(camera: THREE.Camera, time: number): void;
  /** Accorde la brume à l'ambiance courante (couleur du brouillard). */
  tune(color: number, density: number, night: boolean): void;
  dispose(): void;
}

function gradientTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.10)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createHaze(scene: THREE.Scene): Haze {
  const tex = gradientTexture();
  const group = new THREE.Group();
  group.renderOrder = 10;
  group.userData = { isHaze: true, isPersistent: true };

  const layers: THREE.Mesh[] = [];
  const radii = [240, 460, 760];
  const heights = [10, 26, 60];

  radii.forEach((r, i) => {
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.18 - i * 0.03,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.6, r * 2.6), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = heights[i];
    mesh.userData = { baseY: heights[i], drift: 0.6 + i * 0.35 };
    group.add(mesh);
    layers.push(mesh);
  });

  scene.add(group);

  return {
    update(camera, time) {
      group.position.set(camera.position.x, 0, camera.position.z);
      for (const l of layers) {
        // respiration lente : la brume vit, sans jamais attirer l'oeil
        l.position.y = l.userData.baseY + Math.sin(time * 0.12 * l.userData.drift) * 1.6;
        l.rotation.z = time * 0.006 * l.userData.drift;
      }
    },
    tune(color, density, night) {
      const c = new THREE.Color(color);
      layers.forEach((l, i) => {
        const m = l.material as THREE.MeshBasicMaterial;
        m.color.copy(c);
        // plus le brouillard est dense, plus les nappes pèsent
        m.opacity = Math.min(0.42, (0.10 + density * 6) * (night ? 0.8 : 1) - i * 0.02);
      });
    },
    dispose() {
      group.parent?.remove(group);
      layers.forEach((l) => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); });
      tex.dispose();
    },
  };
}
