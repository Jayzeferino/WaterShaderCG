import * as THREE from 'https://cdn.skypack.dev/three@0.136';

import { FirstPersonControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/FirstPersonControls.js';


const KEYS = {
    'a': 65,
    's': 83,
    'w': 87,
    'd': 68,
};

function clamp(x, a, b) {
    return Math.min(Math.max(x, a), b);
}

class InputController {
    constructor(target) {
        this.target_ = target || document;
        this.initialize_();
    }

    initialize_() {
        this.current_ = {
            leftButton: false,
            rightButton: false,
            mouseXDelta: 0,
            mouseYDelta: 0,
            mouseX: 0,
            mouseY: 0,
        };
        this.previous_ = null;
        this.keys_ = {};
        this.previousKeys_ = {};
        this.target_.addEventListener('mousedown', (e) => this.onMouseDown_(e), false);
        this.target_.addEventListener('mousemove', (e) => this.onMouseMove_(e), false);
        this.target_.addEventListener('mouseup', (e) => this.onMouseUp_(e), false);
        this.target_.addEventListener('keydown', (e) => this.onKeyDown_(e), false);
        this.target_.addEventListener('keyup', (e) => this.onKeyUp_(e), false);
    }

    onMouseMove_(e) {
        this.current_.mouseX = e.pageX - window.innerWidth / 2;
        this.current_.mouseY = e.pageY - window.innerHeight / 2;

        if (this.previous_ === null) {
            this.previous_ = { ...this.current_ };
        }

        this.current_.mouseXDelta = this.current_.mouseX - this.previous_.mouseX;
        this.current_.mouseYDelta = this.current_.mouseY - this.previous_.mouseY;
    }

    onMouseDown_(e) {
        this.onMouseMove_(e);

        switch (e.button) {
            case 0: {
                this.current_.leftButton = true;
                break;
            }
            case 2: {
                this.current_.rightButton = true;
                break;
            }
        }
    }

    onMouseUp_(e) {
        this.onMouseMove_(e);

        switch (e.button) {
            case 0: {
                this.current_.leftButton = false;
                break;
            }
            case 2: {
                this.current_.rightButton = false;
                break;
            }
        }
    }

    onKeyDown_(e) {
        this.keys_[e.keyCode] = true;
    }

    onKeyUp_(e) {
        this.keys_[e.keyCode] = false;
    }

    key(keyCode) {
        return !!this.keys_[keyCode];
    }

    isReady() {
        return this.previous_ !== null;
    }

    update(_) {
        if (this.previous_ !== null) {
            this.current_.mouseXDelta = this.current_.mouseX - this.previous_.mouseX;
            this.current_.mouseYDelta = this.current_.mouseY - this.previous_.mouseY;

            this.previous_ = { ...this.current_ };
        }
    }
};

class FirstPersonCamera {
    constructor(camera, objects) {
        this.camera_ = camera;
        this.input_ = new InputController();
        this.rotation_ = new THREE.Quaternion();
        this.translation_ = new THREE.Vector3(0, 2, 0);
        this.phi_ = 0;
        this.phiSpeed_ = 8;
        this.theta_ = 0;
        this.thetaSpeed_ = 5;
        this.headBobActive_ = false;
        this.headBobTimer_ = 0;
        this.objects_ = objects;
    }

    update(timeElapsedS) {
        this.updateRotation_(timeElapsedS);
        this.updateCamera_(timeElapsedS);
        this.updateTranslation_(timeElapsedS);
        this.input_.update(timeElapsedS);
    }

    updateCamera_(_) {
        this.camera_.quaternion.copy(this.rotation_);
        this.camera_.position.copy(this.translation_);
        this.camera_.position.y += Math.sin(this.headBobTimer_ * 10) * 1.5;
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.rotation_);

        const dir = forward.clone();

        forward.multiplyScalar(100);
        forward.add(this.translation_);

        let closest = forward;
        const result = new THREE.Vector3();
        const ray = new THREE.Ray(this.translation_, dir);
        for (let i = 0; i < this.objects_.length; ++i) {
            if (ray.intersectBox(this.objects_[i], result)) {
                if (result.distanceTo(ray.origin) < closest.distanceTo(ray.origin)) {
                    closest = result.clone();
                }
            }
        }

        this.camera_.lookAt(closest);

    }



    updateTranslation_(timeElapsedS) {
        const forwardVelocity = (this.input_.key(KEYS.w) ? 1 : 0) + (this.input_.key(KEYS.s) ? -1 : 0)
        const strafeVelocity = (this.input_.key(KEYS.a) ? 1 : 0) + (this.input_.key(KEYS.d) ? -1 : 0)

        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);

        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(qx);
        forward.multiplyScalar(forwardVelocity * timeElapsedS * 10);

        const left = new THREE.Vector3(-1, 0, 0);
        left.applyQuaternion(qx);
        left.multiplyScalar(strafeVelocity * timeElapsedS * 10);

        this.translation_.add(forward);
        this.translation_.add(left);

        if (forwardVelocity != 0 || strafeVelocity != 0) {
            this.headBobActive_ = true;
        }
    }

    updateRotation_(timeElapsedS) {
        const xh = this.input_.current_.mouseXDelta / window.innerWidth;
        const yh = this.input_.current_.mouseYDelta / window.innerHeight;

        this.phi_ += -xh * this.phiSpeed_;
        this.theta_ = clamp(this.theta_ + -yh * this.thetaSpeed_, -Math.PI / 3, Math.PI / 3);

        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);
        const qz = new THREE.Quaternion();
        qz.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.theta_);

        const q = new THREE.Quaternion();
        q.multiply(qx);
        q.multiply(qz);

        this.rotation_.copy(q);
    }
}

