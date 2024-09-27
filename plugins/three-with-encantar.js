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
 * Base class for augmented scenes
 */
class ARScene
{
    /**
     * Start the AR session
     * @abstract
     * @returns {Promise<Session> | SpeedyPromise<Session>}
     */
    startSession()
    {
        throw new Error('Abstract method');
    }

    /**
     * Initialize the augmented scene
     * @abstract
     * @param {ARPluginSystem} ar
     * @returns {void | Promise<void> | SpeedyPromise<void>}
     */
    init(ar)
    {
        throw new Error('Abstract method');
    }

    /**
     * Update / animate the augmented scene
     * @abstract
     * @param {ARPluginSystem} ar
     * @returns {void}
     */
    update(ar)
    {
        throw new Error('Abstract method');
    }

    /**
     * Release the augmented scene
     * @param {ARPluginSystem} ar
     * @returns {void}
     */
    release(ar)
    {
        // optional implementation
    }
}

/**
 * Helper for augmenting the scenes with three.js
 */
class ARPluginSystem
{
    /**
     * AR Session
     * @returns {Session}
     */
    get session()
    {
        return this._session;
    }

    /**
     * Current frame: an object holding data to augment the physical scene.
     * If the AR scene is not initialized, this will be null.
     * @returns {Frame | null}
     */
    get frame()
    {
        return this._frame;
    }

    /**
     * The root is a 3D object that is automatically aligned to the physical
     * scene. Objects of your virtual scene should be descendants of this node.
     * The root is only visible if something is being tracked.
     * @returns {THREE.Group}
     */
    get root()
    {
        return this._root;
    }

    /**
     * The three.js scene
     * @returns {THREE.Scene}
     */
    get scene()
    {
        return this._scene;
    }

    /**
     * A camera that is automatically adjusted for AR
     * @returns {THREE.Camera}
     */
    get camera()
    {
        return this._camera;
    }

    /**
     * The three.js renderer
     * @returns {THREE.WebGLRenderer}
     */
    get renderer()
    {
        return this._renderer;
    }

    /**
     * Constructor
     */
    constructor()
    {
        this._session = null;
        this._frame = null;
        this._origin = null;
        this._root = null;
        this._scene = null;
        this._camera = null;
        this._renderer = null;
    }
}

/**
 * Do magic to connect encantar.js to three.js
 * @param {ARScene} scene
 * @returns {Promise<ARPluginSystem> | SpeedyPromise<ARPluginSystem>}
 */
function encantar(scene)
{
    const ar = new ARPluginSystem();

    function mix(frame)
    {
        ar._root.visible = false;

        for(const result of frame.results) {
            if(result.tracker.type == 'image-tracker') {
                if(result.trackables.length > 0) {
                    const trackable = result.trackables[0];
                    const projectionMatrix = result.viewer.view.projectionMatrix;
                    const viewMatrixInverse = result.viewer.pose.transform.matrix;
                    const modelMatrix = trackable.pose.transform.matrix;

                    align(projectionMatrix, viewMatrixInverse, modelMatrix);
                    ar._root.visible = true;

                    return;
                }
            }
        }
    }

    function align(projectionMatrix, viewMatrixInverse, modelMatrix)
    {
        ar._camera.projectionMatrix.fromArray(projectionMatrix.read());
        ar._camera.projectionMatrixInverse.copy(ar._camera.projectionMatrix).invert();
        ar._camera.matrix.fromArray(viewMatrixInverse.read());
        ar._camera.updateMatrixWorld(true);
        ar._origin.matrix.fromArray(modelMatrix.read());
        ar._origin.updateMatrixWorld(true);
    }

    function animate(time, frame)
    {
        ar._frame = frame;
        mix(frame);

        scene.update(ar);

        ar._renderer.render(ar._scene, ar._camera);
        ar._session.requestAnimationFrame(animate);
    }

    return scene.startSession().then(session => {

        ar._session = session;

        ar._scene = new THREE.Scene();

        ar._origin = new THREE.Group();
        ar._origin.matrixAutoUpdate = false;
        ar._scene.add(ar._origin);

        ar._root = new THREE.Group();
        ar._origin.add(ar._root);

        ar._camera = new THREE.PerspectiveCamera();
        ar._camera.matrixAutoUpdate = false;

        ar._renderer = new THREE.WebGLRenderer({
            canvas: session.viewport.canvas,
            alpha: true,
        });

        session.addEventListener('end', event => {
            ar._root.visible = false;
            scene.release(ar);
            ar._frame = null;
        });

        session.viewport.addEventListener('resize', event => {
            const size = session.viewport.virtualSize;
            ar._renderer.setPixelRatio(1.0);
            ar._renderer.setSize(size.width, size.height, false);
        });

        let init = scene.init(ar);
        if(!(typeof init === 'object' && 'then' in init))
            init = Promise.resolve();

        return init.then(() => {
            ar.session.requestAnimationFrame(animate);
            return ar;
        });

    }).catch(error => {
        
        console.error(error);
        alert(error.message);
        throw error;
   
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
