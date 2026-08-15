/**
 * CityAssets — public surface of the asset library.
 * Re-exports the building blocks and assembles the familiar `CityAssets` namespace.
 */
import { Life } from './Life';
import { Props } from './Props';
import { Layouts } from './Layouts';
import { Architecture, Furniture } from './interiors';
import { createWireframeObject, createSolidObject } from './primitives';

// Types
export { InhabitantState } from './types';
export type { InstanceData, Bounds, Collider } from './types';
// Rendering singletons
export { sharedMaterials, getMaterial, getCachedGeometry } from './materials';
// Batching helpers
export { LineMerger, MeshMerger } from './mergers';
// Primitives
export { createWireframeObject, createSolidObject } from './primitives';
// Asset namespaces
export { Life } from './Life';
export { Props } from './Props';
export { Layouts } from './Layouts';
export { Architecture, Furniture } from './interiors';

export const CityAssets = {
    Life,
    Architecture,
    Furniture,
    Props,
    Layouts,
    primitives: {
        createWireframeObject,
        createSolidObject
    }
};
