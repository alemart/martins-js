async function startARSession(canvas)
{
    if(!AR.isSupported()) {
        throw new Error(
            'This device is not compatible with this AR experience.\n\n' +
            'User agent: ' + navigator.userAgent
        );
    }

    if(!(canvas instanceof HTMLCanvasElement))
        throw new Error(`startARSession expects a <canvas>`);

    //AR.Settings.powerPreference = 'low-power';

    const tracker = AR.Tracker.ImageTracker();
    await tracker.database.add([
    {
        name: 'my-reference-image',
        image: document.getElementById('my-reference-image')
    },
    {
        name: 'my-reference-image2',
        image: document.getElementById('my-reference-image2')
    },
    ]);

    const viewport = AR.Viewport({
        canvas: canvas,
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
