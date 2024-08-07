/*
 * MARTINS.js
 * GPU-accelerated Augmented Reality for the web
 * Copyright (C) 2022-2024 Alexandre Martins <alemartf(at)gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * viewport.ts
 * Viewport
 */

import Speedy from 'speedy-vision';
import { SpeedySize } from 'speedy-vision/types/core/speedy-size';
import { SpeedyPromise } from 'speedy-vision/types/core/speedy-promise';
import { Nullable } from '../utils/utils';
import { Resolution } from './resolution';
import { Utils } from '../utils/utils';
import { IllegalArgumentError, IllegalOperationError, NotSupportedError, AccessDeniedError } from '../utils/errors';
import { HUD, HUDContainer } from './hud';
import { AREvent, AREventTarget, AREventListener } from '../utils/ar-events';




/** Viewport container */
export type ViewportContainer = HTMLDivElement;

/** We admit that the size of the drawing buffer of the background canvas of the viewport may change over time */
type ViewportSizeGetter = () => SpeedySize;

/** All possible event types emitted by a Viewport */
type ViewportEventType = 'resize';

/** An event emitted by a Viewport */
class ViewportEvent extends AREvent<ViewportEventType> { }

/** Viewport event target */
class ViewportEventTarget extends AREventTarget<ViewportEventType> { }

/** Viewport style (immersive mode) */
type ViewportStyle = 'best-fit' | 'stretch' | 'inline';




/**
 * Viewport constructor settings
 */
export interface ViewportSettings
{
    /** Viewport container */
    container: Nullable<ViewportContainer>;

    /** HUD container */
    hudContainer?: Nullable<HUDContainer>;

    /** Resolution of the canvas on which the virtual scene will be drawn */
    resolution?: Resolution;

    /** Viewport style */
    style?: ViewportStyle;

    /** An existing <canvas> on which the virtual scene will be drawn */
    canvas?: Nullable<HTMLCanvasElement>;
}

/** Default viewport constructor settings */
const DEFAULT_VIEWPORT_SETTINGS: Readonly<Required<ViewportSettings>> = {
    container: null,
    hudContainer: null,
    resolution: 'lg',
    style: 'best-fit',
    canvas: null,
};




/** Base z-index of the children of the viewport container */
const BASE_ZINDEX = 0;

/** Z-index of the background canvas */
const BACKGROUND_ZINDEX = BASE_ZINDEX + 0;

/** Z-index of the foreground canvas */
const FOREGROUND_ZINDEX = BASE_ZINDEX + 1;

/** Z-index of the HUD */
const HUD_ZINDEX = BASE_ZINDEX + 2;

/** Default viewport width, in pixels */
const DEFAULT_VIEWPORT_WIDTH = 300;

/** Default viewport height, in pixels */
const DEFAULT_VIEWPORT_HEIGHT = 150;




/**
 * Helper class to work with the containers of the viewport
 */
class ViewportContainers
{
    /** The viewport container */
    private readonly _container: ViewportContainer;

    /** A direct child of the viewport container */
    private readonly _subContainer: HTMLDivElement;




    /**
     * Constructor
     * @param container viewport container
     */
    constructor(container: Nullable<ViewportContainer>)
    {
        // validate
        if(container == null)
            throw new IllegalArgumentError('Unspecified viewport container');
        else if(!(container instanceof HTMLElement))
            throw new IllegalArgumentError('Invalid viewport container');

        // store the viewport container
        this._container = container;

        // create the sub-container
        this._subContainer = document.createElement('div') as HTMLDivElement;
        container.appendChild(this._subContainer);
    }

    /**
     * The viewport container
     */
    get container(): ViewportContainer
    {
        return this._container;
    }

    /**
     * The sub-container
     */
    get subContainer(): HTMLDivElement
    {
        return this._subContainer;
    }

    /**
     * Initialize
     */
    init(): void
    {
        this._container.style.touchAction = 'none';
        this._container.style.backgroundColor = 'black';
    }

    /**
     * Release
     */
    release(): void
    {
        this._container.style.backgroundColor = 'initial';
        this._container.style.touchAction = 'auto';
    }
}




/**
 * Helper class to work with the canvases of the viewport
 */
class ViewportCanvases
{
    /** A canvas used to render the physical scene */
    private readonly _backgroundCanvas: HTMLCanvasElement;

    /** A canvas used to render the virtual scene */
    private readonly _foregroundCanvas: HTMLCanvasElement;

