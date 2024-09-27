/**
 * Augmented Reality demo with three.js and encantar.js
 */

(function() {

/**
 * Utilities for the Demo scene
 */
class DemoUtils
{
    async loadGLTF(filepath, yAxisIsUp = true)
    {
        const loader = new THREE.GLTFLoader();
        const gltf = await loader.loadAsync(filepath);

        // glTF defines +y as up. We expect +z to be up.
        if(yAxisIsUp)
            gltf.scene.rotateX(Math.PI / 2);

        return gltf;
    }

    switchToFrontView(root)
    {
        // top view is the default
        root.rotateX(-Math.PI / 2);
    }

    createAnimationAction(gltf, name = null)
    {
        const mixer = new THREE.AnimationMixer(gltf.scene);
        const clips = gltf.animations;

        if(clips.length == 0)
            throw new Error('No animation clips');

        const clip = (name !== null) ? THREE.AnimationClip.findByName(clips, name) : clips[0];
        const action = mixer.clipAction(clip);

        return action;
    }

    createImagePlane(imagepath)
    {
        const texture = new THREE.TextureLoader().load(imagepath);
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);

        return mesh;
    }

    referenceImage(ar)
    {
        if(ar.frame === null)
            return null;

        for(const result of ar.frame.results) {
            if(result.tracker.type == 'image-tracker') {
                if(result.trackables.length > 0) {
                    const trackable = result.trackables[0];
                    return trackable.referenceImage;
                }
            }
        }

        return null;
    }
}



/**
 * Demo scene
 */
class DemoScene extends ARScene
{
    /**
     * Constructor
     */
    constructor()
    {
        super();

        this._utils = new DemoUtils();
        this._objects = { };
    }

    /**
     * Start the AR session
     * @returns {Promise<Session>}
     */
    async startSession()
    {
        if(!AR.isSupported()) {
            throw new Error(
                'This device is not compatible with this AR experience.\n\n' +
                'User agent: ' + navigator.userAgent
            );
        }

        //AR.Settings.powerPreference = 'low-power';

        const tracker = AR.Tracker.ImageTracker();
        await tracker.database.add([{
            name: 'my-reference-image',
            image: document.getElementById('my-reference-image')
        }]);

        const viewport = AR.Viewport({
            container: document.getElementById('ar-viewport'),
            hudContainer: document.getElementById('ar-hud')
        });

        const video = document.getElementById('my-video');
        const useWebcam = (video === null);
        const source = useWebcam ?
            AR.Source.Camera({ resolution: 'md' }) :
            AR.Source.Video(video);

        const session = await AR.startSession({
            mode: 'immersive',
            viewport: viewport,
            trackers: [ tracker ],
            sources: [ source ],
            stats: true,
            gizmos: true,
        });

        const scan = document.getElementById('scan');

        tracker.addEventListener('targetfound', event => {
            session.gizmos.visible = false;
            if(scan)
                scan.hidden = true;
        });

        tracker.addEventListener('targetlost', event => {
            session.gizmos.visible = true;
            if(scan)
                scan.hidden = false;
        });

        return session;
    }

    /**
     * Initialize the augmented scene
     * @param {ARPluginSystem} ar
     * @returns {Promise<void>}
     */
    async init(ar)
    {
        // Change the point of view. All virtual objects are descendants of
        // ar.root, a node that is automatically aligned to the physical scene.
        // Adjusting ar.root will adjust all virtual objects.
        this._utils.switchToFrontView(ar.root);
        ar.root.position.set(0, -0.5, 0);
        ar.root.scale.set(0.7, 0.7, 0.7);

        // add lights
        const ambientLight = new THREE.AmbientLight(0xffffff);
        ar.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(0, 0, 3);
        ar.root.add(directionalLight);

        // create the magic circle
        const magicCircle = this._utils.createImagePlane('../assets/magic-circle.png');
        magicCircle.material.transparent = true;
        magicCircle.material.opacity = 0.85;
        magicCircle.material.color = new THREE.Color(0xbeefff);
        magicCircle.scale.set(6, 6, 1);
        ar.root.add(magicCircle);

        // load the mage
        const gltf = await this._utils.loadGLTF('../assets/mage.glb');
        const mage = gltf.scene;
        ar.root.add(mage);

        // prepare the animation of the mage
        const animationAction = this._utils.createAnimationAction(gltf, 'Idle');
        animationAction.loop = THREE.LoopRepeat;
        animationAction.play();

        // save objects
        this._objects.mage = mage;
        this._objects.magicCircle = magicCircle;
        this._objects.animationAction = animationAction;
    }

    /**
     * Update / animate the augmented scene
     * @param {ARPluginSystem} ar
     * @returns {void}
     */
    update(ar)
    {
        const TWO_PI = 2.0 * Math.PI;
        const ROTATIONS_PER_SECOND = 0.25;
        const delta = ar.session.time.delta; // given in seconds

        // animate the mage
        const animationAction = this._objects.animationAction;
        const mixer = animationAction.getMixer();
        mixer.update(delta);

        // animate the magic circle
        const magicCircle = this._objects.magicCircle;
        magicCircle.rotateZ(TWO_PI * ROTATIONS_PER_SECOND * delta);
    }

    /**
     * Release the augmented scene
     * @param {ARPluginSystem} ar
     * @returns {void}
     */
    release(ar)
    {
        // nothing to do
    }
}



/**
 * Enchant the Demo scene
 */
window.addEventListener('load', () => {

    const scene = new DemoScene();

    encantar(scene);

});

})();
