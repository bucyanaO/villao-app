/**
 * SIGNAGE — enseignes et panneaux (texte dessiné sur un canvas → texture).
 * Utilisé par les magasins, les usines, les équipements publics et les
 * panneaux d'entrée de quartier : la ville devient lisible, on sait ce qu'on
 * regarde.
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function textTexture(label: string, fg: string, bg: string): THREE.Texture {
  const key = `${label}|${fg}|${bg}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.fillStyle = bg; c.fillRect(0, 0, 512, 128);
  c.strokeStyle = fg; c.lineWidth = 6; c.strokeRect(6, 6, 500, 116);
  c.fillStyle = fg;
  const size = label.length > 14 ? 40 : label.length > 10 ? 48 : 58;
  c.font = `bold ${size}px sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(label.toUpperCase(), 256, 68);
  const tex = new THREE.CanvasTexture(canvas);
  cache.set(key, tex);
  return tex;
}

/** Enseigne lumineuse à accrocher sur une façade (retourne un Mesh plan). */
export function makeSign(label: string, width = 4.5, fg = '#d6fff6', bg = 'rgba(6,12,20,0.92)'): THREE.Mesh {
  const tex = textTexture(label, fg, bg);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
  );
  mesh.userData = { isSign: true };
  return mesh;
}

/** Panneau sur pied (entrée de quartier, chantier…). */
export function makeSignPost(label: string, fg = '#d6fff6'): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 3.2, 0.22),
    new THREE.MeshBasicMaterial({ color: 0x888888 }),
  );
  post.position.y = 1.6;
  g.add(post);
  const plate = makeSign(label, 7, fg);
  plate.position.y = 3.6;
  g.add(plate);
  return g;
}
