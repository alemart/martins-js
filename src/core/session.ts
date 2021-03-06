/*
 * MARTINS.js Free Edition
 * GPU-accelerated Augmented Reality for the web
 * Copyright (C) 2022  Alexandre Martins <alemartf(at)gmail.com>
 * https://github.com/alemart/martins-js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * session.ts
 * WebAR Session
 */

import Speedy from 'speedy-vision';
import { SpeedyMedia } from 'speedy-vision/types/core/speedy-media';
import { SpeedyPromise } from 'speedy-vision/types/core/speedy-promise';
import { Nullable, Utils } from '../utils/utils';
import { AREvent, AREventTarget } from '../utils/ar-events';
import { IllegalArgumentError, IllegalOperationError, NotSupportedError } from '../utils/errors';
import { Viewport, ImmersiveViewport, InlineViewport } from './viewport';
import { Settings } from './settings';
import { Stats } from './stats';
import { StatsPanel } from './stats-panel';
import { Frame } from './frame';
import { Tracker } from '../trackers/tracker';
import { Time } from './time';
import { Gizmos } from './gizmos';
import { Source } from '../sources/source';
import { asap } from '../utils/asap';

/** Session mode */
export type SessionMode = 'immersive' | 'inline';

/** Session options */
export interface SessionOptions
{
    /** session mode */
    mode?: SessionMode;

    /** trackers */
    trackers: Tracker[];

    /** sources of data */
    sources: Source[];

    /** viewport */
    viewport: Nullable<Viewport>;

    /** show stats? */
    stats?: boolean;

    /** Render gizmos? */
    gizmos?: boolean;
}

/** requestAnimationFrame callback */
type SessionRequestAnimationFrameCallback = (time: DOMHighResTimeStamp, frame: Frame) => void;

/** requestAnimationFrame callback handle */
type SessionRequestAnimationFrameHandle = symbol;

/** All possible event types emitted by a Session */
type SessionEventType = 'end';

/** An event emitted by a Session */
class SessionEvent extends AREvent<SessionEventType> { }

/** Default options when starting a session */
const DEFAULT_OPTIONS: Readonly<Required<SessionOptions>> = {
    mode: 'immersive',
    trackers: [],
    sources: [],
    viewport: null,
    stats: false,
    gizmos: false,
};



/**
 * A Session represents an intent to display AR content
 * and encapsulates the main loop (update-render cycle)
 */
export class Session extends AREventTarget<SessionEventType>
{
    /** Number of active sessions */
    private static _count = 0;

    /** Session mode */
    private readonly _mode: SessionMode;

    /** Attached trackers */
    private _trackers: Tracker[];

    /** Sources of data */
    private readonly _sources: Source[];

    /** Rendering viewport */
    private readonly _viewport: Viewport;

    /** Time Manager */
    private _time: Time;

    /** Is the session currently active? */
    private _active: boolean;

    /** Whether or not the frame is ready to be rendered */
    private _frameReady: boolean;

    /** Request animation frame callback queue */
    private _rafQueue: Array<[SessionRequestAnimationFrameHandle, SessionRequestAnimationFrameCallback]>;

    /** Update stats (GPU cycles/s) */
    private _updateStats: Stats;

    /** Render stats (FPS) */
    private _renderStats: Stats;

    /** Stats panel */
    private _statsPanel: StatsPanel;

    /** Gizmos */
    private _gizmos: Gizmos;



    /**
     * Constructor
     * @param sources previously initialized sources of data
     * @param mode session mode
     * @param viewport viewport
     * @param stats render stats panel?
     * @param gizmos render gizmos?
     */
    private constructor(sources: Source[], mode: SessionMode, viewport: Viewport, stats: boolean, gizmos: boolean)
    {
        super();

        this._mode = mode;
        this._trackers = [];
        this._sources = sources;
        this._updateStats = new Stats();
        this._renderStats = new Stats();
        this._active = true;
        this._frameReady = true; // no trackers at the moment
        this._rafQueue = [];
        this._time = new Time();
        this._gizmos = new Gizmos();
        this._gizmos.visible = gizmos;

        // get media
        const media = this.media;

        // setup the viewport
        if(mode == 'immersive')
            this._viewport = new ImmersiveViewport(viewport, () => media.size);
        else if(mode == 'inline')
            this._viewport = new InlineViewport(viewport, () => media.size);
        else
            throw new IllegalArgumentError(`Invalid session mode "${mode}"`);
        this._viewport._init();

        // setup the main loop
        this._setupUpdateLoop();
        this._setupRenderLoop();

        // setup the stats panel
        this._statsPanel = new StatsPanel(this._viewport.hud.container);
        this._statsPanel.visible = stats;

        // done!
        Session._count++;
        Utils.log(`The ${mode} session is now active!`);
    }

    /**
     * Checks if the engine can be run in the browser the client is using
     * @returns true if the engine is compatible with the browser
     */
    static isSupported(): boolean
    {
        return Speedy.isSupported();
    }

