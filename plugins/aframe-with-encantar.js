/**
 * @file aframe plugin for encantar.js
 * @author Alexandre Martins (https://github.com/alemart)
 * @license LGPL-3.0-or-later
 */

/* Usage of the indicated versions is encouraged */
__THIS_PLUGIN_HAS_BEEN_TESTED_WITH__({
    'encantar.js': { version: '0.3.0' },
         'aframe': { version: '1.4.2' }
});

/**
 * Do magic to connect encantar.js to aframe
 * @param {(canvas: HTMLCanvasElement) => Promise<Session> | SpeedyPromise<Session>} startARSession
 */
function encantar(startARSession)
{
    AFRAME.registerSystem('ar-system', {
        init()
        {
            this.state = {
                isTracking: false,
                frame: null,
                referenceImage: null,
                projectionMatrix: null,
                viewMatrixInverse: null,
                modelMatrix: null,
            };
            this.session = null;

            return startARSession(this.el.canvas).then(session => {

                this.session = session;

                session.addEventListener('end', event => {
                    this.state.isTracking = false;
                });
                session.viewport.addEventListener('resize', event => {
                    this.updateRenderer(session.viewport.virtualSize);
                });

                if(session.viewport.canvas !== this.el.canvas) {
                    session.end();
                    throw new Error('Invalid AFRAME <canvas>');
                }

                const animate = (time, frame) => {
                    this.updateState(frame);
                    this.renderVirtualScene();
                    session.requestAnimationFrame(animate);
                };
                session.requestAnimationFrame(animate);

            }).catch(error => {

                console.error(error);
                alert(error.message);

            });
        },

        updateState(frame)
        {
            const wasTracking = this.state.isTracking;

            this.state.frame = frame;
            this.state.isTracking = false;
            this.state.referenceImage = null;

            for(const result of frame.results) {
                if(result.tracker.type == 'image-tracker') {
                    if(result.trackables.length > 0) {
                        const trackable = result.trackables[0];
                        this.state.projectionMatrix = result.viewer.view.projectionMatrix;
                        this.state.viewMatrixInverse = result.viewer.pose.transform.matrix;
                        this.state.modelMatrix = trackable.pose.transform.matrix;
                        this.state.referenceImage = trackable.referenceImage;
                        this.state.isTracking = true;
                    }
                }
            }

            if(this.state.isTracking && !wasTracking)
                this.updateRenderer(frame.session.viewport.virtualSize);
        },

        updateRenderer(size)
        {
            const renderer = this.el.renderer;
            const resize = () => {
                renderer.setPixelRatio(1.0);
                renderer.setSize(size.width, size.height, false);
            };

            resize();
            setTimeout(resize, 200); // internals of AFRAME (a-scene.js)
        },

        renderVirtualScene()
        {
            const scene = this.el;
            if(!scene.camera || !scene.object3D)
                return;

            scene.delta = scene.clock.getDelta() * 1000;
            scene.time = scene.clock.elapsedTime * 1000;
            if(scene.isPlaying)
                scene.tick(scene.time, scene.delta);

            scene.object3D.background = null;
            scene.renderer.render(scene.object3D, scene.camera);
            scene.renderer.setAnimationLoop(null);
        },
    });

    AFRAME.registerComponent('ar-root', {
        schema: {
            'image-target': { type: 'string', default: '' },
        },

        init()
        {
            this.arSystem = this.el.sceneEl.systems['ar-system'];

            this.el.object3D.matrixAutoUpdate = false;
            this.el.object3D.visible = false;
        },

        remove()
        {
            const session = this.arSystem.session;
            session.end();
        },

        tick()
        {
            const ANY = '', target = this.data['image-target'];
            const state = this.arSystem.state;

            if(state.isTracking && (target === ANY || target === state.referenceImage.name)) {
                this.alignVirtualScene(state.modelMatrix);
                this.el.object3D.visible = true;
            }
            else
                this.el.object3D.visible = false;
        },

        alignVirtualScene(modelMatrix)
        {
            const arRoot = this.el.object3D;

            arRoot.matrix.fromArray(modelMatrix.read());
            arRoot.updateMatrixWorld(true);
        }
    });

    AFRAME.registerPrimitive('ar-root', AFRAME.utils.extendDeep({}, AFRAME.primitives.getMeshMixin(), {
        defaultComponents: {
            'ar-root': {}
        },
        mappings: {
            'image-target': 'ar-root.image-target'
        }
    }));

    AFRAME.registerComponent('ar-camera', {
        init()
        {
            this.arSystem = this.el.sceneEl.systems['ar-system'];
            this.arCamera = this.el.getObject3D('camera');

            this.arCamera.matrixAutoUpdate = false;

            this.el.setAttribute('camera', { active: true });
            this.el.setAttribute('wasd-controls', { enabled: false });
            this.el.setAttribute('look-controls', { enabled: false });
            this.el.setAttribute('position', { x: 0, y: 0, z: 0 }); // AFRAME sets y = 1.6m for VR
        },

        tick()
        {
            const state = this.arSystem.state;

            if(state.isTracking)
                this.updateCamera(state.projectionMatrix, state.viewMatrixInverse);
        },

        updateCamera(projectionMatrix, viewMatrixInverse)
        {
            const arCamera = this.arCamera;

            arCamera.projectionMatrix.fromArray(projectionMatrix.read());
            arCamera.projectionMatrixInverse.copy(arCamera.projectionMatrix).invert();
            arCamera.matrix.fromArray(viewMatrixInverse.read());
            arCamera.updateMatrixWorld(true);
        }
    });

    /*
    // AFRAME won't catch this in setupInitialCamera()
    AFRAME.registerPrimitive('ar-camera', AFRAME.utils.extendDeep({}, AFRAME.primitives.getMeshMixin(), {
        defaultComponents: {
            'ar-camera': {}
        }
    }));
    */

    AFRAME.registerComponent('ar-scene', {
        init()
        {
            this.el.setAttribute('vr-mode-ui', { enabled: false });
            this.el.setAttribute('embedded', true);
            this.el.setAttribute('renderer', { alpha: true });
        }
    });
};

// Start automatically
if(typeof startARSession === 'function')
    encantar(startARSession);

/**
 * Version check
 * @param {object} json
 */
function __THIS_PLUGIN_HAS_BEEN_TESTED_WITH__(json)
{
    try { AR, AFRAME;
        const versionOf = { 'encantar.js': AR.version.replace(/-.*$/, ''), 'aframe': AFRAME.version };
        const check = (x,v,w) => v !== w ? console.warn(`\n\n\nWARNING\n\nThis plugin has been tested with ${x} version ${v}. The version in use is ${w}. Usage of ${x} version ${v} is recommended instead.\n\n\n`) : void 0;
        for(const [x, expected] of Object.entries(json))
            check(x, expected.version, versionOf[x]);
    }
    catch(e) {
        alert(e.message);
    }
}