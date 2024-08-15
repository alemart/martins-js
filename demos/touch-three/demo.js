window.addEventListener('load', () => {

    const my = { };

    async function initialize(ar)
    {
        // add lights
        const ambientLight = new THREE.AmbientLight(0x808080);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
        directionalLight.position.set(0, 0, -1);
        ar.scene.add(ambientLight);
        ar.scene.add(directionalLight);

        // create cubes
        my.cubes = [
            createCube(ar, 1.0, -0.5, 0x00ff00),
            createCube(ar, -1.0, -0.5, 0xffff00),
            createCube(ar, 0.0, -0.5, 0x0077ff),
        ];

        // create text
        my.text = await createText(ar, 'Tap on any cube', 0x88ffee);
        my.text.position.set(-1.5, 0.25, 0.5);

        // setup interactivity
        my.pointer = createPointer(ar);
        my.raycaster = new THREE.Raycaster();
    }

    function createCube(ar, x, y, color, length = 0.7)
    {
        const geometry = new THREE.BoxGeometry(length, length, length);
        const material = new THREE.MeshPhongMaterial({ color });
        const cube = new THREE.Mesh(geometry, material);

        cube.position.x = x;
        cube.position.y = y;
        cube.position.z = length / 2;
        cube.userData.color = color;

        material.opacity = 1.0;
        material.transparent = true;

        ar.root.add(cube);
        return cube;
    }

    async function createText(ar, text, color = 0xffffff)
    {
        const loader = new THREE.FontLoader();
        const fontURL = '../assets/helvetiker_bold.typeface.json';
        const font = await loader.loadAsync(fontURL);

        const material = new THREE.MeshPhongMaterial({ color });
        const geometry = new THREE.TextGeometry(text, {
            font: font,
            size: 0.3,
            height: 0.05,
        });
        const mesh = new THREE.Mesh(geometry, material);

        ar.root.add(mesh);
        return mesh;
    }

    function createPointer(ar)
    {
        const pointer = {
            position: new THREE.Vector2(),
            down: false,

            get active()
            {
                return this.down && Math.max(Math.abs(this.position.x), Math.abs(this.position.y)) <= 1.0;
            }
        };

        function updatePosition(event)
        {
            const canvas = ar.renderer.domElement;
            const rect = canvas.getBoundingClientRect();
            const x = event.pageX - (rect.left + window.scrollX);
            const y = event.pageY - (rect.top + window.scrollY);

            // normalize to [-1,1] x [-1,1]
            pointer.position.x = 2.0 * x / rect.width - 1.0;
            pointer.position.y = -2.0 * y / rect.height + 1.0;
        }

        // setup pointer interactivity
        window.addEventListener('pointermove', event => {
            updatePosition(event);
        });
        window.addEventListener('pointerdown', event => {
            updatePosition(event);
            pointer.down = true;
        });
        window.addEventListener('pointerup', event => {
            pointer.down = false;
        });

        // done!
        return pointer;
    }

    function animate(ar)
    {
        // reset all cubes
        for(let i = 0; i < my.cubes.length; i++) {
            my.cubes[i].material.color.setHex(my.cubes[i].userData.color);
            my.cubes[i].scale.z = 1.0;
        }

        // interact with objects via raycasting
        if(my.pointer.active) {
            my.raycaster.setFromCamera(my.pointer.position, ar.camera);

            const intersections = my.raycaster.intersectObjects(my.cubes);
            for(let i = 0; i < intersections.length; i++) {

                // create the appearance of a pushed button
                const object = intersections[i].object;
                object.material.color.setHex(0xff3333);
                object.scale.z = 0.2;

            }
        }
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