    /** 
     * Instantiate a session
     * @param options options
     * @returns a promise that resolves to a new session
     */
    static instantiate(options: SessionOptions = DEFAULT_OPTIONS): SpeedyPromise<Session>
    {
        const {
            mode = DEFAULT_OPTIONS.mode,
            sources = DEFAULT_OPTIONS.sources,
            trackers = DEFAULT_OPTIONS.trackers,
            viewport = DEFAULT_OPTIONS.viewport,
            stats = DEFAULT_OPTIONS.stats,
            gizmos = DEFAULT_OPTIONS.gizmos,
        } = options;

        Utils.log(`Starting a new ${mode} session...`);

        return Speedy.Promise.resolve().then(() => {

            // is the engine supported?
            if(!Session.isSupported())
                throw new NotSupportedError('You need a browser/device compatible with WebGL2 and WebAssembly in order to experience Augmented Reality with the MARTINS.js engine');

            // block multiple immersive sessions
            if(mode !== 'inline' && Session.count > 0)
                throw new IllegalOperationError(`Can't start more than one immersive session`);

            // initialize matrix routines
            return Speedy.Matrix.ready();

        }).then(() => {

            // validate sources of data
            const videoSources = sources.filter(source => source._type == 'video');
            if(videoSources.length != 1)
                throw new IllegalArgumentError(`One video source of data must be provided`);

            for(let i = sources.length - 1; i >= 0; i--) {
                if(sources.indexOf(sources[i]) < i)
                    throw new IllegalArgumentError(`Found repeated sources of data`);
            }

            // initialize sources of data
            return Speedy.Promise.all(
                sources.map(source => source._init())
            );

        }).then(() => {

            // get the viewport
            if(!viewport)
                throw new IllegalArgumentError(`Can't create a session without a viewport`);

            // instantiate session
            return new Session(sources, mode, viewport, stats, gizmos);

        }).then(session => {

            // validate trackers
            if(trackers.length == 0)
                Utils.warning(`No trackers have been attached to the session!`);

            for(let i = trackers.length - 1; i >= 0; i--) {
                if(trackers.indexOf(trackers[i]) < i)
                    throw new IllegalArgumentError(`Found repeated trackers`);
            }

            // attach trackers and return the session
            return Speedy.Promise.all(
                trackers.map(tracker => session._attachTracker(tracker))
            ).then(() => session);

        }).catch(err => {

            // log errors, if any
            Utils.error(`Can't start session: ${err.message}`);
            throw err;

        });
    }

    /**
     * Number of active sessions
     */
    static get count(): number
    {
        return this._count;
    }

    /**
     * End the session
     * @returns promise that resolves after the session is shut down
     */
    end(): SpeedyPromise<void>
    {
        // is the session inactive?
        if(!this._active)
            return Speedy.Promise.resolve();

        // deactivate the session
        Utils.log('Shutting down the session...');
        this._active = false; // set before wait()

        // wait a few ms, so that the GPU is no longer sending any data
        const wait = (ms: number) => new Speedy.Promise<void>(resolve => {
            setTimeout(resolve, ms);
        });

        // release resources
        return wait(100).then(() => Speedy.Promise.all(

            // release trackers
            this._trackers.map(tracker => tracker._release())

        )).then(() => Speedy.Promise.all(

            // release input sources
            this._sources.map(source => source._release())

        )).then(() => {

            this._sources.length = 0;
            this._trackers.length = 0;

            // release internal components
            this._updateStats.reset();
            this._renderStats.reset();
            this._statsPanel.release();
            this._viewport._release();

            // end the session
            Session._count--;

            // dispatch event
            const event = new SessionEvent('end');
            this.dispatchEvent(event);

            // done!
            Utils.log('Session ended.');

        });
    }

    /**
     * Analogous to window.requestAnimationFrame()
     * @param callback
     * @returns a handle
     */
    requestAnimationFrame(callback: SessionRequestAnimationFrameCallback): SessionRequestAnimationFrameHandle
    {
        const handle: SessionRequestAnimationFrameHandle = Symbol('raf-handle');

        if(this._active)
            this._rafQueue.push([ handle, callback ]);
        else
            throw new IllegalOperationError(`Can't requestAnimationFrame(): session ended.`);

        return handle;
    }

    /**
     * Analogous to window.cancelAnimationFrame()
     * @param handle a handle returned by this.requestAnimationFrame()
     */
    cancelAnimationFrame(handle: SessionRequestAnimationFrameHandle): void
    {
        for(let i = this._rafQueue.length - 1; i >= 0; i--) {
            if(this._rafQueue[i][0] === handle) {
                this._rafQueue.splice(i, 1);
                break;
            }
        }
    }

    /**
     * The underlying media (generally a camera stream)
     * @internal
     */
    get media(): SpeedyMedia
    {
        for(let i = this._sources.length - 1; i >= 0; i--) {
            if(this._sources[i]._type == 'video')
                return this._sources[i]._data as SpeedyMedia;
        }

        // this shouldn't happen
        throw new IllegalOperationError(`Invalid input source`);
    }

