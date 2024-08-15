window.addEventListener('load', () => {

    const my = { };

    async function initialize(ar)
    {
        // add lights
        const ambientLight = new THREE.AmbientLight(0xb7b7b7);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(0, 0, -1);
        directionalLight.target.position.set(0, 0, 0);
        ar.scene.add(directionalLight);
        ar.scene.add(ambientLight);

        // create a group of objects as a child of ar.root
        const group = createGroup('in-front');
        //const group = createGroup('on-top'); // try this option!
        ar.root.add(group);

        // create cubes
        const cubeA = createCube(-0.75, 0, 0xffff00);
        const cubeB = createCube(0.75, 0, 0x00ff00);
        group.add(cubeA, cubeB);

        // create the ground
        const ground = createGround(0x3d5afe);
        group.add(ground);

        // load a 3D model
        const modelURL = '../assets/my-3d-model.glb';
        const model = await loadModel(modelURL);
        group.add(model);

        // export objects
        my.cubes = [ cubeA, cubeB ];
        my.group = group;
        my.model = model;
        my.ground = ground;
    }

    function animate(ar)
    {
        const ROTATION_CYCLES_PER_SECOND = 1.0;
        const TWO_PI = 2.0 * Math.PI;
        const delta = ar.session.time.delta;

        // rotate the cubes
        for(const cube of my.cubes)
            cube.rotateY(TWO_PI * ROTATION_CYCLES_PER_SECOND * delta);
    }

    function createGroup(mode = 'in-front')
    {
        const group = new THREE.Group();

        if(mode == 'in-front') {
            group.rotation.set(-Math.PI/2, 0, 0);
            group.position.set(0, -0.5, 0.5);
        }
        else if(mode == 'on-top') {
            group.rotation.set(0, 0, 0);
            group.position.set(0, 0, 0);
        }

        return group;
    }

    function createCube(x, y, color, length = 0.25)
    {
        const geometry = new THREE.BoxGeometry(length, length, length);
        const material = new THREE.MeshPhongMaterial({ color });
        const cube = new THREE.Mesh(geometry, material);

        cube.position.set(x, y, 1.25);

        return cube;
    }

    function createGround(color)
    {
        const geometry = new THREE.RingGeometry(0.001, 1, 8);
        const material = new THREE.MeshPhongMaterial({ color: color, side: THREE.DoubleSide });
        const ground = new THREE.Mesh(geometry, material);

        material.transparent = true;
        material.opacity = 0.75;

        return ground;
    }

    async function loadModel(filepath)
    {
        const loader = new THREE.GLTFLoader();
        const gltf = await loader.loadAsync(filepath);
        const model = gltf.scene;

        return model;
    }

    async function startARSession()
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

    // enchant!
    encantar(startARSession, animate, initialize);

});