    /** Original CSS of the foreground canvas */
    private readonly _originalCSSTextOfForegroundCanvas: string;



    /**
     * Constructor
     * @param parent container for the canvases
     * @param fgCanvas optional existing foreground canvas
     */
    constructor(parent: HTMLElement, fgCanvas: Nullable<HTMLCanvasElement> = null)
    {
        const initialSize = Speedy.Size(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT);

        if(fgCanvas !== null && !(fgCanvas instanceof HTMLCanvasElement))
            throw new IllegalArgumentError('Not a canvas: ' + fgCanvas);

        this._originalCSSTextOfForegroundCanvas = fgCanvas ? fgCanvas.style.cssText : '';

        this._foregroundCanvas = this._styleCanvas(
            fgCanvas || this._createCanvas(initialSize),
            FOREGROUND_ZINDEX
        );

        this._backgroundCanvas = this._styleCanvas(
            this._createCanvas(initialSize),
            BACKGROUND_ZINDEX
        );

        parent.appendChild(this._backgroundCanvas);
        parent.appendChild(this._foregroundCanvas);
    }

    /**
     * The background canvas
     */
    get backgroundCanvas(): HTMLCanvasElement
    {
        return this._backgroundCanvas;
    }

    /**
     * The foreground canvas
     */
    get foregroundCanvas(): HTMLCanvasElement
    {
        return this._foregroundCanvas;
    }

    /**
     * Initialize
     */
    init(): void
    {
    }

    /**
     * Release
     */
    release(): void
    {
        this._backgroundCanvas.style.cssText = '';
        this._foregroundCanvas.style.cssText = this._originalCSSTextOfForegroundCanvas;
    }

    /**
     * Create a canvas
     * @param size size of the drawing buffer
     * @returns a new canvas
     */
    private _createCanvas(size: SpeedySize): HTMLCanvasElement
    {
        const canvas = document.createElement('canvas') as HTMLCanvasElement;

        canvas.width = size.width;
        canvas.height = size.height;

        return canvas;
    }

    /**
     * Add suitable CSS rules to a canvas
     * @param canvas
     * @param zIndex
     * @returns canvas
     */
    private _styleCanvas(canvas: HTMLCanvasElement, zIndex: number): HTMLCanvasElement
    {
        canvas.style.position = 'absolute';
        canvas.style.left = '0px';
        canvas.style.top = '0px';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = String(zIndex);

        return canvas;
    }
}




/**
 * Fullscreen utilities
 */
class ViewportFullscreenHelper
{
    /**
     * Constructor
     * @param _container the container which will be put in fullscreen
     */
    constructor(private readonly _container: HTMLElement)
    {
    }

    /**
     * Make a request to the user agent so that the viewport container is
     * displayed in fullscreen mode. The container must be a compatible element[1]
     * and the user must interact with the page in order to comply with browser
     * policies[2]. In case of error, the returned promise is rejected.
     * [1] https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen#compatible_elements
     * [2] https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen#security
     * @returns promise
     */
    request(): SpeedyPromise<void>
    {
        const container = this._container;

        // fallback for older WebKit versions
        if(container.requestFullscreen === undefined) {
            if((container as any).webkitRequestFullscreen === undefined)
                return Speedy.Promise.reject(new NotSupportedError());
            else if(!(document as any).webkitFullscreenEnabled)
                return Speedy.Promise.reject(new AccessDeniedError());

            // webkitRequestFullscreen() does not return a value
            (container as any).webkitRequestFullscreen();

            return new Speedy.Promise<void>((resolve, reject) => {
                setTimeout(() => {
                    if(container === (document as any).webkitFullscreenElement) {
                        Utils.log('Entering fullscreen mode...');
                        resolve();
                    }
                    else
                        reject(new TypeError());
                }, 100);
            });
        }

        // check if the fullscreen mode is available
        if(!document.fullscreenEnabled)
            return Speedy.Promise.reject(new AccessDeniedError());

        // request fullscreen
        return new Speedy.Promise<void>((resolve, reject) => {
            container.requestFullscreen({
                navigationUI: 'hide'
            }).then(() => {
                Utils.log('Entering fullscreen mode...');
                resolve();
            }, reject);
        });
    }

