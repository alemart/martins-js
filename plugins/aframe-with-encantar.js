/**
 * A-Frame plugin for encantar.js
 * @author Alexandre Martins <alemartf(at)gmail.com> (https://github.com/alemart/encantar-js)
 * @license LGPL-3.0-or-later
 */

(function() {

/* Usage of the indicated versions is encouraged */
__THIS_PLUGIN_HAS_BEEN_TESTED_WITH__({
    'encantar.js': { version: '0.3.0' },
        'A-Frame': { version: '1.4.2' }
});

/**
 * AR Utilities
 */
const ARUtils = () => ({

    findTrackedImage(frame, name = '')
    {
        if(frame === null)
            return null;

        for(const result of frame.results) {
            if(result.tracker.type == 'image-tracker') {
                for(const trackable of result.trackables) {
                    if(name === '' || name === trackable.referenceImage.name) {
                        return {
                            projectionMatrix: result.viewer.view.projectionMatrix,
                            viewMatrixInverse: result.viewer.pose.transform.matrix,
                            modelMatrix: trackable.pose.transform.matrix,
                        };
                    }
                }
            }
        }

        return null;
    },

});

/* ========================================================================= */

/**
 * AR System
 */
AFRAME.registerSystem('ar', {

    // el;
    // data;
    // schema;

    session: null,
    frame: null,
    utils: ARUtils(),
    _started: false,
    _components: [],
    _roots: [],

    init()
    {
        const scene = this.el;

        // validate
        if(!scene.getAttribute('ar-session')) {
            scene.setAttribute('ar-session', {}); // use a default ar-session
            //throw new Error('Missing ar-session in a-scene'); // other errors will appear
        }

        // initial setup
        scene.setAttribute('vr-mode-ui', { enabled: false });
        scene.setAttribute('embedded', true);
        scene.setAttribute('renderer', { alpha: true });

        // pause the scene until we're ready
        scene.addEventListener('ar-started', () => {
            scene.play();
        });
        scene.addEventListener('loaded', () => {
            //scene.pause();
            Promise.resolve().then(() => scene.pause());
        });

        /*
        // we take control of the rendering
        scene.addEventListener('loaded', () => {
            scene.renderer.setAnimationLoop(null);
        });
        */
    },

    tick()
    {
        const scene = this.el;

        // we take control of the rendering
        scene.renderer.setAnimationLoop(null);

        // manually update the roots
        for(let i = 0; i < this._roots.length; i++)
            this._roots[i].teek();
    },

    startSession()
    {
        if(this._started)
            throw new Error('Can\'t start an AR session twice');
        this._started = true;

        for(const component of this._components)
            component.validate();

        return Speedy.Promise.all([
            this._loadSources(),
            this._loadTrackers(),
            this._loadViewport(),
            this._loadPreferences(),
        ])
        .then(([
            sources,
            trackers,
            viewport,
            preferences,
        ]) => AR.startSession(
            Object.assign({}, preferences, {
                sources,
                trackers,
                viewport
            })
        ))
        .then(session => {
            // setup
            this.session = session;
            this._configureSession();
            this._startAnimationLoop();

            // we're done!
            const scene = this.el;
            scene.emit('ar-started', { ar: this });
            return session;
        })
        .catch(error => {
            console.error(error);
            throw error;
        });
    },

    register(component)
    {
        this._register(this._components, component);
    },

    unregister(component)
    {
        this._unregister(this._components, component);
    },

    registerRoot(component)
    {
        this._register(this._roots, component);
    },

    unregisterRoot(component)
    {
        this._unregister(this._roots, component);
    },

    _register(arr, component)
    {
        const j = arr.indexOf(component);
        if(j < 0)
            arr.push(component);
    },

    _unregister(arr, component)
    {
        const j = arr.indexOf(component);
        if(j >= 0)
            arr.splice(j, 1);
    },

    _configureSession()
    {
        const scene = this.el;
        const session = this.session;

        if(session.viewport.canvas !== scene.canvas) {
            session.end();
            throw new Error('Invalid A-Frame canvas');
        }

        session.addEventListener('end', () => {
            this.frame = null;
        });

        session.viewport.addEventListener('resize', () => {
            // timeout : internals of aframe (a-scene.js)
            setTimeout(() => this._resize(), 200);
            this._resize();
        });

        this._resize(); // initial setup
    },

    _startAnimationLoop()
    {
        const scene = this.el;
        const session = this.session;

        scene.object3D.background = null;

        const animate = (time, frame) => {
            this.frame = frame;
            scene.render();
            session.requestAnimationFrame(animate);
        };

        session.requestAnimationFrame(animate);
    },

    _resize()
    {
        const scene = this.el;
        const size = this.session.viewport.virtualSize;

        scene.renderer.setPixelRatio(1.0);
        scene.renderer.setSize(size.width, size.height, false);
    },

    _loadTrackers()
    {
        const scene = this.el;
        const groups = Array.from(
            scene.querySelectorAll('[ar-trackers]'),
            el => el.components['ar-trackers']
        );

        if(groups.length > 1)
            throw new Error('Can\'t define multiple groups of ar-trackers');
        else if(groups.length == 0)
            throw new Error('Missing ar-trackers');

        return groups[0].trackers();
    },

    _loadSources()
    {
        const scene = this.el;
        const groups = Array.from(
            scene.querySelectorAll('[ar-sources]'),
            el => el.components['ar-sources']
        );

        if(groups.length > 1)
            throw new Error('Can\'t define multiple groups of ar-sources');
        else if(groups.length == 0)
            throw new Error('Missing ar-sources');

        return groups[0].sources();
    },

    _loadViewport()
    {
        const scene = this.el;
        const viewports = Array.from(
            scene.querySelectorAll('[ar-viewport]'),
            el => el.components['ar-viewport']
        );

        if(viewports.length > 1)
            throw new Error('Can\'t define multiple ar-viewport\'s');
        else if(viewports.length == 0)
            throw new Error('Missing ar-viewport');

        return viewports[0].viewport();
    },

    _loadPreferences()
    {
        const scene = this.el;
        const sessionComponent = scene.components['ar-session'];

        if(sessionComponent === undefined)
            throw new Error('Missing ar-session in a-scene');

        return sessionComponent.preferences();
    },

});

/**
 * AR Component
 */
const ARComponent = obj => Object.assign({}, obj, {

    // el;
    // data;
    // id;

    init()
    {
        Object.defineProperty(this, 'ar', {
            get: function() { return this.el.sceneEl.systems.ar; }
        });

        this.ar.register(this);

        if(obj.init !== undefined)
            obj.init.call(this);

        if(this.el.sceneEl.hasLoaded)
            this.validate();
    },

    remove()
    {
        if(obj.remove !== undefined)
            obj.remove.call(this);

        this.ar.unregister(this);
    },

    validate()
    {
        if(obj.validate !== undefined)
            obj.validate.call(this);
    }

});

/**
 * AR Session
 */
AFRAME.registerComponent('ar-session', ARComponent({

    schema: {

        /** session mode: "immersive" | "inline" */
        'mode': { type: 'string', default: 'immersive' },

        /** show stats panel? */
        'stats': { type: 'boolean', default: false },

        /** show gizmos? */
        'gizmos': { type: 'boolean', default: false },

        /** start the session automatically? */
        'autoplay': { type: 'boolean', default: true },

    },

    sceneOnly: true,
    _started: false,

    init()
    {
        this._started = false;
    },

    play()
    {
        // start the session (run once)
        if(!this._started) {
            this._started = true;
            if(this.data.autoplay)
                this.startSession();
        }
    },

    remove()
    {
        // end the session
        if(this.ar.session !== null)
            this.ar.session.end();
    },

    preferences()
    {
        return {
            mode: this.data.mode,
            stats: this.data.stats,
            gizmos: this.data.gizmos
        };
    },

    startSession()
    {
        return this.ar.startSession();
    },

}));

/* ========================================================================= */

/**
 * AR Camera
 */
AFRAME.registerComponent('ar-camera', ARComponent({

    dependencies: ['camera'],

    init()
    {
        const el = this.el;

        el.setAttribute('camera', { active: true });
        el.setAttribute('wasd-controls', { enabled: false });
        el.setAttribute('look-controls', { enabled: false });
        el.setAttribute('position', { x: 0, y: 0, z: 0 }); // A-Frame sets y = 1.6m for VR
        
        const camera = el.getObject3D('camera');
        camera.matrixAutoUpdate = false;
    },

    tick()
    {
        const ar = this.ar;
        const el = this.el;

        const tracked = ar.utils.findTrackedImage(ar.frame);
        if(tracked === null)
            return;

        const camera = el.getObject3D('camera');
        camera.projectionMatrix.fromArray(tracked.projectionMatrix.read());
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        camera.matrix.fromArray(tracked.viewMatrixInverse.read());
        camera.updateMatrixWorld(true);

        //console.log('projectionMatrix', tracked.projectionMatrix.read());
        //console.log('viewMatrixInverse', tracked.viewMatrixInverse.read());
    },
    
    validate()
    {
        if(!this.el.getAttribute('camera'))
            throw new Error('Incorrect ar-camera');

        if(this.el.parentNode !== this.el.sceneEl)
            throw new Error('ar-camera must be a direct child of a-scene');
    },

}));

AFRAME.registerPrimitive('ar-camera', {
    defaultComponents: {
        'ar-camera': {},
        'camera': {}
    }
});

/**
 * AR Root node
 */
AFRAME.registerComponent('ar-root', ARComponent({

    schema: {

        /** the name of a reference image (target) or the empty string (to match any target) */
        'referenceImage': { type: 'string', default: '' },

    },

    _origin: null,
    _firstRun: true,

    init()
    {
        const origin = new THREE.Group();
        origin.matrixAutoUpdate = false;

        const root = this.el.object3D;
        root.parent.add(origin);
        origin.add(root);

        this._origin = origin;
        this._firstRun = true;

        this.ar.registerRoot(this);
    },

    remove()
    {
        const origin = this._origin;
        const root = this.el.object3D;

        origin.parent.add(root);
        origin.removeFromParent();
        this._origin = null;

        this.ar.unregisterRoot(this);
    },

    play()
    {
        const root = this.el.object3D;
        root.visible = true;

        if(this._firstRun) {
            this._firstRun = false;
            root.visible = false;
            this.el.pause();
        }
    },

    pause()
    {
        const root = this.el.object3D;
        root.visible = false;
    },

    teek()
    {
        const ar = this.ar;
        const targetName = this.data.referenceImage;

        const tracked = ar.utils.findTrackedImage(ar.frame, targetName);
        if(tracked === null) {
            this.el.pause();
            return;
        }

        const origin = this._origin;
        origin.matrix.fromArray(tracked.modelMatrix.read());
        origin.updateMatrixWorld(true);
        this.el.play();

        //console.log('modelMatrix', tracked.modelMatrix.toString());
    },

    validate()
    {
        if(this.el.parentNode !== this.el.sceneEl)
            throw new Error('ar-root must be a direct child of a-scene');
    },

}));

AFRAME.registerPrimitive('ar-root', {
    defaultComponents: {
        'ar-root': {}
    },
    mappings: {
        'reference-image': 'ar-root.referenceImage'
    }
});

/* ========================================================================= */

/**
 * AR Sources
 */
AFRAME.registerComponent('ar-sources', ARComponent({

    validate()
    {
        if(this.el.parentNode !== this.el.sceneEl)
            throw new Error('ar-sources must be a direct child of a-scene');
    },

    sources()
    {
        const sources = [];

        for(const child of this.el.children) {
            if(child.components !== undefined) {
                for(const name in child.components) {
                    const component = child.components[name];
                    if(component.ar === this.ar && typeof component.source == 'function')
                        sources.push(component.source());
                }
            }
        }

        return sources;
    },

}));

AFRAME.registerPrimitive('ar-sources', {
    defaultComponents: {
        'ar-sources': {}
    }
});

/**
 * AR Camera Source
 */
AFRAME.registerComponent('ar-camera-source', ARComponent({

    schema: {

        /** video resolution: "xs" | "xs+" | "sm" | "sm+" | "md" | "md+" | "lg" | "lg+" */
        'resolution': { type: 'string', default: 'md' },

        /** facing mode: "environment" | "user" */
        'facingMode': { type: 'string', default: 'environment' },

    },

    validate()
    {
        if(!this.el.parentNode.getAttribute('ar-sources'))
            throw new Error('ar-camera-source must be a direct child of ar-sources');
    },

    source()
    {
        return AR.Source.Camera({
            resolution: this.data.resolution,
            constraints: {
                facingMode: this.data.facingMode
            }
        });
    },

}));

AFRAME.registerPrimitive('ar-camera-source', {
    defaultComponents: {
        'ar-camera-source': {}
    },
    mappings: {
        'resolution': 'ar-camera-source.resolution',
        'facing-mode': 'ar-camera-source.facingMode',
    }
});

/**
 * AR Video Source
 */
AFRAME.registerComponent('ar-video-source', ARComponent({

    schema: {

        /** selector for a <video> element */
        'video': { type: 'selector' },

    },

    validate()
    {
        if(!this.el.parentNode.getAttribute('ar-sources'))
            throw new Error('ar-video-source must be a direct child of ar-sources');
    },

    source()
    {
        return AR.Source.Video(this.data.video);
    },

}));

AFRAME.registerPrimitive('ar-video-source', {
    defaultComponents: {
        'ar-video-source': {}
    },
    mappings: {
        'video': 'ar-video-source.video'
    }
});

/**
 * AR Canvas Source
 */
AFRAME.registerComponent('ar-canvas-source', ARComponent({

    schema: {

        /** selector for a <canvas> element */
        'canvas': { type: 'selector' },

    },

    validate()
    {
        if(!this.el.parentNode.getAttribute('ar-sources'))
            throw new Error('ar-canvas-source must be a direct child of ar-sources');
    },

    source()
    {
        return AR.Source.Canvas(this.data.canvas);
    },

}));

AFRAME.registerPrimitive('ar-canvas-source', {
    defaultComponents: {
        'ar-canvas-source': {}
    },
    mappings: {
        'canvas': 'ar-canvas-source.canvas'
    }
});

/* ========================================================================= */

/**
 * AR Trackers
 */
AFRAME.registerComponent('ar-trackers', ARComponent({

    validate()
    {
        if(this.el.parentNode !== this.el.sceneEl)
            throw new Error('ar-trackers must be a direct child of a-scene');
    },

    /* async */ trackers()
    {
        const trackers = [];

        for(const child of this.el.children) {
            if(child.components !== undefined) {
                for(const name in child.components) {
                    const component = child.components[name];
                    if(component.ar === this.ar && typeof component.tracker == 'function')
                        trackers.push(component.tracker());
                }
            }
        }

        return Speedy.Promise.all(trackers);
    },

}));

AFRAME.registerPrimitive('ar-trackers', {
    defaultComponents: {
        'ar-trackers': {}
    }
});

/**
 * AR Image Tracker
 */
AFRAME.registerComponent('ar-image-tracker', ARComponent({

    schema: {

        /** resolution of the tracker: "xs" | "xs+" | "sm" | "sm+" | "md" | "md+" | "lg" | "lg+" */
        'resolution': { type: 'string', default: 'sm+' },

    },

    validate()
    {
        if(!this.el.parentNode.getAttribute('ar-trackers'))
            throw new Error('ar-image-tracker must be a direct child of ar-trackers');
    },

    /* async */ tracker()
    {
        const tracker = AR.Tracker.ImageTracker();
        const referenceImages = [];

        tracker.resolution = this.data.resolution;

        for(const child of this.el.children) {
            if(child.components !== undefined) {
                for(const name in child.components) {
                    const component = child.components[name];
                    if(component.ar === this.ar && typeof component.referenceImage == 'function')
                        referenceImages.push(component.referenceImage());
                }
            }
        }

        return tracker.database.add(referenceImages).then(() => tracker);
    },

}));

AFRAME.registerPrimitive('ar-image-tracker', {
    defaultComponents: {
        'ar-image-tracker': {}
    }
});

/**
 * AR Reference Image
 */
AFRAME.registerComponent('ar-reference-image', ARComponent({

    schema: {

        /** the name of the reference image */
        'name': { type: 'string', default: '' },

        /** URL of an image */
        'src': { type: 'string', default: '' }

    },

    validate()
    {
        if(!this.el.parentNode.getAttribute('ar-image-tracker'))
            throw new Error('ar-reference-image must be a direct child of ar-image-tracker');
    },

    referenceImage()
    {
        if(this.data.src == '')
            throw new Error('Unspecified src attribute of ar-reference-image');

        const img = new Image();
        img.src = this.data.src;

        return {
            name: this.data.name != '' ? this.data.name : undefined,
            image: img
        };
    }

}));

AFRAME.registerPrimitive('ar-reference-image', {
    defaultComponents: {
        'ar-reference-image': {}
    },
    mappings: {
        'name': 'ar-reference-image.name',
        'src': 'ar-reference-image.src'
    }
});

/* ========================================================================= */

/**
 * AR Viewport
 */
AFRAME.registerComponent('ar-viewport', ARComponent({

    schema: {

        /** viewport resolution: "xs" | "xs+" | "sm" | "sm+" | "md" | "md+" | "lg" | "lg+" */
        'resolution': { type: 'string', default: 'lg' },

        /** viewport style: "best-fit" | "stretch" | "inline" */
        'style': { type: 'string', default: 'best-fit' },

    },

    validate()
    {
        if(this.el.parentNode !== this.el.sceneEl)
            throw new Error('ar-viewport must be a direct child of a-scene');
    },

    viewport()
    {
        const scene = this.el.sceneEl;
        const huds = [];

        for(const child of this.el.children) {
            if(child.components !== undefined) {
                for(const name in child.components) {
                    const component = child.components[name];
                    if(component.ar === this.ar && typeof component.hudContainer == 'function')
                        huds.push(component.hudContainer());
                }
            }
        }

        if(huds.length > 1)
            throw new Error('Can\'t define multiple ar-hud\'s in an ar-viewport');
        else if(huds.length == 0)
            huds.push(undefined);

        return AR.Viewport({
            container: this.el,
            hudContainer: huds[0],
            canvas: scene.canvas,
            resolution: this.data.resolution,
            style: this.data.style
        });
    },

}));

AFRAME.registerPrimitive('ar-viewport', {
    defaultComponents: {
        'ar-viewport': {}
    },
    mappings: {
        'resolution': 'ar-viewport.resolution',
        'style': 'ar-viewport.style'
    }
});

/**
 * AR Heads-Up Display
 */
let hudStyle = (function() { // hide on page load
    const style = document.createElement('style');
    style.textContent = 'ar-hud, [ar-hud] { display: none; }';
    document.head.appendChild(style);
    return style;
})();

AFRAME.registerComponent('ar-hud', ARComponent({

    init()
    {
        if(hudStyle !== null) {
            document.head.removeChild(hudStyle);
            hudStyle = null;
        }

        this.el.hidden = true;
    },

    validate()
    {
        if(!this.el.parentNode.getAttribute('ar-viewport'))
            throw new Error('ar-hud must be a direct child of ar-viewport');
    },

    hudContainer()
    {
        return this.el;
    },

}));

AFRAME.registerPrimitive('ar-hud', {
    defaultComponents: {
        'ar-hud': {}
    }
});

/* ========================================================================= */

/**
 * Version check
 * @param {object} libs
 */
function __THIS_PLUGIN_HAS_BEEN_TESTED_WITH__(libs)
{
    window.addEventListener('load', () => {
        try { AR, AFRAME;
            const versionOf = { 'encantar.js': AR.version.replace(/-.*$/, ''), 'A-Frame': AFRAME.version };
            const check = (x,v,w) => v != w ? console.warn(`\n\n\nWARNING\n\nThis plugin has been tested with ${x} version ${v}. The version in use is ${w}. Usage of ${x} version ${v} is recommended instead.\n\n\n`) : void 0;
            for(const [lib, expected] of Object.entries(libs))
                check(lib, expected.version, versionOf[lib]);
        }
        catch(e) {
            alert(e.message);
        }
    });
}

})();
