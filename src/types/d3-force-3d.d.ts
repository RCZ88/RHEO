/**
 * Ambient types for `d3-force-3d` (v3.0.6).
 *
 * The package ships ESM JavaScript only — `package.json` has `main`/`module`
 * but no `types`, and there is no `.d.ts` in the tarball. So every `import ...
 * from 'd3-force-3d'` in this repo was an implicit `any`, which is why
 * `CanvasGraph.tsx` reached for a bare `d3.forceSimulation(...)` global that
 * does not exist and would throw `ReferenceError: d3 is not defined` the moment
 * anything rendered it.
 *
 * This models the real API shape, which matters beyond convenience:
 *
 *  - Every accessor setter RETURNS THE FORCE, because the library is used in a
 *    fluent chain (`.strength(-120).distanceMax(340)`). Typing them as `void`
 *    or `unknown` makes every such chain a type error.
 *
 *  - `forceLink`'s `distance` / `strength` accessors are called with a LINK,
 *    not a node. Typing them as node accessors is wrong in a way that compiles
 *    fine and silently yields `undefined` at runtime — which is exactly how the
 *    graph ended up with one uniform edge length instead of hub-weighted ones.
 */

declare module 'd3-force-3d' {
  /** A node in a simulation. d3 writes x/y/z/vx/vy/vz in place. */
  export interface SimulationNodeDatum {
    x?: number
    y?: number
    z?: number
    vx?: number
    vy?: number
    vz?: number
    index?: number
  }

  /**
   * A link. `forceLink` REWRITES `source`/`target` from ids into node
   * references, in place — which is why a caller that keeps its own id-keyed
   * link array must hand the simulation a clone.
   */
  export interface SimulationLinkDatum<NodeDatum extends SimulationNodeDatum> {
    source: NodeDatum | string | number
    target: NodeDatum | string | number
    index?: number
  }

  export interface Simulation<NodeDatum extends SimulationNodeDatum> {
    (): void
    nodes(): NodeDatum[]
    nodes(nodes: NodeDatum[]): Simulation<NodeDatum>
    alpha(): number
    alpha(value: number): Simulation<NodeDatum>
    alphaMin(): number
    alphaMin(value: number): Simulation<NodeDatum>
    alphaDecay(): number
    alphaDecay(value: number): Simulation<NodeDatum>
    alphaTarget(): number
    alphaTarget(value: number): Simulation<NodeDatum>
    velocityDecay(): number
    velocityDecay(value: number): Simulation<NodeDatum>
    random(): () => number
    random(value: () => number): Simulation<NodeDatum>
    numDimensions(): number
    numDimensions(value: number): Simulation<NodeDatum>
    force(name: string): unknown
    force(name: string, force: unknown): Simulation<NodeDatum>
    force(name: string, force: null): Simulation<NodeDatum>
    stop(): Simulation<NodeDatum>
    tick(iterations?: number): Simulation<NodeDatum>
    restart(): Simulation<NodeDatum>
    on(type: 'tick' | 'end', listener: (this: Simulation<NodeDatum>) => void): Simulation<NodeDatum>
    on(type: 'tick' | 'end', listener: null): Simulation<NodeDatum>
  }

  export function forceSimulation<NodeDatum extends SimulationNodeDatum>(
    nodes?: NodeDatum[],
    numDimensions?: number,
  ): Simulation<NodeDatum>

  export interface ForceLink<NodeDatum extends SimulationNodeDatum, LinkDatum> {
    id(): (node: NodeDatum) => string | number
    id(value: string | number | ((node: NodeDatum) => string | number)): ForceLink<NodeDatum, LinkDatum>
    links(): LinkDatum[]
    links(links: LinkDatum[]): ForceLink<NodeDatum, LinkDatum>
    /** Accessor receives the LINK. */
    distance(): number | ((link: LinkDatum) => number)
    distance(value: number | ((link: LinkDatum) => number)): ForceLink<NodeDatum, LinkDatum>
    /** Accessor receives the LINK. */
    strength(): number | ((link: LinkDatum) => number)
    strength(value: number | ((link: LinkDatum) => number)): ForceLink<NodeDatum, LinkDatum>
    iterations(): number
    iterations(value: number): ForceLink<NodeDatum, LinkDatum>
  }