    /**
     * Exit fullscreen mode
     * @returns promise
     */
    exit(): SpeedyPromise<void>
    {
        // fallback for older WebKit versions
        if(document.exitFullscreen === undefined) {
            const doc = document as any;

            if(doc.webkitExitFullscreen === undefined)
                return Speedy.Promise.reject(new NotSupportedError());
            else if(doc.webkitFullscreenElement === null)
                return Speedy.Promise.reject(new IllegalOperationError('Not in fullscreen mode'));

            // webkitExitFullscreen() does not return a value
            doc.webkitExitFullscreen();

            return new Speedy.Promise<void>((resolve, reject) => {
                setTimeout(() => {
                    if(doc.webkitFullscreenElement === null) {
                        Utils.log('Exiting fullscreen mode...');
                        resolve();
                    }
                    else
                        reject(new TypeError());
                }, 100);
            });
        }

        // error if not in fullscreen mode
        if(document.fullscreenElement === null)
            return Speedy.Promise.reject(new IllegalOperationError('Not in fullscreen mode'));

        // exit fullscreen
        return new Speedy.Promise<void>((resolve, reject) => {
            document.exitFullscreen().then(() => {
                Utils.log('Exiting fullscreen mode...');
                resolve();
            }, reject);
        });
    }

    /**
     * Is the fullscreen mode available?
     * @returns true if the fullscreen mode is available in this platform
     */
    isAvailable(): boolean
    {
        return document.fullscreenEnabled ||
               !!((document as any).webkitFullscreenEnabled);
    }

    /**
     * Is the container currently being displayed in fullscreen mode?
     * @returns true if the container is currently being displayed in fullscreen mode
     */
    isActivated(): boolean
    {
        if(document.fullscreenElement !== undefined)
            return document.fullscreenElement === this._container;
        else if((document as any).webkitFullscreenElement !== undefined)
            return (document as any).webkitFullscreenElement === this._container;
        else
            return false;
    }
}




/**
 * Helper class to resize the viewport
 */
class ViewportResizer
{
    /** the viewport to be resized */
    private readonly _viewport: Viewport;

    /** is this viewport subject to being resized? */
    private _active: boolean;

    /** bound resize method */
    private readonly _resize: () => void;

    /** resize strategy */
    private _resizeStrategy: ViewportResizeStrategy;




    /**
     * Constructor
     * @param viewport the viewport to be resized
     */
    constructor(viewport: Viewport)
    {
        this._viewport = viewport;
        this._active = false;
        this._resize = this._onResize.bind(this);
        this._resizeStrategy = new InlineResizeStrategy();

        // initial setup
        // (the size is yet unknown)
        this._resize();
    }

    /**
     * Initialize
     */
    init(): void
    {
        // Configure the resize listener. We want the viewport
        // to adjust itself if the phone/screen is resized or
        // changes orientation
        let timeout: Nullable<ReturnType<typeof setTimeout>> = null;
        const onWindowResize = () => {
            if(!this._active) {
                window.removeEventListener('resize', onWindowResize);
                return;
            }

            if(timeout !== null)
                clearTimeout(timeout);

            timeout = setTimeout(() => {
                timeout = null;
                this._resize();
            }, 50);
        };
        window.addEventListener('resize', onWindowResize);

        // handle changes of orientation
        // (is this needed? we already listen to resize events)
        if(screen.orientation !== undefined)
            screen.orientation.addEventListener('change', this._resize);
        else
            window.addEventListener('orientationchange', this._resize); // deprecated

        // setup event listener & finish!
        this._viewport.addEventListener('resize', this._resize);
        this._active = true;

        // trigger a resize to setup the sizes / the CSS
        this.resize();
    }

    /**
     * Release
     */
    release(): void
    {
        this._resizeStrategy.clear(this._viewport);
        this._active = false;
        this._viewport.removeEventListener('resize', this._resize);

        if(screen.orientation !== undefined)
            screen.orientation.removeEventListener('change', this._resize);
        else
            window.removeEventListener('orientationchange', this._resize); // deprecated
    }

    /**
     * Trigger a resize event
     */
    resize(): void
    {
        const event = new ViewportEvent('resize');
        this._viewport.dispatchEvent(event);
    }

    /**
     * Change the resize strategy
     * @param strategy new strategy
     */
    setStrategy(strategy: ViewportResizeStrategy): void
    {
        this._resizeStrategy.clear(this._viewport);
        this._resizeStrategy = strategy;
        this.resize();
    }

