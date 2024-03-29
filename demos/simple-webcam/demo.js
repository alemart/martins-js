/**
 * @file MARTINS.js WebAR: Simple Webcam demo
 * @version 1.0.2
 * @author Alexandre Martins (https://github.com/alemart)
 * @license AGPL-3.0
 */

window.addEventListener('load', async function() {
    try {
        const session = await startARSession();

        function animate(time, frame)
        {
            session.requestAnimationFrame(animate);
        }

        session.requestAnimationFrame(animate);
    }
    catch(error) {
        alert(error.message);
    }

    async function startARSession()
    {
        if(!Martins.isSupported()) {
            throw new Error(
                'Use a browser/device compatible with WebGL2 and WebAssembly. ' +
                'Your user agent is ' + navigator.userAgent
            );
        }

        //Martins.Settings.powerPreference = 'low-power';

        const tracker = Martins.Tracker.ImageTracker();
        await tracker.database.add([{
            name: 'my-reference-image',
            image: document.getElementById('my-reference-image')
        }]);

        const viewport = Martins.Viewport({
            container: document.getElementById('ar-viewport'),
            hudContainer: document.getElementById('ar-hud')
        });

        const source = Martins.Source.Camera({
            resolution: 'md'
        });

        const session = await Martins.startSession({
            mode: 'immersive',
            viewport: viewport,
            trackers: [ tracker ],
            sources: [ source ],
            stats: true,
            gizmos: true,
        });

        const scan = document.getElementById('scan');

        tracker.addEventListener('targetfound', event => {
            if(scan)
                scan.hidden = true;
        });

        tracker.addEventListener('targetlost', event => {
            if(scan)
                scan.hidden = false;
        });

        return session;
    }
});