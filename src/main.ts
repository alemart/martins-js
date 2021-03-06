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
 * main.ts
 * Entry point
 */

import Speedy from 'speedy-vision';
import { SpeedyPromise } from 'speedy-vision/types/core/speedy-promise';
import { Settings } from './core/settings';
import { Session, SessionOptions } from './core/session';
import { TrackerFactory } from './trackers/tracker-factory';
import { SourceFactory } from './sources/source-factory';
import { Viewport, ViewportSettings, BaseViewport } from './core/viewport';
import { Utils } from './utils/utils';
declare const __MARTINS_VERSION__: string;
declare const __MARTINS_DEVELOPMENT_MODE__: string;
declare const __MARTINS_WEBSITE__: string;

/**
 * GPU-accelerated Augmented Reality for the web
 */
export default class Martins
{
    /**
     * Start a new session
     * @param options
     * @returns a promise that resolves to a new session
     */
    static startSession(options?: SessionOptions): SpeedyPromise<Session>
    {
        return Session.instantiate(options);
    }

    /**
     * Trackers
     */
    static get Tracker(): typeof TrackerFactory
    {
        return TrackerFactory;
    }

    /**
     * Sources of data
     */
    static get Source(): typeof SourceFactory
    {
        return SourceFactory;
    }

    /**
     * Create a viewport
     * @param settings
     * @returns a new viewport with the specified settings
     */
    static Viewport(settings: ViewportSettings): Viewport
    {
        return new BaseViewport(settings);
    }

    /**
     * Global Settings
     */
    static get Settings(): typeof Settings
    {
        return Settings;
    }

    /**
     * Engine version
     */
    static get version(): string
    {
        if(__MARTINS_DEVELOPMENT_MODE__)
            return __MARTINS_VERSION__ + '-dev';
        else
            return __MARTINS_VERSION__;
    }

    /**
     * Engine edition
     */
    static get edition(): string
    {
        return 'Free Edition';
    }

    /**
     * Speedy Vision
     */
    static get Speedy(): typeof Speedy
    {
        return Speedy;
    }

    /**
     * Checks if the engine can be run in the browser the client is using
     * @returns true if the engine is compatible with the browser
     */
    static isSupported(): boolean
    {
        return Session.isSupported();
    }
}

// Freeze the namespace
Object.freeze(Martins);

// Add Speedy Vision to global scope
((window: any) => window.Speedy = window.Speedy || Speedy)(window);

// Display a notice
Utils.log(
    `MARTINS.js ${Martins.edition} version ${Martins.version}. ` +
    `GPU-accelerated Augmented Reality for the web by Alexandre Martins. ` +
    __MARTINS_WEBSITE__
);