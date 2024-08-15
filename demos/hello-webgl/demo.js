/*

Note:

It is easier to use a 3D library or framework than to write WebGL code. This
demo shows an augmented scene created with WebGL code, and is intended for
demonstration purposes only. You don't need to write WebGL code for AR. Use
a library or framework to render the virtual elements. See the other demos.

WebGL low-level code:

*/

class Entity
{
    constructor(gl)
    {
        this._gl = gl;
        this._program = this._compile(gl, this.vertexShader, this.fragmentShader);
        this._uniformLocation = {
            'time': gl.getUniformLocation(this._program, 'time'),
            'resolution': gl.getUniformLocation(this._program, 'resolution'),
            'projectionMatrix': gl.getUniformLocation(this._program, 'projectionMatrix'),
            'modelViewMatrix': gl.getUniformLocation(this._program, 'modelViewMatrix'),
        };

        this.projectionMatrix = new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
        this.modelViewMatrix = new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    }

    render(time = 0)
    {
        const gl = this._gl, u = this._uniformLocation;

        gl.useProgram(this._program);

        gl.uniform1f(u.time, time);
        gl.uniform2f(u.resolution, gl.canvas.width, gl.canvas.height);
        gl.uniformMatrix4fv(u.projectionMatrix, false, this.projectionMatrix);
        gl.uniformMatrix4fv(u.modelViewMatrix, false, this.modelViewMatrix);

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        this._render(time);
    }

    _render(time)
    {
        const gl = this._gl;

        gl.drawArrays(gl.TRIANGLES, 0, 3 * this.numberOfTriangles);
    }

    get numberOfTriangles()
    {
        throw new Error();
    }

    get vertexShader()
    {
        throw new Error();
    }

    get fragmentShader()
    {
        throw new Error();
    }

    get _includeShaderUtils()
    {
        return `
        mat4 translate(vec3 offset)
        {
            float x = offset.x, y = offset.y, z = offset.z;

            return mat4(
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                x, y, z, 1
            );
        }

        mat4 scale(vec3 factor)
        {
            float x = factor.x, y = factor.y, z = factor.z;

            return mat4(
                x, 0, 0, 0,
                0, y, 0, 0,
                0, 0, z, 0,
                0, 0, 0, 1
            );
        }

        mat4 rotateX(float rad)
        {
            float s = sin(rad), c = cos(rad);

            return mat4(
                1, 0, 0, 0,
                0, c, s, 0,
                0,-s, c, 0,
                0, 0, 0, 1
            );
        }

        mat4 rotateY(float rad)
        {
            float s = sin(rad), c = cos(rad);

            return mat4(
                c, 0,-s, 0,
                0, 1, 0, 0,
                s, 0, c, 0,
                0, 0, 0, 1
            );
        }

        mat4 rotateZ(float rad)
        {
            float s = sin(rad), c = cos(rad);

            return mat4(
                c, s, 0, 0,
               -s, c, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            );
        }

        mat4 rotate(vec3 euler)
        {
            return rotateZ(euler.z) * rotateY(euler.y) * rotateX(euler.x);
        }
        `;
    }

    get _includeVertexShaderUtils()
    {
        return this._includeShaderUtils + this._transform;
    }

    get _includeFragmentShaderUtils()
    {
        return this._includeShaderUtils + this._colorize;
    }

    get _transform()
    {
        return `
        vec4 transform(vec4 v)
        {
            return v;
        }
        `;
    }

    get _colorize()
    {
        return `
        vec4 colorize(vec4 p)
        {
            return p;
        }
        `;
    }

    _createShader(gl, shaderType, shaderSource)
    {
        const shader = gl.createShader(shaderType);

        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);

        if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(message);
        }

        return shader;
    }

    _createProgram(gl, vs, fs)
    {
        const program = gl.createProgram();

        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const message = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(message);
        }

        return program;
    }

    _compile(gl, vsSource, fsSource)
    {
        const vs = this._createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fs = this._createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const program = this._createProgram(gl, vs, fs);

        return program;
    }
}

class Pyramid extends Entity
{
    get numberOfTriangles()
    {
        return 4;
    }

