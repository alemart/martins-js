/*
 * encantar.js
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
 * image-tracker.ts
 * Image Tracker
 */

import Speedy from 'speedy-vision';
import { SpeedySize } from 'speedy-vision/types/core/speedy-size';
import { SpeedyMatrix } from 'speedy-vision/types/core/speedy-matrix';
import { SpeedyMedia } from 'speedy-vision/types/core/speedy-media';
import { SpeedyPipeline } from 'speedy-vision/types/core/pipeline/pipeline';
import { SpeedyPromise } from 'speedy-vision/types/core/speedy-promise';
import { SpeedyPipelineNode } from 'speedy-vision/types/core/pipeline/pipeline-node';
import { SpeedyPipelineNodeImageSource } from 'speedy-vision/types/core/pipeline/nodes/images/source';
import { SpeedyPipelineNodeResize } from 'speedy-vision/types/core/pipeline/nodes/transforms/resize';
import { SpeedyPipelineNodeFASTKeypointDetector } from 'speedy-vision/types/core/pipeline/nodes/keypoints/detectors/fast';
import { SpeedyKeypoint } from 'speedy-vision/types/core/speedy-keypoint';
import { Tracker, TrackerOutput, TrackerResult, Trackable } from '../tracker';
import { Session } from '../../core/session';
import { IllegalOperationError, IllegalArgumentError } from '../../utils/errors';
import { Resolution } from '../../utils/resolution';
import { ReferenceImage } from './reference-image';
import { ReferenceImageDatabase } from './reference-image-database';
import { ImageTrackerState } from './states/state';
import { ImageTrackerInitialState } from './states/initial';
import { ImageTrackerTrainingState } from './states/training';
import { ImageTrackerScanningState } from './states/scanning';
import { ImageTrackerPreTrackingState } from './states/pre-tracking';
import { ImageTrackerTrackingState } from './states/tracking';
import { Nullable, Utils } from '../../utils/utils';
import { AREventTarget } from '../../utils/ar-events';
import { DEFAULT_TRACKING_RESOLUTION } from './settings';
import { ImageTrackerEvent, ImageTrackerEventType } from './image-tracker-event';
import { SpeedyPoint2 } from 'speedy-vision/types/core/speedy-point';
import { Viewer } from '../../geometry/viewer';
import { Pose } from '../../geometry/pose';

/*

A few definitions:

1. Viewport size:
    size of the drawing buffer of the background canvas = size of the input
    media, in pixels

2. AR screen size:
    size for image processing operations, determined by the resolution of the
    tracker and by the aspect ratio of the input media

*/

/** A trackable target */
export interface TrackableImage extends Trackable
{
    /** the pose of the target */
    readonly pose: Pose;

    /** the reference image linked to the target */
    readonly referenceImage: ReferenceImage;
}

/** Image Tracker result to be consumed by the user */
export interface ImageTrackerResult extends TrackerResult
{
    /** tracker */
    readonly tracker: ImageTracker;

    /** trackable targets */
    readonly trackables: TrackableImage[];

    /** 3D virtual camera */
    readonly viewer: Viewer;
}

/** Image Tracker output */
export interface ImageTrackerOutput extends TrackerOutput
{
    /** tracker result to be consumed by the user */
    readonly exports?: ImageTrackerResult;

    /** size of the AR screen space, in pixels */
    readonly screenSize?: SpeedySize;

    /** optional keypoints */
    readonly keypoints?: SpeedyKeypoint[];

    /** optional polyline for testing */
    readonly polyline?: SpeedyPoint2[];

    /** optional 3x4 camera matrix in AR screen space */
    readonly cameraMatrix?: SpeedyMatrix;

    /** 3x3 homography in AR screen space */
    homography?: SpeedyMatrix;
}

/** All possible states of an Image Tracker */
export type ImageTrackerStateName = 'initial' | 'training' | 'scanning' | 'pre-tracking' | 'tracking';

/** A helper */
const formatSize = (size: SpeedySize) => `${size.width}x${size.height}`;






/**
 * The ImageTracker tracks an image (one at a time)
 */
export class ImageTracker extends AREventTarget<ImageTrackerEventType> implements Tracker
{
    /** session */
    private _session: Nullable<Session>;

    /** all states */
    private readonly _state: Record<ImageTrackerStateName, ImageTrackerState>;

    /** name of the active state */
    private _activeStateName: ImageTrackerStateName;

    /** last emitted output of the tracker */
    private _lastOutput: ImageTrackerOutput;

    /** reference image database */
    private readonly _database: ReferenceImageDatabase;

