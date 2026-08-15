/**
 * LOTS — façade historique au-dessus du cadastre (`engine/world/zoning`).
 *
 * Avant, la liste des terrains était codée en dur pour le plan « residential » :
 * dès qu'on changeait de style (grille, région), ces coordonnées tombaient au
 * milieu d'une avenue → des maisons poussaient dans la rue.
 *
 * Désormais les parcelles sont calculées par le générateur pour le style courant
 * (routes déclarées d'abord, parcelles filtrées ensuite) et ce module ne fait
 * que relayer les questions au cadastre.
 */
import * as THREE from 'three';
import {
  freePlots, nearestFreePlot, plotIndex, claimPlot, drawPlotMarkers, plots,
  type Plot,
} from '../world/zoning';

export type Lot = Plot;

/** Les terrains constructibles du style courant (dynamique, plus de liste figée). */
export function buildLots(): readonly Plot[] { return plots(); }

/** Parcelle libre la plus proche d'une position. */
export function nearestFreeLot(target: { x: number; z: number }): Plot | null {
  return nearestFreePlot(target);
}

export function lotIndex(lot: Plot): number { return plotIndex(lot); }

/** Réserve la parcelle (elle devient occupée pour tout le monde). */
export function claimLot(lot: Plot): void { claimPlot(lot); }

export function freeLotCount(): number { return freePlots().length; }

/** Repères au sol sur les terrains encore libres. */
export function drawLotMarkers(cityGroup: THREE.Group): void {
  drawPlotMarkers(cityGroup);
}
