import React, { useEffect, useRef } from 'react';
import type { MapSample } from '../../engine/world/minimap';
import type { LandClass } from '../../engine/world/landuse';

/**
 * Carte de poche — indispensable dans un monde sans bord.
 *
 * On y lit d'un coup d'oeil le réseau viaire, la nature de ce qui est bâti
 * (chaque famille d'usage a sa couleur, comme sur un plan d'urbanisme) et les
 * quartiers alentour. Le nord reste en haut : la carte ne tourne pas avec la
 * caméra, c'est le curseur du joueur qui pivote.
 */
const CLASS_COLOR: Record<LandClass, string> = {
  residentiel: '#e8c86a',
  commerce: '#59d6ff',
  tertiaire: '#9b8cff',
  equipement: '#ff8ab0',
  industrie: '#ff9a55',
  agricole: '#a8d15a',
  vert: '#4fd48a',
};

const SIZE = 168;

const MiniMap: React.FC<{ sample: MapSample | null }> = ({ sample }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !sample) return;
    const g = canvas.getContext('2d');
    if (!g) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== SIZE * dpr) {
      canvas.width = SIZE * dpr;
      canvas.height = SIZE * dpr;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scale = (SIZE / 2) / sample.radius;
    const px = (x: number) => SIZE / 2 + (x - sample.center.x) * scale;
    const pz = (z: number) => SIZE / 2 + (z - sample.center.z) * scale;

    g.clearRect(0, 0, SIZE, SIZE);
    g.fillStyle = 'rgba(6,14,20,0.86)';
    g.fillRect(0, 0, SIZE, SIZE);

    // voirie
    g.lineCap = 'round';
    for (const r of sample.roads) {
      g.strokeStyle = 'rgba(150,190,210,0.55)';
      g.lineWidth = Math.max(1, r.w * scale * 0.8);
      g.beginPath();
      g.moveTo(px(r.x1), pz(r.z1));
      g.lineTo(px(r.x2), pz(r.z2));
      g.stroke();
    }

    // bâti, coloré par famille d'usage
    for (const b of sample.buildings) {
      g.fillStyle = CLASS_COLOR[b.c] ?? '#cccccc';
      g.fillRect(px(b.x) - 2, pz(b.z) - 2, 4, 4);
    }

    // noms de quartiers
    g.font = '9px ui-monospace, monospace';
    g.fillStyle = 'rgba(180,235,255,0.7)';
    g.textAlign = 'center';
    for (const d of sample.districts) {
      const x = px(d.x), z = pz(d.z);
      if (x < 6 || x > SIZE - 6 || z < 8 || z > SIZE - 4) continue;
      g.fillText(d.label, x, z);
    }

    // curseur du joueur : un chevron orienté
    g.save();
    g.translate(SIZE / 2, SIZE / 2);
    g.rotate(-sample.heading);
    g.fillStyle = '#00ffcc';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(0, 2.5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();

    // cadre + nord
    g.strokeStyle = 'rgba(0,255,204,0.35)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
    g.fillStyle = 'rgba(0,255,204,0.6)';
    g.font = '10px ui-monospace, monospace';
    g.fillText('N', SIZE / 2, 12);

    // échelle
    g.fillStyle = 'rgba(180,235,255,0.5)';
    g.textAlign = 'right';
    g.fillText(`${Math.round(sample.radius)} m`, SIZE - 6, SIZE - 6);
  }, [sample]);

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-30 rounded-md border border-cyan-500/30 bg-slate-950/70 p-1 backdrop-blur">
      <canvas ref={ref} style={{ width: SIZE, height: SIZE, display: 'block' }} />
    </div>
  );
};

export default MiniMap;