    get vertexShader()
    {
        return `#version 300 es

        uniform mat4 projectionMatrix;
        uniform mat4 modelViewMatrix;
        uniform float time;
        uniform vec2 resolution;

        flat out int triangleID;
        out vec2 control;

        const float VERTEX[] = float[](
            0.5, -0.25, 0.25,
            0.0, 0.25, 0.0,
            -0.5, -0.25, 0.25,

            -0.5, -0.25, 0.25,
            0.0, 0.25, 0.0,
            0.0, -0.25, -0.5,

            0.0, -0.25, -0.5,
            0.0, 0.25, 0.0,
            0.5, -0.25, 0.25,

            0.0, -0.25, -0.5,
            0.5, -0.25, 0.25,
            -0.5, -0.25, 0.25
        );
        const vec3 CENTROID = vec3(
            0.0, -0.125, 0.0
        );

        const vec2 UV_CONTROL_POINT[] = vec2[](
            vec2(0.0, 1.0),
            vec2(1.0, -1.0),
            vec2(-1.0, -1.0)
        );

        ${this._includeVertexShaderUtils}

        void main()
        {
            int base = gl_VertexID * 3;
            vec4 vertex = vec4(VERTEX[base], VERTEX[base+1], VERTEX[base+2], 1.0);

            gl_Position = projectionMatrix * modelViewMatrix * transform(vertex);
            triangleID = gl_VertexID / 3;
            control = UV_CONTROL_POINT[gl_VertexID % 3];
        }
        `;
    }

    get fragmentShader()
    {
        return `#version 300 es
        precision mediump float;

        flat in int triangleID;
        out vec4 color;

        const vec3 COLOR[] = vec3[](
            vec3(0,1,1),
            vec3(1,1,0),
            vec3(1,0,1),
            vec3(0,1,0)
        );

        ${this._includeFragmentShaderUtils}

        void main()
        {
            vec4 pixel = vec4(COLOR[triangleID], 1.0);
            color = colorize(pixel);
        }
        `;
    }

    get _colorize()
    {
        // create black borders
        return `
        const float THICKNESS = 0.05;
        in vec2 control;

        vec4 colorize(vec4 p)
        {
            const float SQRT5 = float(${Math.sqrt(5.0)});
            float x = control.x, y = control.y;

            float d = abs(y + 1.0);
            d = min(d, abs(2.0 * x - y + 1.0) / SQRT5);
            d = min(d, abs(-2.0 * x - y + 1.0) / SQRT5);

            p.rgb *= step(THICKNESS, d);
            return p;
        }
        `;
    }
}

class AnimatedPyramid extends Pyramid
{
    get _transform()
    {
        // rotate around the centroid
        return `
        const float CYCLE_DURATION = 3.0;
        const vec3 POSITION = vec3(0.0, 0.0, 0.5);
        const vec3 SCALE = vec3(1.5);

        vec4 transform(vec4 v)
        {
            const float PI = float(${Math.PI});
            float rad = -(2.0 * PI / CYCLE_DURATION) * time;

            v = translate(-CENTROID) * v;
            v = rotate(vec3(rad, rad, 0.0)) * v;
            v = translate(CENTROID) * v;

            v = scale(SCALE) * v;
            v = translate(POSITION) * v;
            return v;
        }
        `;
    }
}

class Cube extends Entity
{
    get numberOfTriangles()
    {
        return 12; // 6 faces * 2 triangles per face
    }

    get vertexShader()
    {
        return `#version 300 es

        uniform mat4 projectionMatrix;
        uniform mat4 modelViewMatrix;
        uniform float time;
        uniform vec2 resolution;

        flat out int faceID;
        out vec2 control;

        const float VERTEX[] = float[](
            1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, 1.0, 1.0,

            1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
            -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,

            1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, -1.0,
            -1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, 1.0,

            1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,
            -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, 1.0,

            1.0, 1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, 1.0,

            -1.0, 1.0, 1.0,
            -1.0, -1.0, 1.0,
            -1.0, -1.0, -1.0,
            -1.0, -1.0, -1.0,
            -1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0
        );
        const vec3 CENTROID = vec3(
            0.0, 0.0, 0.0
        );

        const vec2 UV_CONTROL_POINT[] = vec2[](
            vec2(1.0, 1.0),
            vec2(0.0, 1.0),
            vec2(0.0, 0.0),
            vec2(0.0, 0.0),
            vec2(1.0, 0.0),
            vec2(1.0, 1.0)
        );

        ${this._includeVertexShaderUtils}

        void main()
        {
            int base = gl_VertexID * 3;
            vec4 vertex = vec4(VERTEX[base], VERTEX[base+1], VERTEX[base+2], 1.0);

            gl_Position = projectionMatrix * modelViewMatrix * transform(vertex);
            faceID = gl_VertexID / 6;
            control = UV_CONTROL_POINT[gl_VertexID % 6];
        }
        `;
    }

    get fragmentShader()
    {
        return `#version 300 es
        precision mediump float;

        flat in int faceID;
        out vec4 color;

        const vec3 COLOR[] = vec3[](
            vec3(1,0,1),
            vec3(1,1,0),
            vec3(0,1,1),
            vec3(1,0,0),
            vec3(0,0,1),
            vec3(0,1,0)
        );

        ${this._includeFragmentShaderUtils}

        void main()
        {
            vec4 pixel = vec4(COLOR[faceID], 1.0);
            color = colorize(pixel);
        }
        `;
    }