    /**
     * Resize callback
     */
    private _onResize(): void
    {
        const viewport = this._viewport;

        // Resize the drawing buffer of the foreground canvas, so that it
        // matches the desired resolution, as well as the aspect ratio of the
        // background canvas
        const foregroundCanvas = viewport.canvas;
        const virtualSize = viewport.virtualSize;
        foregroundCanvas.width = virtualSize.width;
        foregroundCanvas.height = virtualSize.height;

        // Resize the drawing buffer of the background canvas
        const backgroundCanvas = viewport._backgroundCanvas;
        const realSize = viewport._realSize;
        backgroundCanvas.width = realSize.width;
        backgroundCanvas.height = realSize.height;

        // Call strategy
        this._resizeStrategy.resize(viewport);
    }
}




/**
 * Resize strategies
 */
abstract class ViewportResizeStrategy
{
    /**
     * Resize the viewport
     * @param viewport
     */
    abstract resize(viewport: Viewport): void;

    /**
     * Clear CSS rules
     * @param viewport
     */
    clear(viewport: Viewport): void
    {
        viewport.container.style.cssText = '';
        viewport._subContainer.style.cssText = '';
    }
}

/**
 * Inline viewport: it follows the typical flow of a web page
 */
class InlineResizeStrategy extends ViewportResizeStrategy
{
    resize(viewport: Viewport): void
    {
        const container = viewport.container;
        const subContainer = viewport._subContainer;
        const virtualSize = viewport.virtualSize;

        container.style.position = 'relative';
        container.style.left = '0px';
        container.style.top = '0px';
        container.style.width = virtualSize.width + 'px';
        container.style.height = virtualSize.height + 'px';

        subContainer.style.position = 'absolute';
        subContainer.style.left = '0px';
        subContainer.style.top = '0px';
        subContainer.style.width = '100%';
        subContainer.style.height = '100%';
    }
}

/**
 * Immersive viewport: it occupies the entire page
 */
abstract class ImmersiveResizeStrategy extends ViewportResizeStrategy
{
    resize(viewport: Viewport): void
    {
        const CONTAINER_ZINDEX = 1000000000;
        const container = viewport.container;

        container.style.position = 'fixed';
        container.style.left = '0px';
        container.style.top = '0px';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.zIndex = String(CONTAINER_ZINDEX);
    }
}

/**
 * Immersive viewport with best-fit style: it occupies the entire page and
 * preserves the aspect ratio of the media
 */
class BestFitResizeStrategy extends ImmersiveResizeStrategy
{
    resize(viewport: Viewport): void
    {
        const subContainer = viewport._subContainer;
        const windowAspectRatio = window.innerWidth / window.innerHeight;
        const viewportAspectRatio = viewport._realSize.width / viewport._realSize.height;
        let width = 1, height = 1;

        if(viewportAspectRatio <= windowAspectRatio) {
            height = window.innerHeight;
            width = (height * viewportAspectRatio) | 0;
        }
        else {
            width = window.innerWidth;
            height = (width / viewportAspectRatio) | 0;
        }

        subContainer.style.position = 'absolute';
        subContainer.style.left = `calc(50% - ${(width+1) >>> 1}px)`;
        subContainer.style.top = `calc(50% - ${(height+1) >>> 1}px)`;
        subContainer.style.width = width + 'px';
        subContainer.style.height = height + 'px';

        super.resize(viewport);
    }
}

/**
 * Immersive viewport with stretch style: it occupies the entire page and
 * fully stretches the media
 */
class StretchResizeStrategy extends ImmersiveResizeStrategy
{
    resize(viewport: Viewport): void
    {
        const subContainer = viewport._subContainer;

        subContainer.style.position = 'absolute';
        subContainer.style.left = '0px';
        subContainer.style.top = '0px';
        subContainer.style.width = window.innerWidth + 'px';
        subContainer.style.height = window.innerHeight + 'px';

        super.resize(viewport);
    }
}




/**
 * Viewport
 */
export class Viewport extends ViewportEventTarget
{
    /** Viewport resolution (controls the size of the drawing buffer of the foreground canvas) */
    private readonly _resolution: Resolution;

    /** The containers */
    private readonly _containers: ViewportContainers;

    /** An overlay displayed in front of the augmented scene */
    protected readonly _hud: HUD;

    /** Viewport style */
    protected _style: Nullable<ViewportStyle>;

    /** The canvases of the viewport */
    private readonly _canvases: ViewportCanvases;

