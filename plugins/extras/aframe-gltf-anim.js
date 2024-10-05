/**
 * A minimalistic A-Frame component for animating 3D models
 * @author Alexandre Martins <alemartf(at)gmail.com> (https://github.com/alemart)
 * @license MIT
 */

AFRAME.registerComponent('gltf-anim', {

    schema: {

        /** the name of an animation clip */
        'clip': { type: 'string', default: '' },

        /** whether or not to loop the animation */
        'loop': { type: 'boolean', default: true },

        /** scaling factor for the playback speed */
        'speed': { type: 'number', default: 1 },

        /** duration in seconds of transitions between clips */
        'transitionDuration': { type: 'number', default: 0 },

    },

    init()
    {
        const el = this.el;

        this._model = null;
        this._action = null;

        el.addEventListener('model-loaded', event => {

            if(event.target === el) {
                this._model = event.detail.model;
                this._refresh();
            }

        });

        el.addEventListener('model-error', event => {

            if(event.target === el) {
                this._model = null;
                this._refresh();
            }

        });

    },

    update(oldData)
    {
        if(!this._model)
            return;

        if(this.data.clip != oldData.clip)
            this._switchClip();

        if(!this._action)
            return;

        if(Math.abs(this.data.speed - oldData.speed) > 1e-5)
            this._action.timeScale = this.data.speed;

        if(this.data.loop != oldData.loop)
            this._action.loop = this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce;
    },

    remove()
    {
        if(this._action)
            this._action.getMixer().stopAllAction();

        this._action = null;
        this._model = null;
    },

    tick(time, delta)
    {
        if(this._action) {
            const mixer = this._action.getMixer();
            mixer.update(delta * 0.001);
        }
    },

    _refresh()
    {
        if(this._action) {
            this._action.getMixer().stopAllAction();
            this._action = null;
        }

        if(this._model) {
            if((this._action = this._clipAction(null)))
                this._action.play();
        }
    },

    _switchClip()
    {
        const oldAction = this._action;
        if(!oldAction) {
            this._refresh();
            return;
        }

        const newAction = this._clipAction(oldAction.getMixer());
        if(!newAction) {
            this._refresh();
            return;
        }
        
        this._action = newAction;
        this._action.reset().play().crossFadeFrom(oldAction, Math.max(0, this.data.transitionDuration));
    },

    _clipAction(existingMixer)
    {
        if(!this._model)
            return null;

        const mixer = (existingMixer && existingMixer.getRoot() === this._model) ? existingMixer : new THREE.AnimationMixer(this._model);
        const clips = this._model.animations;

        if(!clips || clips.length == 0)
            return null;

        const name = (this.data.clip != '') ? this.data.clip : this._defaultClipName(clips);
        const clip = THREE.AnimationClip.findByName(clips, name);

        if(!clip)
            return null;

        const action = mixer.clipAction(clip);
        action.loop = this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce;
        action.timeScale = this.data.speed;

        return action;
    },

    _defaultClipName(clips)
    {
        const sortedNames = clips.map(clip => clip.name).sort();
        return sortedNames[0];
    },

});