class FirstPersonCameraFps {
    constructor() {
        this.initialize_();
    }

    initialize_() {
        this.initializeRenderer_();
        this.initializeLights_();
        this.initializeScene_();
        this.initializePostFX_();
        this.initializeFpsCam_();

        this.previousRAF_ = null;
        this.raf_();
        this.onWindowResize_();
    }

    initializeFpsCam_() {
        this.fpsCamera_ = new FirstPersonCamera(this.camera_, this.objects_);
    }

    initializeRenderer_() {
        this.renderer_ = new THREE.WebGLRenderer({
            antialias: false,
        });
        this.renderer_.shadowMap.enabled = true;
        this.renderer_.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer_.setPixelRatio(window.devicePixelRatio);
        this.renderer_.setSize(window.innerWidth, window.innerHeight);
        this.renderer_.physicallyCorrectLights = true;
        this.renderer_.outputEncoding = THREE.sRGBEncoding;

        document.body.appendChild(this.renderer_.domElement);

        window.addEventListener('resize', () => {
            this.onWindowResize_();
        }, false);

        const fov = 60;
        const aspect = 1920 / 1080;
        const near = 1.0;
        const far = 1000.0;
        this.camera_ = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera_.position.set(0, 8, 0);
        this.scene_ = new THREE.Scene();


        this.renderTarget_ = new THREE.WebGLRenderTarget(10 * window.innerWidth, 5 * window.innerHeight);
        this.mirrorCamera_ = new THREE.PerspectiveCamera(fov, this.renderTarget_.width / this.renderTarget_.height, near, far);
        this.mirrorCamera_.position.set(0, 3, 0);


        this.mirrorScene_ = new THREE.Scene();

        this.uiCamera_ = new THREE.OrthographicCamera(
            -1, 1, 1 * aspect, -1 * aspect, 1, 1000);
        this.uiScene_ = new THREE.Scene();


    }

