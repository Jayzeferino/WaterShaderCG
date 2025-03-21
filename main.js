import * as THREE from 'https://cdn.skypack.dev/three@0.136';

import { FirstPersonControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/FirstPersonControls.js';


const KEYS = {
    'a': 65,
    's': 83,
    'w': 87,
    'd': 68,
    'space': 32,
    'Lshift': 16
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
        const upVelocity = this.input_.key(KEYS.space) ? 1 : -1;

        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);

        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(qx);
        forward.multiplyScalar(forwardVelocity * timeElapsedS * 10);

        const left = new THREE.Vector3(-1, 0, 0);
        left.applyQuaternion(qx);
        left.multiplyScalar(strafeVelocity * timeElapsedS * 10);

        const up = new THREE.Vector3(0, 1, 0);
        up.multiplyScalar(upVelocity * timeElapsedS * 0.8);

        this.translation_.add(forward);
        this.translation_.add(left);
        this.translation_.add(up); //adiciona voar

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
            antialias: false, stencil: true
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
        const near = 0.1;
        const far = 1000.0;
        this.camera_ = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera_.position.set(0, 8, 0);
        this.scene_ = new THREE.Scene();


        this.renderTarget_ = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        this.refractRenderTarget_ = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        this.mirrorCamera_ = new THREE.PerspectiveCamera(50, this.renderTarget_.width / this.renderTarget_.height, near, far);
        this.mirrorCamera_.position.set(0, 2, 0);
        this.refractCamera_ = new THREE.PerspectiveCamera(40, this.renderTarget_.width / this.renderTarget_.height, near, far);
        this.refractCamera_.position.set(0, 2., 0);

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

        const spaceMaterial = this.loadMaterial_('space-crate1-', 1);
        this.sphere = new THREE.Mesh(
            new THREE.SphereGeometry(2, 32, 16),
            concreteMaterial);
        this.sphere.position.set(1, 2, -16);
        this.sphere.castShadow = true;
        this.sphere.receiveShadow = true;
        this.scene_.add(this.sphere);

        this.box = new THREE.Mesh(
            new THREE.BoxGeometry(4, 4, 4),
            spaceMaterial);
        this.box.position.set(1, 2.5, 16);
        this.box.castShadow = true;
        this.box.receiveShadow = true;
        this.scene_.add(this.box);

        this.shadow = new THREE.Mesh(
            new THREE.SphereGeometry(2., 32, 16),
            spaceMaterial);
        this.shadow.position.set(1, 3, 5);
        this.shadow.castShadow = true;
        this.shadow.receiveShadow = true;
        this.scene_.add(this.shadow);
        this.shadow.visible = false;

        const watertext = new THREE.TextureLoader().load('resources/freepbr/waterpool.jpg');
        watertext.wrapS = THREE.RepeatWrapping;
        watertext.wrapT = THREE.RepeatWrapping;

        //SHADER CUSTOMIZADO
        this.camMaterial = new THREE.ShaderMaterial({
            uniforms: {
                cameraPosition: { value: this.camera_.position },
                uTexture: { type: 't', value: this.renderTarget_.texture },
                rTexture: { type: 't', value: this.refractRenderTarget_.texture },
                wTexture: { type: 't', value: watertext },

                uOpacity: { value: 1 },
                waterAlph: { value: 0.2 },
                reflectionAlph: { value: 0.3 },
                refractionRatio: { value: 1.33 },
                u_time: { value: 0.0 }
            },
            vertexShader:/*glsl*/`

                precision highp float;
                out vec3 vViewPosition;
                out vec3 vCameraPosition;
                out vec3 vNormal;
                out vec2 vUv;

                void main() {
                  vUv = uv;
                
                  vNormal = normalize(normalMatrix * normal);
                  vCameraPosition = cameraPosition;
                  vViewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;

                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `,
            fragmentShader:/*glsl*/`
               
                precision highp float;
                out vec4 FragColor;

                in vec2 vUv;
                in vec3 vNormal;
                in vec3 vViewPosition;
                in vec3 vCameraPosition;

                uniform sampler2D uTexture;
                uniform sampler2D rTexture;
                uniform sampler2D wTexture;
                uniform float waterAlph;
                uniform float reflectionAlph;
                uniform float refractionRatio;

                uniform float uOpacity;
                uniform float u_time;


                vec3 refractVector(vec3 incident, vec3 normal, float eta) {
                    float cosi = dot(incident, normal);
                    float etai = 0.1;  // Índice de refração do ar
                    float etat = eta;  // Índice de refração da água
                    float etaT = etai / etat;
                    float k = 1.0 - etaT * etaT * (1. - cosi * cosi);
                    return etaT * incident - (etaT * cosi + sqrt(k)) * normal;
                }

                float noise(vec2 p) {
                    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
                }
                
                void main() {

                    vec2 pos = vUv * 10.0;
                    float n = noise(pos + u_time * 0.1);
                    float wave = sin(pos.x + u_time) * 0.1 + sin(pos.y + u_time * 1.5) * 0.1;
                    
                    vec3 viewDir = normalize(vCameraPosition - vViewPosition);
                  
                    vec3 refracted = refractVector(viewDir, vNormal, refractionRatio);

                    vec4 refractedColor = texture2D(rTexture, vUv +  refracted.xy * 0.1); 

                    vec4 reflectedColor = texture2D(uTexture, vUv);
                    vec2 uvOffset = sin(vUv + u_time*0.02 ) + sin(fract(u_time*0.02));  
                    vec4 waterColor = texture2D(wTexture, uvOffset);

                    // Depois, mistura o resultado com texture3
                    vec4 finalColor = mix(waterColor, reflectedColor, waterAlph);
                    finalColor = mix(finalColor, refractedColor, reflectionAlph);
                    vec3 final = finalColor.rgb + wave*0.8 + n * 0.2;
                    
                    FragColor = vec4(final.rgb, finalColor.a * uOpacity); 
                }
              `,
        });
        this.camMaterial.glslVersion = THREE.GLSL3;


        this.mirror = new THREE.Mesh(
            new THREE.BoxGeometry(10, 5, 0),
            this.camMaterial
        );
        this.mirror.position.set(0, 2, 0);

        this.scene_.add(this.mirror);


        const meshes = [plane, this.sphere, this.box, this.mirror];

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

        light = new THREE.AmbientLight(0x404040);
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

        const ao = mapLoader.load('resources/freepbr/' + name + 'ao.png');
        roughnessMap.anisotropy = maxAnisotropy;
        roughnessMap.wrapS = THREE.RepeatWrapping;
        roughnessMap.wrapT = THREE.RepeatWrapping;
        roughnessMap.repeat.set(tiling, tiling);

        const material = new THREE.MeshStandardMaterial({
            metalnessMap: metalMap,
            map: albedo,
            normalMap: normalMap,
            aoMap: ao,
            roughnessMap: roughnessMap,
            displacementMap: displacementMap,
            lightMap: lightMap
        });

        return material;
    }

    updateTexture() {

    }

    loadMaterialJpg_(name, tiling) {
        const mapLoader = new THREE.TextureLoader();
        const maxAnisotropy = this.renderer_.capabilities.getMaxAnisotropy();

        const albedo = mapLoader.load('resources/freepbr/' + name + 'albedo.jpg');
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
            map: albedo,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            displacementMap: displacementMap,
            lightMap: lightMap
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

        // this.refractCamera_.aspect = window.innerWidth / window.innerHeight;
        // this.refractCamera_.updateProjectionMatrix();

        this.uiCamera_.left = -this.camera_.aspect;
        this.uiCamera_.right = this.camera_.aspect;
        this.uiCamera_.updateProjectionMatrix();

        this.renderer_.setSize(window.innerWidth, window.innerHeight);
    }

    raf_() {
        requestAnimationFrame((t) => {
            if (this.previousRAF_ === null) {
                this.previousRAF_ = t;
            }

            this.step_(t - this.previousRAF_);
            this.renderer_.autoClear = true;
            this.mirror.visible = false;
            this.renderer_.setRenderTarget(this.renderTarget_);
            this.renderer_.render(this.scene_, this.mirrorCamera_);
            this.renderer_.setRenderTarget(this.refractRenderTarget_);
            this.renderer_.render(this.scene_, this.refractCamera_);
            this.mirror.visible = true;
            this.renderer_.setRenderTarget(null);
            this.renderer_.render(this.scene_, this.camera_);
            this.renderer_.autoClear = false;
            this.renderer_.render(this.uiScene_, this.uiCamera_);
            this.previousRAF_ = t;
            this.raf_();
        });
    }

    rotateOBj(timeElapsedS) {

        this.sphere.rotation.y += timeElapsedS;
        this.sphere.rotation.x += timeElapsedS;

        this.box.rotation.y += timeElapsedS;
        this.box.rotation.x += timeElapsedS;

    }
    step_(timeElapsed) {
        const timeElapsedS = timeElapsed * 0.001;

        this.fpsCamera_.update(timeElapsedS);
        this.mirrorCamera_.lookAt(this.camera_.position);

        this.camMaterial.uniforms.u_time.value += timeElapsedS;

        const distancia = 50;

        // Obtenha a posição da câmera
        const cameraPosition = this.camera_.position.clone();

        // Obtenha a direção que a câmera está olhando (em coordenadas globais)
        const cameraDirection = new THREE.Vector3();
        this.camera_.getWorldDirection(cameraDirection);

        this.shadow.position.copy(cameraPosition).add(cameraDirection.multiplyScalar(distancia));
        const backPosition = new THREE.Vector3(this.camera_.position['x'] * - 1500, this.camera_.position['y'] * - 1500, this.camera_.position['z'] * -1500);

        this.refractCamera_.lookAt(this.shadow.position);

        this.rotateOBj(timeElapsedS);

    }
}
let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new FirstPersonCameraFps();
});
