import React, { useState } from 'react';
import type { Architect, CityReport, StudioEvent } from '../../engine/agents/studio';
import { PROGRAM_LABEL } from '../../engine/world/programs';

/**
 * Panneau « Atelier Villao » — ce que fabriquent les agents, en direct.
 *
 * Deux informations, et rien d'autre : QUI travaille (avec son niveau, qui
 * monte à mesure qu'il construit) et CE QUI vient de sortir de terre. Repliable,
 * discret, il ne mange pas la vue sur la ville.
 */
const StudioPanel: React.FC<{ events: StudioEvent[]; roster: Architect[]; report?: CityReport | null }> = ({
  events, roster, report,
}) => {
  const [open, setOpen] = useState(true);
  const last = events.slice(-5).reverse();
  const manque = (report?.needs ?? []).slice(0, 3).map((n) => PROGRAM_LABEL[n.kind]).join(', ');

  return (
    <div className="pointer-events-auto fixed bottom-24 left-4 z-30 w-72 select-none font-mono text-[11px] text-cyan-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-t-md border border-cyan-500/30 bg-slate-950/85 px-3 py-2 text-left backdrop-blur transition hover:bg-slate-900/90"
      >
        <span className="tracking-widest text-cyan-300">ATELIER VILLAO</span>
        <span className="text-cyan-500/70">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="rounded-b-md border border-t-0 border-cyan-500/30 bg-slate-950/80 px-3 py-2 backdrop-blur">
          {report && (
            <div className="mb-2 border-b border-cyan-500/20 pb-2 text-[10px] leading-relaxed">
              <div className="text-cyan-200">
                {report.population.toLocaleString('fr-FR')} habitants · {report.jobs.toLocaleString('fr-FR')} emplois
              </div>
              {manque && <div className="text-amber-300/70">il manque : {manque}</div>}
            </div>
          )}

          <div className="mb-2 space-y-1">
            {roster.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-cyan-100/90">{a.name}</span>
                <span className="truncate text-[10px] text-cyan-400/50">{a.title}</span>
                <span className="shrink-0 text-amber-300/90" title={`${a.works} ouvrages livrés`}>
                  {'★'.repeat(a.skill)}
                  <span className="text-amber-300/25">{'★'.repeat(5 - a.skill)}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-cyan-500/20 pt-2">
            {last.length === 0 && <p className="text-cyan-500/50">Le chantier démarre…</p>}
            {last.map((e, i) => (
              <p key={`${e.t}-${i}`} className={i === 0 ? 'text-cyan-200' : 'text-cyan-400/50'}>
                · {e.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudioPanel;
