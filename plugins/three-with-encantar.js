/**
 * @file three.js plugin for encantar.js
 * @author Alexandre Martins (https://github.com/alemart)
 * @license LGPL-3.0-or-later
 */

/* Usage of the indicated versions is encouraged */
__THIS_PLUGIN_HAS_BEEN_TESTED_WITH__({
    'encantar.js': { version: '0.3.0' },
       'three.js': { version: '147' }
});

/**
 * Use this object to create your augmented scene
 * @typedef {object} ARSystem
 * @property {Session} session AR Session
 * @property {Frame} frame current Frame
 * @property {ReferenceImage | null} referenceImage corresponds to the target being tracked (if any)
 * @property {THREE.Scene} scene three.js Scene
 * @property {THREE.Group} root a 3D object that is automatically aligned with the physical target
 * @property {THREE.Camera} camera a camera adjusted for AR
 * @property {THREE.WebGLRenderer} renderer three.js renderer
 */

/**
 * Do magic to connect encantar.js to three.js
 * @param {() => Promise<Session> | SpeedyPromise<Session>} startARSession
 * @param {(ar: ARSystem) => void} [animateVirtualScene] animation callback
 * @param {(ar: ARSystem) => void | Promise<void> | SpeedyPromise<Session>} [initializeVirtualScene] initialization callback
 * @returns {Promise<ARSystem> | SpeedyPromise<ARSystem>}
 */
function encantar(startARSession, animateVirtualScene, initializeVirtualScene)
{
    const ar = /** @type {ARSystem} */ ({
        session: null,
        frame: null,
        referenceImage: null,
        scene: null,
        root: null,
        camera: null,
        renderer: null,
    });

    function mix(frame)
    {
        ar.root.visible = false;
        ar.referenceImage = null;

        for(const result of frame.results) {
            if(result.tracker.type == 'image-tracker') {
                if(result.trackables.length > 0) {
                    const trackable = result.trackables[0];
                    const projectionMatrix = result.viewer.view.projectionMatrix;
                    const viewMatrixInverse = result.viewer.pose.transform.matrix;
                    const modelMatrix = trackable.pose.transform.matrix;

                    ar.root.visible = true;
                    ar.referenceImage = trackable.referenceImage;

                    align(projectionMatrix, viewMatrixInverse, modelMatrix);
                }
            }
        }
    }

    function align(projectionMatrix, viewMatrixInverse, modelMatrix)
    {
        ar.camera.projectionMatrix.fromArray(projectionMatrix.read());
        ar.camera.projectionMatrixInverse.copy(ar.camera.projectionMatrix).invert();
        ar.camera.matrix.fromArray(viewMatrixInverse.read());
        ar.camera.updateMatrixWorld(true);
        ar.root.matrix.fromArray(modelMatrix.read());
        ar.root.updateMatrixWorld(true);
    }

    function animate(time, frame)
    {
        ar.frame = frame;
        mix(ar.frame);

        animateVirtualScene.call(undefined, ar);

        ar.renderer.render(ar.scene, ar.camera);
        ar.session.requestAnimationFrame(animate);
    }




    if(typeof animateVirtualScene !== 'function')
        animateVirtualScene = (ar => void 0);

    if(typeof initializeVirtualScene !== 'function')
        initializeVirtualScene = (ar => void 0);

    return startARSession().then(session => {

        ar.session = session;

        ar.scene = new THREE.Scene();
        ar.camera = new THREE.PerspectiveCamera();
        ar.camera.matrixAutoUpdate = false;

        ar.root = new THREE.Group();
        ar.root.matrixAutoUpdate = false;
        ar.scene.add(ar.root);

        ar.renderer = new THREE.WebGLRenderer({
            canvas: ar.session.viewport.canvas,
            alpha: true,
        });

        ar.session.addEventListener('end', event => {
            ar.root.visible = false;
            ar.frame = null;
            ar.referenceImage = null;
        });

        ar.session.viewport.addEventListener('resize', event => {
            const size = ar.session.viewport.virtualSize;
            ar.renderer.setPixelRatio(1.0);
            ar.renderer.setSize(size.width, size.height, false);
        });

        let init = initializeVirtualScene.call(undefined, ar);
        if(!(typeof init === 'object' && 'then' in init))
            init = Promise.resolve();

        return init.then(() => {
            ar.session.requestAnimationFrame(animate);
            return ar;
        });

    }).catch(error => {
        
        console.error(error);
        alert(error.message);
        return ar;
   
    });
}

/**
 * Version check
 * @param {object} json
 */
function __THIS_PLUGIN_HAS_BEEN_TESTED_WITH__(json)
{
    window.addEventListener('load', () => {
        try { AR, __THREE__;
            const versionOf = { 'encantar.js': AR.version.replace(/-.*$/, ''), 'three.js': __THREE__ };
            const check = (x,v,w) => v !== w ? console.warn(`\n\n\nWARNING\n\nThis plugin has been tested with ${x} version ${v}. The version in use is ${w}. Usage of ${x} version ${v} is recommended instead.\n\n\n`) : void 0;
            for(const [x, expected] of Object.entries(json))
                check(x, expected.version, versionOf[x]);
        }
        catch(e) {
            alert(e.message);
        }
    });
}