    /** Fullscreen utilities */
    private readonly _fullscreen: ViewportFullscreenHelper;

    /** Resize helper */
    private readonly _resizer: ViewportResizer;

    /** The current size of the underlying SpeedyMedia */
    private _mediaSize: ViewportSizeGetter;




    /**
     * Constructor
     * @param viewportSettings
     */
    constructor(viewportSettings: ViewportSettings)
    {
        const settings = Object.assign({}, DEFAULT_VIEWPORT_SETTINGS, viewportSettings);

        super();

        this._mediaSize = () => Speedy.Size(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT);
        this._style = null;

        this._resolution = settings.resolution;
        this._containers = new ViewportContainers(settings.container);
        this._hud = new HUD(this._subContainer, settings.hudContainer);
        this._canvases = new ViewportCanvases(this._subContainer, settings.canvas);

        this._fullscreen = new ViewportFullscreenHelper(this.container);
        this._resizer = new ViewportResizer(this);
        this.style = settings.style;
    }

    /**
     * Viewport container
     */
    get container(): ViewportContainer
    {
        return this._containers.container;
    }

    /**
     * Viewport style
     */
    get style(): ViewportStyle
    {
        if(this._style === null)
            throw new IllegalOperationError();

        return this._style;
    }

    /**
     * Set viewport style
     */
    set style(value: ViewportStyle)
    {
        // nothing to do
        if(value === this._style)
            return;

        // change style
        switch(value) {
            case 'best-fit':
                this._resizer.setStrategy(new BestFitResizeStrategy());
                break;

            case 'stretch':
                this._resizer.setStrategy(new StretchResizeStrategy());
                break;

            case 'inline':
                this._resizer.setStrategy(new InlineResizeStrategy());
                break;

            default:
                throw new IllegalArgumentError('Invalid viewport style: ' + value);
        }

        this._style = value;

        // note: the viewport style is independent of the session mode!
    }

    /**
     * HUD
     */
    get hud(): HUD
    {
        return this._hud;
    }

    /**
     * Resolution of the virtual scene
     */
    get resolution(): Resolution
    {
        return this._resolution;
    }

    /**
     * Size in pixels of the drawing buffer of the canvas
     * on which the virtual scene will be drawn
     */
    get virtualSize(): SpeedySize
    {
        const size = this._realSize;
        const aspectRatio = size.width / size.height;

        return Utils.resolution(this._resolution, aspectRatio);
    }

    /**
     * Is the viewport currently being displayed in fullscreen mode?
     */
    get fullscreen(): boolean
    {
        return this._fullscreen.isActivated();
    }

    /**
     * The canvas on which the virtual scene will be drawn
     */
    get canvas(): HTMLCanvasElement
    {
        return this._canvases.foregroundCanvas;
    }

    /**
     * The canvas on which the physical scene will be drawn
     * @internal
     */
    get _backgroundCanvas(): HTMLCanvasElement
    {
        return this._canvases.backgroundCanvas;
    }

    /**
     * Size of the drawing buffer of the background canvas, in pixels
     * @internal
     */
    get _realSize(): SpeedySize
    {
        return this._mediaSize();
    }

    /**
     * Sub-container of the viewport container
     * @internal
     */
    get _subContainer(): HTMLDivElement
    {
        return this._containers.subContainer;
    }

    /**
     * Request fullscreen mode
     * @returns promise
     */
    requestFullscreen(): SpeedyPromise<void>
    {
        return this._fullscreen.request();
    }

    /**
     * Exit fullscreen mode
     * @returns promise
     */
    exitFullscreen(): SpeedyPromise<void>
    {
        return this._fullscreen.exit();
    }

    /**
     * Is the fullscreen mode available?
     * @returns true if the fullscreen mode is available in this platform
     */
    isFullscreenAvailable(): boolean
    {
        return this._fullscreen.isAvailable();
    }

    /**
     * Initialize the viewport (when the session starts)
     * @internal
     */
    _init(getMediaSize: ViewportSizeGetter): void
    {
        this._mediaSize = getMediaSize;

        this._containers.init();
        this._hud._init(HUD_ZINDEX);
        this._canvases.init();
        this._resizer.init();
    }

    /**
     * Release the viewport (when the session ends)
     * @internal
     */
    _release(): void
    {
        this._resizer.release();
        this._canvases.release();
        this._hud._release();
        this._containers.release();
    }
}