    get _colorize()
    {
        // create black borders
        return `
        const float THICKNESS = 0.03;
        in vec2 control;

        vec4 colorize(vec4 p)
        {
            float x = control.x, y = control.y;

            vec4 d4 = abs(vec4(x, y, x - 1.0, y - 1.0));
            vec2 d2 = min(d4.xy, d4.zw);
            float d = min(d2.x, d2.y);

            p.rgb *= step(THICKNESS, d);
            return p;
        }
        `;
    }
}

class AnimatedCube extends Cube
{
    get _transform()
    {
        // rotate around the centroid
        return `
        const float CYCLE_DURATION = 3.0;
        const vec3 POSITION = vec3(-0.5, -1.5, 2.0);
        const vec3 SCALE = vec3(0.5);

        vec4 transform(vec4 v)
        {
            const float PI = float(${Math.PI});
            float rad = -(2.0 * PI / CYCLE_DURATION) * time;

            v = translate(-CENTROID) * v;
            v = rotateY(rad) * v;
            v = translate(CENTROID) * v;

            v = scale(SCALE) * v;
            v = translate(POSITION) * v;
            return v;
        }
        `;
    }
}

class Quad extends Entity
{
    get numberOfTriangles()
    {
        return 2;
    }

    get vertexShader()
    {
        return `#version 300 es

        uniform mat4 projectionMatrix;
        uniform mat4 modelViewMatrix;
        uniform float time;
        uniform vec2 resolution;

        out vec2 texCoord;

        const float UV[] = float[](
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,

            0.0, 1.0,
            1.0, 0.0,
            1.0, 1.0
        );

        const float QUAD[] = float[](
           -1.0,-1.0,
            1.0,-1.0,
           -1.0, 1.0,

           -1.0, 1.0,
            1.0,-1.0,
            1.0, 1.0
        );

        ${this._includeVertexShaderUtils}
        ${this._rectify}
        ${this._rectifyUV}

        void main()
        {
            int base = gl_VertexID * 2;
            vec4 vertex = vec4(QUAD[base], QUAD[base+1], 0.0, 1.0);

            vec4 v = rectify(vertex);
            gl_Position = projectionMatrix * modelViewMatrix * transform(v);

            vec2 uv = vec2(UV[base], UV[base+1]) * vec2(1,-1);
            texCoord = rectifyUV(uv);
        }
        `;
    }

    get _rectify()
    {
        return `
        vec4 rectify(vec4 v)
        {
            return v;
        }
        `;
    }

    get _rectifyUV()
    {
        return `
        vec2 rectifyUV(vec2 v)
        {
            return v;
        }
        `;
    }
}

class ImageQuad extends Quad
{
    constructor(gl)
    {
        super(gl);

        this._uniformLocation['image'] = gl.getUniformLocation(this._program, 'image');
        this._texture = gl.createTexture();
        this._uploaded = false;
        this._image = null;

        if(this._imageURL != '') {
            this._image = new Image();
            this._image.onload = () => this.upload(this._image);
            this._image.src = this._imageURL;
        }
    }

    upload(data)
    {
        const gl = this._gl;

        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D,
            0, // mipmap level
            gl.RGBA, // internal format
            gl.RGBA, // data format
            gl.UNSIGNED_BYTE, // data type
            data // data
        );
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);

        this._uploaded = true;
    }

    _render(time)
    {
        const gl = this._gl;

        if(!this._uploaded)
            return;

        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.activeTexture(gl.TEXTURE0 + 0);
        gl.uniform1i(this._uniformLocation['image'], 0);

        super._render(time);

        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    get _imageURL()
    {
        return '';
    }

    get _rectify()
    {
        return `
        uniform sampler2D image;

        vec4 rectify(vec4 v)
        {
            ivec2 size = textureSize(image, 0);
            float imageAspect = size.y > 0 ? float(size.x) / float(size.y) : 1.0;

            vec4 u = imageAspect > 1.0 ?
                vec4(1.0, 1.0 / imageAspect, 1.0, 1.0) :
                vec4(imageAspect, 1.0, 1.0, 1.0);

            return u * v;
        }
        `;
    }

    get fragmentShader()
    {
        return `#version 300 es
        precision mediump float;

        uniform sampler2D image;
        in vec2 texCoord;
        out vec4 color;

        ${this._includeFragmentShaderUtils}

        void main()
        {
            vec4 pixel = texture(image, texCoord);
            color = colorize(pixel);
        }
        `;
    }
}

class Sprite extends ImageQuad
{
    get _numberOfFrames()
    {
        return 1;
    }

    get _framesPerSecond()
    {
        return 8;
    }

    get _initialFrame()
    {
        return 0;
    }

    get _isHorizontalSpritesheet()
    {
        return true;
    }

