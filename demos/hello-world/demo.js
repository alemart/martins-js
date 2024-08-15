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
