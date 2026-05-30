declare global {
  interface Window {
    __PIXI_DEVTOOLS__: { app: PIXI.Application };
  }
}

declare namespace PIXI {
  class Application {
    stage: Container;
    renderer: any;
    canvas: HTMLCanvasElement;
    screen: DOMRect;
    ticker: Ticker;
    init(options: ApplicationOptions): Promise<void>;
    destroy(releaseGlobalResources?: boolean): void;
  }

  interface ApplicationOptions {
    width?: number;
    height?: number;
    backgroundColor?: number;
    antialias?: boolean;
    resolution?: number;
    autoDensity?: boolean;
    preference?: 'webgl' | 'webgpu' | 'canvas';
    resizeTo?: HTMLElement;
    autoStart?: boolean;
    sharedTicker?: boolean;
    canvas?: HTMLCanvasElement;
    useBackBuffer?: boolean;
  }

  class Ticker {
    add(fn: (ticker: Ticker) => void, priority?: number): Ticker;
    addOnce(fn: (ticker: Ticker) => void, priority?: number): Ticker;
    remove(fn: (ticker: Ticker) => void): Ticker;
    start(): Ticker;
    stop(): Ticker;
    deltaTime: number;
    deltaMS: number;
    elapsedMS: number;
    maxFPS: number;
    speed: number;
    shared: Ticker;
  }

  class Container {
    name: string;
    position: ObservablePoint;
    scale: ObservablePoint;
    rotation: number;
    pivot: ObservablePoint;
    alpha: number;
    tint: number;
    visible: boolean;
    eventMode: 'none' | 'passive' | 'auto' | 'static' | 'dynamic';
    width: number;
    height: number;
    children: Container[];
    parent: Container | null;
    renderable: boolean;
    filters: Filter[];
    filterArea: Rectangle;
    sortableChildren: boolean;
    zIndex: number;
    boundsArea: Rectangle;
    cullable: boolean;
    cullArea: Rectangle;

    addChild(...children: Container[]): Container;
    addChildAt(child: Container, index: number): Container;
    addChildAt(child: Container, index: number): Container;
    removeChild(...children: Container[]): Container;
    removeChildAt(index: number): Container;
    removeChildren(begin?: number, end?: number): Container[];
    swapChildren(child: Container, child2: Container): void;
    setChildIndex(child: Container, index: number): void;
    getChildAt(index: number): Container;
    getChildByName(name: string, recursively?: boolean): Container;
    getChildIndex(child: Container): number;

    toGlobal<PointType extends PointData>(point: PointData, out?: PointType): PointType;
    toLocal<PointType extends PointData>(point: PointData, from?: Container, out?: PointType): PointType;
    getBounds(skipUpdate?: boolean): Rectangle;
    getGlobalPosition(out?: Point): Point;

    on<K extends string>(event: K, fn: (data: any) => void, context?: unknown): this;
    off<K extends string>(event: K, fn?: (data: any) => void, context?: unknown): this;
    once<K extends string>(event: K, fn: (data: any) => void, context?: unknown): this;

    destroy(options?: { children?: boolean; texture?: boolean; baseTexture?: boolean }): void;

    [key: string]: any;
  }

  class ObservablePoint {
    x: number;
    y: number;
    set(x: number, y: number): this;
    setxy(): this;
    copy(o: PointData): this;
    clone(): ObservablePoint;
  }

  class Graphics extends Container {
    rect(x: number, y: number, width: number, height: number): Graphics;
    circle(x: number, y: number, radius: number): Graphics;
    ellipse(x: number, y: number, width: number, height: number): Graphics;
    roundRect(x: number, y: number, width: number, height: number, radius: number): Graphics;
    poly(vertices: number[] | Point[]): Graphics;
    moveTo(x: number, y: number): Graphics;
    lineTo(x: number, y: number): Graphics;
    bezierCurveTo(cpX: number, cpY: number, tpX: number, tpY: number): Graphics;
    quadraticCurveTo(cpX: number, cpY: number, tpX: number, tpY: number): Graphics;
    arc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): Graphics;
    arcTo(x: number, y: number, radius: number): Graphics;
    closePath(): Graphics;
    fill(color: number | FillStyle): Graphics;
    stroke(options: StrokeStyle): Graphics;
    cut(): Graphics;
    clear(): Graphics;
  }

  interface FillStyle {
    color?: number;
    alpha?: number;
  }

  interface StrokeStyle {
    width?: number;
    color?: number;
    alpha?: number;
  }

  class Sprite extends Container {
    texture: Texture;
    anchor: ObservablePoint;
    constructor(texture?: Texture);
  }

  class Text extends Container {
    text: string;
    style: TextStyle;
    anchor: ObservablePoint;
    constructor(text: string | Text, style?: TextStyle);
  }

  interface TextStyle {
    fontSize?: number;
    fill?: number | string | (number | string)[];
    fontFamily?: string | string[];
    fontWeight?: string;
    stroke?: { color: number; width: number };
    wordWrap?: boolean;
    wordWrapWidth?: number;
    align?: string;
  }

  class Texture {
    static from(source: string | HTMLImageElement | HTMLCanvasElement): Texture;
  }

  class Assets {
    static load(ids: string | string[]): Promise<any>;
    static unload(ids: string | string[]): void;
    static reset(): void;
  }

  class Color {
    constructor(value: number | string | number[] | Color);
    static shared: Color;
  }

  class Point implements PointData {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    clone(): Point;
    copy(o: PointData): this;
    set(x?: number, y?: number): this;
  }

  interface PointData {
    x: number;
    y: number;
  }

  class Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x?: number, y?: number, width?: number, height?: number);
    contains(x: number, y: number): boolean;
    clone(): Rectangle;
    copy(source: Rectangle): this;
    setTo(x: number, y: number, width: number, height: number): this;
  }

  class FederatedPointerEvent {
    stopPropagation(): void;
    originalEvent: PointerEvent;
    global: Point;
    data: any;
  }

  class Filter {}

  class WebGLRenderer {}
  class WebGPURenderer {}
  class CanvasRenderer {}

  const Settings: any;
}

export {};