    /** the AR resolution size, used in GPU processing, defines the AR screen space */
    private _resolution: Resolution;



    /**
     * Constructor
     */
    constructor()
    {
        super();

        // the states
        this._state = {
            'initial': new ImageTrackerInitialState(this),
            'training': new ImageTrackerTrainingState(this),
            'scanning': new ImageTrackerScanningState(this),
            'pre-tracking': new ImageTrackerPreTrackingState(this),
            'tracking': new ImageTrackerTrackingState(this),
        };

        // initial setup
        this._session = null;
        this._activeStateName = 'initial';
        this._lastOutput = { };
        this._database = new ReferenceImageDatabase();

        // user settings
        this._resolution = DEFAULT_TRACKING_RESOLUTION;
    }

    /**
     * The type of the tracker
     */
    get type(): string
    {
        return 'image-tracker';
    }

    /**
     * Current state name
     */
    get state(): ImageTrackerStateName
    {
        return this._activeStateName;
    }

    /**
     * Reference Image Database
     * Must be configured before training the tracker
     */
    get database(): ReferenceImageDatabase
    {
        return this._database;
    }

    /**
     * Resolution of the AR screen space
     */
    get resolution(): Resolution
    {
        return this._resolution;
    }

    /**
     * Resolution of the AR screen space
     */
    set resolution(resolution: Resolution)
    {
        this._resolution = resolution;
    }

    /**
     * Size of the AR screen space, in pixels
     * @internal
     */
    get screenSize(): SpeedySize
    {
        return this._state[this._activeStateName].screenSize;
    }

    /**
     * Last emitted output
     * @internal
     */
    get _output(): ImageTrackerOutput
    {
        return this._lastOutput;
    }

    /**
     * Stats related to this tracker
     * @internal
     */
    get _stats(): string
    {
        return `${formatSize(this.screenSize)} ${this.state}`;
    }

    /**
     * Initialize this tracker
     * @param session
     * @returns promise that resolves after the tracker has been initialized
     * @internal
     */
    _init(session: Session): SpeedyPromise<void>
    {
        // store the session
        this._session = session;

        // initialize states
        for(const state of Object.values(this._state))
            state.init();

        // done!
        return Speedy.Promise.resolve();
    }

    /**
     * Release this tracker
     * @returns promise that resolves after the tracker has been released
     * @internal
     */
    _release(): SpeedyPromise<void>
    {
        // release states
        for(const state of Object.values(this._state))
            state.release();

        // unlink session
        this._session = null;

        // done!
        return Speedy.Promise.resolve();
    }

    /**
     * Update the tracker
     * @returns promise
     * @internal
     */
    _update(): SpeedyPromise<void>
    {
        // validate
        if(this._session == null)
            return Speedy.Promise.reject(new IllegalOperationError(`Uninitialized tracker`));

        // compute the screen size for image processing purposes
        // note: this may change over time...!
        const media = this._session.media;
        const aspectRatio = media.width / media.height;
        const screenSize = Utils.resolution(this._resolution, aspectRatio);

        // run the active state
        const activeState = this._state[this._activeStateName];
        return activeState.update(media, screenSize).then(({ trackerOutput, nextState, nextStateSettings }) => {
            // update the output of the tracker
            this._lastOutput = trackerOutput;

            // need to change the state?
            if(this._activeStateName != nextState) {
                activeState.onLeaveState();
                this._activeStateName = nextState;
                this._state[nextState].onEnterState(nextStateSettings || {});
            }
        });
    }

    /**
     * Get reference image
     * @param keypointIndex -1 if not found
     * @returns reference image
     * @internal
     */
    _referenceImageOfKeypoint(keypointIndex: number): Nullable<ReferenceImage>
    {
        const training = this._state.training as ImageTrackerTrainingState;
        return training.referenceImageOfKeypoint(keypointIndex);
    }

    /**
     * Get reference image index
     * @param keypointIndex -1 if not found
     * @returns reference image index, or -1 if not found
     * @internal
     */
    _referenceImageIndexOfKeypoint(keypointIndex: number): number
    {
        const training = this._state.training as ImageTrackerTrainingState;
        return training.referenceImageIndexOfKeypoint(keypointIndex);
    }

    /**
     * Get a keypoint of the trained set
     * @param keypointIndex
     * @returns a keypoint
     * @internal
     */
    _referenceKeypoint(keypointIndex: number): Nullable<SpeedyKeypoint>
    {
        const training = this._state.training as ImageTrackerTrainingState;
        return training.referenceKeypoint(keypointIndex);
    }
}