    initializeScene_() {
        const loader = new THREE.CubeTextureLoader();
        const texture = loader.load([
            './resources/skybox/posx.jpg',
            './resources/skybox/negx.jpg',
            './resources/skybox/posy.jpg',
            './resources/skybox/negy.jpg',
            './resources/skybox/posz.jpg',
            './resources/skybox/negz.jpg',
        ]);

        texture.encoding = THREE.sRGBEncoding;
        this.scene_.background = texture;

        const mapLoader = new THREE.TextureLoader();
        const maxAnisotropy = this.renderer_.capabilities.getMaxAnisotropy();
        const checkerboard = mapLoader.load('resources/checkerboard.png');
        checkerboard.anisotropy = maxAnisotropy;
        checkerboard.wrapS = THREE.RepeatWrapping;
        checkerboard.wrapT = THREE.RepeatWrapping;
        checkerboard.repeat.set(32, 32);
        checkerboard.encoding = THREE.sRGBEncoding;

        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100, 10, 10),
            new THREE.MeshStandardMaterial({ map: checkerboard }));
        plane.castShadow = false;
        plane.receiveShadow = true;
        plane.rotation.x = -Math.PI / 2;
        this.scene_.add(plane);

        const concreteMaterial = this.loadMaterial_('concrete3-', 4);

        const box = new THREE.Mesh(
            new THREE.BoxGeometry(4, 4, 4),
            concreteMaterial);
        box.position.set(1, 2, -16);
        box.castShadow = true;
        box.receiveShadow = true;
        this.scene_.add(box);

        const box2 = new THREE.Mesh(
            new THREE.BoxGeometry(4, 4, 4),
            concreteMaterial);
        box2.position.set(1, 2.5, 16);
        box2.castShadow = true;
        box2.receiveShadow = true;
        this.scene_.add(box2);

        this.waterTex = this.loadMaterialInRenderTarget_('Water-', 4);
        // this.waterTex = new THREE.TextureLoader().load('resources/freepbr/waterpool.jpg');
        // this.waterTex.wrapS = THREE.RepeatWrapping;
        // this.waterTex.wrapT = THREE.RepeatWrapping;
        const waterMaterial = new THREE.MeshStandardMaterial({
            map: this.waterTex,
            transparent: true,
            opacity: 0.8
        });

        const waterplane = new THREE.Mesh(
            new THREE.BoxGeometry(10, 5, 0.01),
            this.waterTex
        );

        const camMaterial = new THREE.MeshPhongMaterial({
            map: this.renderTarget_.texture,
        });

        waterplane.position.set(0, 3, 0);
        this.scene_.add(waterplane);

        const mirror = new THREE.Mesh(
            new THREE.BoxGeometry(10, 5, 0),
            camMaterial
        );
        mirror.position.set(0, 3, 0);

        this.scene_.add(mirror);

        // Create Box3 for each mesh in the scene so that we can
        // do some easy intersection tests.
        const meshes = [plane, box, mirror, waterplane];

        this.objects_ = [];

        for (let i = 0; i < meshes.length; ++i) {
            const b = new THREE.Box3();
            b.setFromObject(meshes[i]);
            this.objects_.push(b);
        }

        // Crosshair
        const crosshair = mapLoader.load('resources/crosshair.png');
        crosshair.anisotropy = maxAnisotropy;

        this.sprite_ = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: crosshair, color: 0xffffff, fog: false, depthTest: false, depthWrite: false }));
        this.sprite_.scale.set(0.15, 0.15 * this.camera_.aspect, 1)
        this.sprite_.position.set(0, 0, -10);

        this.uiScene_.add(this.sprite_);

        // Mirror

        this.mirrorScene_ = this.scene_;
    }

    initializeLights_() {
        const distance = 50.0;
        const angle = Math.PI / 4.0;
        const penumbra = 0.5;
        const decay = 1.0;

        let light = new THREE.SpotLight(
            0xFFFFFF, 100.0, distance, angle, penumbra, decay);
        light.castShadow = true;
        light.shadow.bias = -0.00001;
        light.shadow.mapSize.width = 4096;
        light.shadow.mapSize.height = 4096;
        light.shadow.camera.near = 1;
        light.shadow.camera.far = 100;

        light.position.set(25, 25, 0);
        light.lookAt(0, 0, 0);
        this.scene_.add(light);

        const upColour = 0xFFFF80;
        const downColour = 0x808080;
        light = new THREE.HemisphereLight(upColour, downColour, 0.5);
        light.color.setHSL(0.6, 1, 0.6);
        light.groundColor.setHSL(0.095, 1, 0.75);
        light.position.set(0, 4, 0);
        this.scene_.add(light);
    }

    loadMaterial_(name, tiling) {
        const mapLoader = new THREE.TextureLoader();
        const maxAnisotropy = this.renderer_.capabilities.getMaxAnisotropy();

        const metalMap = mapLoader.load('resources/freepbr/' + name + 'metallic.png');
        metalMap.anisotropy = maxAnisotropy;
        metalMap.wrapS = THREE.RepeatWrapping;
        metalMap.wrapT = THREE.RepeatWrapping;
        metalMap.repeat.set(tiling, tiling);

        const albedo = mapLoader.load('resources/freepbr/' + name + 'albedo.png');
        albedo.anisotropy = maxAnisotropy;
        albedo.wrapS = THREE.RepeatWrapping;
        albedo.wrapT = THREE.RepeatWrapping;
        albedo.repeat.set(tiling, tiling);
        albedo.encoding = THREE.sRGBEncoding;

        const normalMap = mapLoader.load('resources/freepbr/' + name + 'normal.png');
        normalMap.anisotropy = maxAnisotropy;
        normalMap.wrapS = THREE.RepeatWrapping;
        normalMap.wrapT = THREE.RepeatWrapping;
        normalMap.repeat.set(tiling, tiling);

        const roughnessMap = mapLoader.load('resources/freepbr/' + name + 'roughness.png');
        roughnessMap.anisotropy = maxAnisotropy;
        roughnessMap.wrapS = THREE.RepeatWrapping;
        roughnessMap.wrapT = THREE.RepeatWrapping;
        roughnessMap.repeat.set(tiling, tiling);

        const lightMap = mapLoader.load('resources/freepbr/' + name + 'light.png');
        roughnessMap.anisotropy = maxAnisotropy;
        roughnessMap.wrapS = THREE.RepeatWrapping;
        roughnessMap.wrapT = THREE.RepeatWrapping;
        roughnessMap.repeat.set(tiling, tiling);

        const displacementMap = mapLoader.load('resources/freepbr/' + name + 'displacement.png');
        roughnessMap.anisotropy = maxAnisotropy;
        roughnessMap.wrapS = THREE.RepeatWrapping;
        roughnessMap.wrapT = THREE.RepeatWrapping;
        roughnessMap.repeat.set(tiling, tiling);

        const material = new THREE.MeshStandardMaterial({
            metalnessMap: metalMap,
            map: albedo,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            displacementMap: displacementMap,
            lightMap: lightMap
        });

        return material;
    }

    updateTexture() {

    }

    loadMaterialInRenderTarget_(name, tiling) {
        const mapLoader = new THREE.TextureLoader();
        const maxAnisotropy = this.renderer_.capabilities.getMaxAnisotropy();

        this.metalMap = mapLoader.load('resources/freepbr/' + name + 'metallic.jpg');
        this.metalMap.anisotropy = maxAnisotropy;
        this.metalMap.wrapS = THREE.RepeatWrapping;
        this.metalMap.wrapT = THREE.RepeatWrapping;
        this.metalMap.repeat.set(tiling, tiling);

        const albedo = this.renderTarget_.texture;

        this.normalMap = mapLoader.load('resources/freepbr/' + name + 'normal.jpg');
        this.normalMap.anisotropy = maxAnisotropy;
        this.normalMap.wrapS = THREE.RepeatWrapping;
        this.normalMap.wrapT = THREE.RepeatWrapping;
        this.normalMap.repeat.set(tiling, tiling);

        this.roughnessMap = mapLoader.load('resources/freepbr/' + name + 'roughness.jpg');
        this.roughnessMap.anisotropy = maxAnisotropy;
        this.roughnessMap.wrapS = THREE.RepeatWrapping;
        this.roughnessMap.wrapT = THREE.RepeatWrapping;
        this.roughnessMap.repeat.set(tiling, tiling);

        this.lightMap = mapLoader.load('resources/freepbr/' + name + 'light.jpg');
        this.lightMap.anisotropy = maxAnisotropy;
        this.lightMap.wrapS = THREE.RepeatWrapping;
        this.lightMap.wrapT = THREE.RepeatWrapping;
        this.lightMap.repeat.set(tiling, tiling);

        this.displacementMap = mapLoader.load('resources/freepbr/' + name + 'displacement.png');
        this.displacementMap.anisotropy = maxAnisotropy;
        this.displacementMap.wrapS = THREE.RepeatWrapping;
        this.displacementMap.wrapT = THREE.RepeatWrapping;
        this.displacementMap.repeat.set(tiling, tiling);

        const material = new THREE.MeshStandardMaterial({
            metalnessMap: this.metalMap,
            map: albedo,
            normalMap: this.normalMap,
            roughnessMap: this.roughnessMap,
            displacementMap: this.displacementMap,
            lightMap: this.lightMap
        });

        return material;
    }

    initializePostFX_() {
    }

    onWindowResize_() {
        this.camera_.aspect = window.innerWidth / window.innerHeight;
        this.camera_.updateProjectionMatrix();

        // this.mirrorCamera_.aspect = window.innerWidth / window.innerHeight;
        // this.mirrorCamera_.updateProjectionMatrix();

        this.uiCamera_.left = -this.camera_.aspect;
        this.uiCamera_.right = this.camera_.aspect;
        this.uiCamera_.updateProjectionMatrix();

        this.renderer_.setSize(window.innerWidth, window.innerHeight);
    }


    moveWater(timeElapsed) {
        this.metalMap.offset.x += 0.09 * timeElapsed;
        this.metalMap.offset.y += 0.01 * timeElapsed;



        this.normalMap.offset.x += 0.09 * timeElapsed;
        this.normalMap.offset.y += 0.01 * timeElapsed;

        this.roughnessMap.offset.x += 0.09 * timeElapsed;
        this.roughnessMap.offset.y += 0.01 * timeElapsed;

        this.lightMap.offset.x += 0.09 * timeElapsed;
        this.lightMap.offset.y += 0.01 * timeElapsed;

        this.displacementMap.offset.x += 0.09 * timeElapsed;
        this.displacementMap.offset.y += 0.01 * timeElapsed;
    }
    raf_() {
        requestAnimationFrame((t) => {
            if (this.previousRAF_ === null) {
                this.previousRAF_ = t;
            }

            this.step_(t - this.previousRAF_);
            this.renderer_.autoClear = true;
            this.renderer_.setRenderTarget(this.renderTarget_);
            this.renderer_.render(this.scene_, this.mirrorCamera_);
            this.renderer_.setRenderTarget(null);
            this.renderer_.render(this.scene_, this.camera_);
            this.renderer_.autoClear = false;
            this.renderer_.render(this.uiScene_, this.uiCamera_);
            this.previousRAF_ = t;
            this.raf_();
        });
    }

    step_(timeElapsed) {
        const timeElapsedS = timeElapsed * 0.001;

        // this.controls_.update(timeElapsedS);
        this.fpsCamera_.update(timeElapsedS);
        this.mirrorCamera_.lookAt(this.camera_.position);
        this.moveWater(timeElapsedS);
    }
}
let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new FirstPersonCameraFps();
});