    get _rectify()
    {
        return `
        uniform sampler2D image;

        vec4 rectify(vec4 v)
        {
            const int NUMBER_OF_FRAMES = int(${this._numberOfFrames});
            const bool HORIZONTAL = bool(${this._isHorizontalSpritesheet});

            ivec2 size = textureSize(image, 0);
            size /= HORIZONTAL ? ivec2(NUMBER_OF_FRAMES, 1) : ivec2(1, NUMBER_OF_FRAMES);

            float imageAspect = size.y > 0 ? float(size.x) / float(size.y) : 1.0;

            vec4 u = imageAspect > 1.0 ?
                vec4(1.0, 1.0 / imageAspect, 1.0, 1.0) :
                vec4(imageAspect, 1.0, 1.0, 1.0);

            return u * v;
        }
        `;
    }

    get _rectifyUV()
    {
        return `
        vec2 rectifyUV(vec2 v)
        {
            const bool HORIZONTAL = bool(${this._isHorizontalSpritesheet});
            const float NUMBER_OF_FRAMES = float(${this._numberOfFrames});
            const float INITIAL_FRAME = float(${this._initialFrame});
            const float FPS = float(${this._framesPerSecond});

            float frame = mod(time * FPS + INITIAL_FRAME, NUMBER_OF_FRAMES);
            float base = floor(frame) / NUMBER_OF_FRAMES;
            vec2 offset = v / NUMBER_OF_FRAMES;

            return HORIZONTAL ?
                vec2(base + offset.x, v.y) :
                vec2(v.x, base + offset.y);
        }
        `;
    }
}

class ItWorks extends ImageQuad
{
    constructor(gl)
    {
        super(gl);

        this._image = document.getElementById('it-works');
        this.upload(this._image);
    }

    get _transform()
    {
        return `
        const vec3 POSITION = vec3(0.0, 1.0, 0.0);
        const vec3 SCALE = vec3(2.25);

        vec4 transform(vec4 v)
        {
            return translate(POSITION) * scale(SCALE) * v;
        }
        `;
    }

    get _colorize()
    {
        return `
        const vec4 COLOR = vec4(173, 255, 47, 255) / 255.0;

        vec4 colorize(vec4 p)
        {
            return p * COLOR;
        }
        `;
    }
}

class WingMan extends Sprite
{
    constructor(gl)
    {
        WingMan._count = WingMan._count || 0;
        ++WingMan._count;

        super(gl);

        this._image = document.getElementById('wing-man');
        this.upload(this._image);
    }

    get _numberOfFrames()
    {
        return 8;
    }

    get _framesPerSecond()
    {
        return 20;
    }

    get _initialFrame()
    {
        const n = 2;
        return (WingMan._count % n) * Math.floor(this._numberOfFrames / n);
    }

    get _transform()
    {
        return `
        const float PI = float(${Math.PI});
        const float INITIAL_PHASE = PI * float(${WingMan._count});
        const vec3 INITIAL_POSITION = vec3(1.25 * cos(INITIAL_PHASE), -0.25, 2.0);
        const vec3 SCALE = vec3(0.7);

        vec4 transform(vec4 v)
        {
            float z = 0.6 * cos(INITIAL_PHASE);
            float y = 0.1 * cos(2.0 * PI * time + INITIAL_PHASE);
            vec3 position = vec3(0.0, y, z) + INITIAL_POSITION;

            return translate(position) * scale(SCALE) * v;
        }
        `;
    }
}

/*

encantar.js + WebGL code:

*/

window.addEventListener('load', async function() {
    try {
        const session = await startARSession();
        const gl = initGL(session.viewport.canvas);
        const scene = [
            new AnimatedPyramid(gl),
            new AnimatedCube(gl),
            new ItWorks(gl),
            new WingMan(gl),
            new WingMan(gl),
        ];

        function initGL(canvas)
        {
            const gl = canvas.getContext('webgl2', {
                alpha: true
            });

            if(!gl)
                throw new Error(`Can't create WebGL2 context`);

            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

            return gl;
        }

        function clear()
        {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }


        function render(elapsedTimeInSeconds, projectionMatrix, modelViewMatrix)
        {
            for(const entity of scene) {
                entity.projectionMatrix.set(projectionMatrix);
                entity.modelViewMatrix.set(modelViewMatrix);
                entity.render(elapsedTimeInSeconds);
            }
        }

        function animate(time, frame)
        {
            clear();

            for(const result of frame.results) {
                if('image-tracker' == result.tracker.type) {
                    if(result.trackables.length > 0) {
                        const trackable = result.trackables[0];
                        const projectionMatrix = result.viewer.view.projectionMatrix;
                        const modelViewMatrix = result.viewer.convertToViewerSpace(trackable.pose).transform.matrix;
                        
                        render(frame.session.time.elapsed, projectionMatrix.read(), modelViewMatrix.read());
                    }
                }
            }

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
});