  export function forceLink<NodeDatum extends SimulationNodeDatum, LinkDatum>(
    links?: LinkDatum[],
  ): ForceLink<NodeDatum, LinkDatum>

  export interface ForceManyBody<NodeDatum extends SimulationNodeDatum> {
    /** Accessor receives the NODE. */
    strength(): number | ((node: NodeDatum) => number)
    strength(value: number | ((node: NodeDatum) => number)): ForceManyBody<NodeDatum>
    distanceMin(): number
    distanceMin(value: number): ForceManyBody<NodeDatum>
    distanceMax(): number
    distanceMax(value: number): ForceManyBody<NodeDatum>
  }

  export function forceManyBody<NodeDatum extends SimulationNodeDatum>(): ForceManyBody<NodeDatum>

  export interface ForceCenter<NodeDatum extends SimulationNodeDatum> {
    x(): number
    x(value: number): ForceCenter<NodeDatum>
    y(): number
    y(value: number): ForceCenter<NodeDatum>
    strength(): number
    strength(value: number): ForceCenter<NodeDatum>
  }

  export function forceCenter<NodeDatum extends SimulationNodeDatum>(
    x?: number,
    y?: number,
  ): ForceCenter<NodeDatum>

  export interface ForceCollide<NodeDatum extends SimulationNodeDatum> {
    /** Accessor receives the NODE. */
    radius(): number | ((node: NodeDatum) => number)
    radius(value: number | ((node: NodeDatum) => number)): ForceCollide<NodeDatum>
    strength(): number
    strength(value: number): ForceCollide<NodeDatum>
    iterations(): number
    iterations(value: number): ForceCollide<NodeDatum>
  }

  export function forceCollide<NodeDatum extends SimulationNodeDatum>(): ForceCollide<NodeDatum>

  export interface ForceRadial<NodeDatum extends SimulationNodeDatum> {
    /** Accessor receives the NODE. */
    radius(): number | ((node: NodeDatum) => number)
    radius(value: number | ((node: NodeDatum) => number)): ForceRadial<NodeDatum>
    x(): number
    x(value: number): ForceRadial<NodeDatum>
    y(): number
    y(value: number): ForceRadial<NodeDatum>
    strength(): number
    strength(value: number): ForceRadial<NodeDatum>
  }

  export function forceRadial<NodeDatum extends SimulationNodeDatum>(
    radius?: number | ((node: NodeDatum) => number),
    x?: number,
    y?: number,
  ): ForceRadial<NodeDatum>

  /** One-dimensional positional force. Accessor receives the NODE. */
  export interface ForceAxis<NodeDatum extends SimulationNodeDatum> {
    strength(): number
    strength(value: number): ForceAxis<NodeDatum>
  }

  export interface ForceX<NodeDatum extends SimulationNodeDatum> extends ForceAxis<NodeDatum> {
    x(): number | ((node: NodeDatum) => number)
    x(value: number | ((node: NodeDatum) => number)): ForceX<NodeDatum>
  }

  export interface ForceY<NodeDatum extends SimulationNodeDatum> extends ForceAxis<NodeDatum> {
    y(): number | ((node: NodeDatum) => number)
    y(value: number | ((node: NodeDatum) => number)): ForceY<NodeDatum>
  }

  export interface ForceZ<NodeDatum extends SimulationNodeDatum> extends ForceAxis<NodeDatum> {
    z(): number | ((node: NodeDatum) => number)
    z(value: number | ((node: NodeDatum) => number)): ForceZ<NodeDatum>
  }

  export function forceX<NodeDatum extends SimulationNodeDatum>(
    x?: number | ((node: NodeDatum) => number),
  ): ForceX<NodeDatum>

  export function forceY<NodeDatum extends SimulationNodeDatum>(
    y?: number | ((node: NodeDatum) => number),
  ): ForceY<NodeDatum>

  /** Pins the z axis — used to hold the render flat when running 2D. */
  export function forceZ<NodeDatum extends SimulationNodeDatum>(
    z?: number | ((node: NodeDatum) => number),
  ): ForceZ<NodeDatum>
}
