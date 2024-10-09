/**
 * Augmented Reality demo using the three.js plugin for encantar.js
 * @author Alexandre Martins <alemartf(at)gmail.com> (https://github.com/alemart/encantar-js)
 */

(function() {

// Validate
if(typeof encantar === 'undefined')
    throw new Error(`Can't find the three.js plugin for encantar.js`);



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

    createAnimationAction(gltf, name = null, loop = THREE.LoopRepeat)
    {
        const mixer = new THREE.AnimationMixer(gltf.scene);
        const clips = gltf.animations;

        if(clips.length == 0)
            throw new Error('No animation clips');

        if(name === null) {
            const sortedNames = clips.map(clip => clip.name).sort();
            name = sortedNames[0];
        }

        const clip = THREE.AnimationClip.findByName(clips, name);
        const action = mixer.clipAction(clip);
        action.loop = loop;

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

    switchToFrontView(ar)
    {
        // top view is the default
        ar.root.rotation.set(-Math.PI / 2, 0, 0);
    }

    referenceImageName(ar)
    {
        if(ar.frame === null)
            return null;

        for(const result of ar.frame.results) {
            if(result.tracker.type == 'image-tracker') {
                if(result.trackables.length > 0) {
                    const trackable = result.trackables[0];
                    return trackable.referenceImage.name;
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

        const tracker = AR.Tracker.ImageTracker();
        await tracker.database.add([
        {
            name: 'mage',
            image: document.getElementById('mage')
        },
        {
            name: 'cat',
            image: document.getElementById('cat')
        }
        ]);

        const viewport = AR.Viewport({
            container: document.getElementById('ar-viewport'),
            hudContainer: document.getElementById('ar-hud')
        });

        const video = document.getElementById('my-video');
        const useWebcam = (video === null);
        const source = useWebcam ? AR.Source.Camera() : AR.Source.Video(video);

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

            this._onTargetFound(event.referenceImage);
        });

        tracker.addEventListener('targetlost', event => {
            session.gizmos.visible = true;
            if(scan)
                scan.hidden = false;

            this._onTargetLost(event.referenceImage);
        });

        return session;
    }

    /**
     * Initialize the augmented scene
     * @param {ARSystem} ar
     * @returns {Promise<void>}
     */
    async init(ar)
    {
        // Change the point of view. All virtual objects are descendants of
        // ar.root, a node that is automatically aligned to the physical scene.
        // Adjusting ar.root will adjust all virtual objects.
        this._utils.switchToFrontView(ar);
        ar.root.position.set(0, -0.5, 0);

        // initialize objects
        this._initLight(ar);
        this._initText(ar);
        this._initMagicCircle(ar);

        await Promise.all([
            this._initMage(ar),
            this._initCat(ar),
        ]);
    }

    /**
     * Update / animate the augmented scene
     * @param {ARSystem} ar
     * @returns {void}
     */
    update(ar)
    {
        const delta = ar.session.time.delta; // given in seconds

        // animate the objects of the scene
        this._animateMagicCircle(delta);
        this._animateMage(delta);
        this._animateCat(delta);
    }


    // ------------------------------------------------------------------------


    _initLight(ar)
    {
        const ambientLight = new THREE.AmbientLight(0xffffff);
        ambientLight.intensity = 1.5;

        ar.scene.add(ambientLight);
    }

    _initMagicCircle(ar)
    {
        // load the object
        const magicCircle = this._utils.createImagePlane('../assets/magic-circle.png');
        magicCircle.material.transparent = true;
        magicCircle.material.opacity = 1;
        magicCircle.scale.set(4, 4, 1);

        // add the object to the scene
        ar.root.add(magicCircle);

        // save a reference
        this._objects.magicCircle = magicCircle;
    }

    _initText(ar)
    {
        const text = this._utils.createImagePlane('../assets/it-works.png');
        text.material.transparent = true;
        text.material.opacity = 1;
        text.position.set(0, -0.5, 2);
        text.scale.set(3, 1.5, 1);
        text.rotateX(Math.PI / 2);

        ar.root.add(text);

        this._objects.text = text;
    }

    async _initMage(ar)
    {
        // load the mage
        const gltf = await this._utils.loadGLTF('../assets/mage.glb');
        const mage = gltf.scene;
        mage.scale.set(0.7, 0.7, 0.7);

        // prepare the animation of the mage
        const mageAction = this._utils.createAnimationAction(gltf, 'Idle');
        mageAction.play();

        // add the mage to the scene
        ar.root.add(mage);

        // save references
        this._objects.mage = mage;
        this._objects.mageAction = mageAction;
    }

    async _initCat(ar)
    {
        const gltf = await this._utils.loadGLTF('../assets/cat.glb');
        const cat = gltf.scene;
        cat.scale.set(0.7, 0.7, 0.7);

        const catAction = this._utils.createAnimationAction(gltf, 'Cheer');
        catAction.play();

        ar.root.add(cat);

        this._objects.cat = cat;
        this._objects.catAction = catAction;
    }

    _animate(action, delta)
    {
        const mixer = action.getMixer();
        mixer.update(delta);
    }

    _animateMage(delta)
    {
        this._animate(this._objects.mageAction, delta);
    }

    _animateCat(delta)
    {
        this._animate(this._objects.catAction, delta);
    }

    _animateMagicCircle(delta)
    {
        const TWO_PI = 2.0 * Math.PI;
        const ROTATIONS_PER_SECOND = 1.0 / 8.0;

        this._objects.magicCircle.rotateZ(-TWO_PI * ROTATIONS_PER_SECOND * delta);
    }

    _onTargetFound(referenceImage)
    {
        // change the scene based on the scanned image
        switch(referenceImage.name) {
            case 'mage':
                this._objects.mage.visible = true;
                this._objects.cat.visible = false;
                this._objects.text.visible = false;
                this._objects.magicCircle.material.color.set(0xbeefff);
                break;

            case 'cat':
                this._objects.mage.visible = false;
                this._objects.cat.visible = true;
                this._objects.text.visible = true;
                this._objects.magicCircle.material.color.set(0xffffaa);
                break;
        }
    }

    _onTargetLost(referenceImage)
    {
    }
}



/**
 * Enchant the scene
 * @returns {void}
 */
function main()
{
    const scene = new DemoScene();

    encantar(scene).catch(error => {
        alert(error.message);
    });
}

document.addEventListener('DOMContentLoaded', main);

})();