    /**
     * Session mode
     */
    get mode(): SessionMode
    {
        return this._mode;
    }

    /**
     * Rendering viewport
     */
    get viewport(): Viewport
    {
        return this._viewport;
    }

    /**
     * Time utilities
     */
    get time(): Time
    {
        return this._time;
    }

    /**
     * Visual cues for testing & debugging
     */
    get gizmos(): Gizmos
    {
        return this._gizmos;
    }

    /**
     * Attach a tracker to the session
     * @param tracker
     */
    private _attachTracker(tracker: Tracker): SpeedyPromise<void>
    {
        if(this._trackers.indexOf(tracker) >= 0)
            throw new IllegalArgumentError(`Duplicate tracker attached to the session`);
        else if(!this._active)
            throw new IllegalOperationError(`Inactive session`);

        this._trackers.push(tracker);
        return tracker._init(this);
    }

    /**
     * Render the user media to the background canvas
     */
    private _renderUserMedia(): void
    {
        const canvas = this._viewport._background;
        const ctx = canvas.getContext('2d', { alpha: false });
        
        if(ctx) {
            ctx.imageSmoothingEnabled = false;

            // draw user media
            const image = this.media.source;
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            // render output image(s)
            for(let i = 0; i < this._trackers.length; i++) {
                const image = this._trackers[i]._output.image;
                if(image !== undefined)
                    ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
                    //ctx.drawImage(image.source, canvas.width - image.width, canvas.height - image.height, image.width, image.height);
            }

            // render gizmos
            this._gizmos._render(this._viewport, this._trackers);
        }
    }

    /**
     * Setup the update loop
     */
    private _setupUpdateLoop(): void
    {
        const scheduleNextFrame = () => {
            if(this._active) {
                if(Settings.powerPreference == 'high-performance')
                    asap(repeat);
                else
                    window.requestAnimationFrame(repeat);
            }
        };
        
        const update = () => {
            this._update().then(scheduleNextFrame).turbocharge();
        };

        function repeat() {
            if(Settings.powerPreference == 'low-power') // 30 fps
                window.requestAnimationFrame(update);
            else
                update();
        }

        window.requestAnimationFrame(update);
    }

    /**
     * The core of the update loop
     */
    private _update(): SpeedyPromise<void>
    {
        // active session?
        if(this._active) {
            return Speedy.Promise.all(
                // update trackers
                this._trackers.map(tracker => tracker._update().turbocharge())
            ).then(() => {
                // update internals
                this._updateStats.update();
                this._frameReady = true;
            }).catch(err => {
                // handle error
                Utils.warning('Tracking error: ' + err.toString());
            });
        }
        else {
            // inactive session
            this._updateStats.reset();
            return Speedy.Promise.resolve();
        }
    }

    /**
     * Setup the render loop
     */
    private _setupRenderLoop(): void
    {
        let skip = false, toggle = false;

        const render = (timestamp: DOMHighResTimeStamp) => {
            const enableFrameSkipping = (Settings.powerPreference == 'low-power');
            const highPerformance = (Settings.powerPreference == 'high-performance');

            // advance time
            this._time._update(timestamp);

            // skip frames
            if(!enableFrameSkipping || !(skip = !skip))
                this._render(timestamp, false);
                //this._render(timestamp, !enableFrameSkipping && !highPerformance && (toggle = !toggle));

            // repeat
            if(this._active)
                window.requestAnimationFrame(render);
        };

        window.requestAnimationFrame(render);
    }

    /**
     * Render a frame (RAF callback)
     * @param time current time, in ms
     * @param skipUserMedia skip copying the pixels of the user media to the background canvas in order to reduce the processing load (video stream is probably at 30fps?)
     */
    private _render(time: DOMHighResTimeStamp, skipUserMedia: boolean): void
    {
        // is the session active?
        if(this._active) {

            // are we ready to render a frame?
            if(this._frameReady) {

                // create a frame
                const results = this._trackers.map(tracker =>
                    tracker._output.exports || ({
                        tracker: tracker,
                        trackables: [],
                    })
                );
                const frame = new Frame(this, results);

                // clone & clear the RAF queue
                const rafQueue = this._rafQueue.slice(0);
                this._rafQueue.length = 0;

                // render user media
                if(!skipUserMedia)
                    this._renderUserMedia();

                // render frame
                for(let i = 0; i < rafQueue.length; i++)
                    rafQueue[i][1].call(undefined, time, frame);

                // update internals
                this._renderStats.update();
                this._statsPanel.update(time, this._trackers, this._sources, this._updateStats.cyclesPerSecond, this._renderStats.cyclesPerSecond);
                this._frameReady = false;

            }
            else {

                // skip frame
                ;

                // we'll update the renderStats even if we skip the frame,
                // otherwise this becomes updateStats! (approximately)
                // This is a window.requestAnimationFrame() call, so the
                // browser is rendering content even if we're not.
                this._renderStats.update();

            }

        }
        else {

            // inactive session
            this._renderStats.reset();

        }
    }
}
