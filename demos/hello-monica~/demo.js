/**
 * @file MARTINS.js WebAR template: Hello, world!
 * @author Alexandre Martins (https://github.com/alemart)
 * @license LGPL-3.0-or-later
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
                'This device is not compatible with this AR experience.\n\n' +
                'User agent: ' + navigator.userAgent
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

        const video = document.getElementById('my-video');
        const useWebcam = (video === null);
        const source = useWebcam ?
            Martins.Source.Camera({ resolution: 'md' }) :
            Martins.Source.Video(video);

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
