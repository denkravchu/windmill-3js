import * as THREE from 'three';
import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from './OrbitControls.js';

import {TWEEN} from "three/examples/jsm/libs/tween.module.min";

window.addEventListener("load", () => {
    const wScene = new WindmillScene()
    wScene.init()
    console.log(wScene.props)
})


class WindmillScene {
    #windowWidth // todo    Использовать для другой настройки контроллера на мобилке
    #canvas
    #scene
    #fov
    #aspect
    #near
    #far
    #camera
    #renderer
    #controls
    #loaders = {}
    #models = { }
    #textures = {}
    #lights = {}
    #controlElements = {move: {}, rotate: {}}
    #map = {}
    #windmill = {}
    #compass
    #builtWindmills = []
    #hoverWindmill = { object: null, stateActive: false }
    #raycaster
    #mouseVector
    #raycasterIntersects
    #hoverWindmillCoords

    constructor() {
        this.#windowWidth = window.outerWidth

        this.#canvas = document.createElement("canvas")
        this.#canvas.style.cssText = 'width: 100%; height: 100%; position: absolute; bottom: 0; right: 0;'

        this.#scene = new THREE.Scene()
        this.#scene.background = new THREE.Color(0x06131B)

        // camera
        this.#fov = 45
        this.#aspect = window.outerWidth / window.outerHeight
        this.#near = 0.1
        this.#far = 15000
        this.#camera = new THREE.PerspectiveCamera(this.#fov, this.#aspect, this.#near, this.#far)
        this.#camera.position.set(0, 1000, 1500)


        // light
        this.#lights.directionalLight = new THREE.DirectionalLight( 0xFFFAEF, 1)
        this.#lights.directionalLight.position.set(1500, 1500, 1500)
        this.#lights.directionalLight.castShadow = true
        const shadowCameraSize = 2000
        this.#lights.directionalLight.shadow.camera.left = -shadowCameraSize
        this.#lights.directionalLight.shadow.camera.right = shadowCameraSize
        this.#lights.directionalLight.shadow.camera.top = shadowCameraSize
        this.#lights.directionalLight.shadow.camera.bottom = -shadowCameraSize
        this.#lights.directionalLight.shadow.mapSize.width = 2000
        this.#lights.directionalLight.shadow.mapSize.height = 2000
        this.#lights.directionalLight.shadow.camera.near = 0.5
        this.#lights.directionalLight.shadow.camera.far = 4000
        this.#scene.add(this.#lights.directionalLight)
        this.#lights.pointLight1 = new THREE.PointLight(0xFFFAEF, 0.5)
        this.#lights.pointLight2 = new THREE.PointLight(0xFFFAEF, 0.5)
        this.#lights.pointLight3 = new THREE.PointLight(0xFFFAEF, 0.5)
        this.#lights.pointLight1.position.set(-30000, 50000, 30000)
        this.#lights.pointLight2.position.set(-30000, 50000, -30000)
        this.#lights.pointLight3.position.set(30000, 50000, -30000)
        this.#scene.add(this.#lights.pointLight1)
        this.#scene.add(this.#lights.pointLight2)
        this.#scene.add(this.#lights.pointLight3)

        // const helper = new THREE.CameraHelper( this.#lights.directionalLight.shadow.camera );
        // this.#scene.add( helper );

        this.#renderer = new THREE.WebGLRenderer({canvas: this.#canvas})
        this.#renderer.shadowMap.enabled = true
        this.#renderer.shadowMap.type = THREE.PCFSoftShadowMap

        // loaders
        this.#loaders.gltfLoader = new GLTFLoader()
        // this.#loaders.textureLoader = new TextureLoader()


        // Controls
        this.#controls = new OrbitControls(this.#camera, this.#canvas)
        this.#controls.target.set(0, 0, 0)
        this.#controls.enableDamping = true
        this.#controls.enablePan = false
        this.#controls.panSpeed = 2
        this.#controls.screenSpacePanning = false
        this.#controls.minPolarAngle = - Math.PI
        this.#controls.maxPolarAngle = 1.39626 // = 80 degrees
        this.#controls.minAzimuthAngle = - Infinity
        this.#controls.maxAzimuthAngle = Infinity
        this.#controls.minDistance = 20
        this.#controls.maxDistance = 3000
        this.#controls.update()

        // for events
        this.#raycaster = new THREE.Raycaster()
        this.#mouseVector = new THREE.Vector2()
    }

    get props() {
        return {
            canvas: this.#canvas,
            interface: {
                controlElements: this.#controlElements,
                map: this.#map,
                windmill: this.#windmill,
                compass: this.#compass,
            },
            threejs: {
                scene: this.#scene,
                renderer: this.#renderer,
                camera: this.#camera,
                loaders: this.#loaders,
                models: this.#models,
                lights: this.#lights,
                raycaster: this.#raycaster,
                mouseVector: this.#mouseVector,
                raycasterIntersects: this.#raycasterIntersects,
            },
        }
    }
    init(locationId) {
        this.#sceneInterfaceGeneration(locationId)

        this.#load('../static/models/map.glb', 'gltf', function (gltf) {
            this.#models.map = gltf
            this.#models.map.scene.children[0].material.roughness = 1
            this.#models.map.scene.children[0].receiveShadow = true
            this.#models.map.scene.children[0].name = 'plane'

            this.#load('../static/textures/map3588x2392.jpg', 'texture', function (texture) {
                this.#textures.map = texture
                gltf.scene.children[0].material.map = texture
                this.#scene.add(gltf.scene)
            }.bind(this))
        }.bind(this))
        this.#load('../static/textures/map3588x2392_black.jpg', 'texture', function (texture) {
            this.#textures.mapBlack = texture
        }.bind(this))
        this.#load('../static/models/wind.glb', 'gltf', function (gltf) {
            this.#models.windmill = gltf
            this.#models.windmill.scene.children[0].castShadow = true
            this.#models.windmill.scene.children[0].name = 'windmill'
            this.#models.windmill.scene.children[0].material.color.setHex(0x2D95C6)

            // creating transparent windmill for hover
            this.#hoverWindmill.object = this.#models.windmill.scene.clone()
            this.#hoverWindmill.object.children[0].name = 'hoverWindmill'
            this.#hoverWindmill.object.children[0].material = this.#hoverWindmill.object.children[0].material.clone()
            this.#hoverWindmill.object.children[0].material.transparent = true
            this.#hoverWindmill.object.children[0].material.opacity = 0.5
            console.log(this.#hoverWindmill.object)
        }.bind(this))

        this.#sceneInterfaceLogic()
        this.#render()
    }
    #sceneInterfaceGeneration(locationId) {
        const location = document.querySelector(locationId ? '#' + locationId : "body")

        // scene
        const windmillScene = document.createElement('div')
        windmillScene.classList.add('windmill-scene')
        windmillScene.style.cssText = 'position: relative; width: 100vw; height: 100vh;'
        windmillScene.append(this.#canvas)

        // buttons
        const compass = `
            <svg id="compass" style="width: 2em; height: 2em; cursor: pointer;" width="496" height="512" viewBox="0 0 496 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M143.377 271.865L221.902 482.59C228.615 503.05 262.682 508.06 274.405 482.59L352.93 271.865C354.828 266.769 355.778 261.416 355.778 256.064L293.402 256.064C293.402 281.053 273.143 301.313 248.153 301.313C223.164 301.313 202.904 281.053 202.904 256.064L140.529 256.064C140.529 261.416 141.479 266.769 143.377 271.865Z" fill="#C6492D"/>
                <path d="M221.902 29.538L143.377 240.263C141.479 245.359 140.529 250.711 140.529 256.064H202.905C202.905 231.075 223.164 210.815 248.154 210.815C273.143 210.815 293.403 231.075 293.403 256.064L355.778 256.064C355.778 250.711 354.829 245.359 352.93 240.263L274.405 29.538C265.337 5.2201 230.97 5.22013 221.902 29.538Z" fill="#2D95C6"/>
            </svg>
        `
        const move = `
            <svg id="move" style="width: 4em; height: 4em; cursor: pointer;  transition: opacity .15s;  opacity: 0.8;" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 28C0 14.8007 0 8.20101 4.10051 4.10051C8.20101 0 14.8007 0 28 0H36C49.1993 0 55.799 0 59.8995 4.10051C64 8.20101 64 14.8007 64 28V36C64 49.1993 64 55.799 59.8995 59.8995C55.799 64 49.1993 64 36 64H28C14.8007 64 8.20101 64 4.10051 59.8995C0 55.799 0 49.1993 0 36V28Z" fill="#1B1B1B"/>
                <path d="M25.2658 20.3989C25.5783 20.7111 26.0019 20.8864 26.4436 20.8864C26.8853 20.8864 27.309 20.7111 27.6215 20.3989L30.3328 17.6876V24.777C30.3328 25.2191 30.5084 25.6431 30.821 25.9556C31.1336 26.2682 31.5576 26.4438 31.9996 26.4438C32.4417 26.4438 32.8656 26.2682 33.1782 25.9556C33.4908 25.6431 33.6664 25.2191 33.6664 24.777V17.6876L36.3777 20.3989C36.5303 20.5627 36.7143 20.694 36.9188 20.7851C37.1233 20.8762 37.344 20.9252 37.5678 20.9292C37.7916 20.9331 38.0139 20.8919 38.2214 20.8081C38.429 20.7243 38.6175 20.5995 38.7758 20.4412C38.9341 20.283 39.0588 20.0944 39.1427 19.8869C39.2265 19.6793 39.2677 19.457 39.2637 19.2332C39.2598 19.0094 39.2108 18.7887 39.1197 18.5843C39.0286 18.3798 38.8972 18.1958 38.7335 18.0432L33.1775 12.4872C32.865 12.1751 32.4413 11.9998 31.9996 11.9998C31.5579 11.9998 31.1343 12.1751 30.8218 12.4872L25.2658 18.0432C24.9536 18.3557 24.7783 18.7794 24.7783 19.2211C24.7783 19.6628 24.9536 20.0864 25.2658 20.3989V20.3989Z" fill="white"/>
                <path d="M20.3987 27.6217C20.6931 27.3057 20.8534 26.8878 20.8458 26.456C20.8382 26.0242 20.6632 25.6122 20.3578 25.3068C20.0525 25.0014 19.6405 24.8265 19.2086 24.8189C18.7768 24.8112 18.3589 24.9715 18.0429 25.266L12.487 30.8219C12.1748 31.1345 11.9995 31.5581 11.9995 31.9998C11.9995 32.4415 12.1748 32.8651 12.487 33.1777L18.0429 38.7336C18.3589 39.0281 18.7768 39.1883 19.2086 39.1807C19.6405 39.1731 20.0525 38.9982 20.3578 38.6928C20.6632 38.3874 20.8382 37.9754 20.8458 37.5436C20.8534 37.1118 20.6931 36.6939 20.3987 36.3779L17.6874 33.6666H24.7768C25.2189 33.6666 25.6428 33.491 25.9554 33.1784C26.268 32.8658 26.4436 32.4419 26.4436 31.9998C26.4436 31.5577 26.268 31.1338 25.9554 30.8212C25.6428 30.5086 25.2189 30.333 24.7768 30.333H17.6874L20.3987 27.6217V27.6217Z" fill="white"/>
                <path d="M43.6011 25.2659C43.9136 24.9538 44.3372 24.7784 44.7789 24.7784C45.2206 24.7784 45.6443 24.9538 45.9568 25.2659L51.5128 30.8219C51.8249 31.1344 52.0002 31.558 52.0002 31.9997C52.0002 32.4414 51.8249 32.8651 51.5128 33.1776L45.9568 38.7336C45.8042 38.8973 45.6202 39.0287 45.4157 39.1198C45.2113 39.2109 44.9905 39.2599 44.7667 39.2638C44.5429 39.2678 44.3206 39.2266 44.1131 39.1428C43.9056 39.059 43.717 38.9342 43.5587 38.7759C43.4005 38.6176 43.2757 38.4291 43.1919 38.2215C43.108 38.014 43.0669 37.7917 43.0708 37.5679C43.0748 37.3441 43.1237 37.1234 43.2148 36.9189C43.3059 36.7145 43.4373 36.5304 43.6011 36.3779L46.3124 33.6665H39.2229C38.7809 33.6665 38.3569 33.4909 38.0443 33.1783C37.7318 32.8658 37.5562 32.4418 37.5562 31.9997C37.5562 31.5577 37.7318 31.1337 38.0443 30.8211C38.3569 30.5086 38.7809 30.333 39.2229 30.333H46.3124L43.6011 27.6216C43.2889 27.3091 43.1136 26.8855 43.1136 26.4438C43.1136 26.0021 43.2889 25.5784 43.6011 25.2659V25.2659Z" fill="white"/>
                <path d="M30.3328 46.3121L27.6214 43.6008C27.3055 43.3064 26.8876 43.1461 26.4557 43.1537C26.0239 43.1613 25.6119 43.3363 25.3066 43.6417C25.0012 43.947 24.8262 44.359 24.8186 44.7909C24.811 45.2227 24.9713 45.6406 25.2657 45.9565L30.8217 51.5125C31.1342 51.8247 31.5578 52 31.9996 52C32.4413 52 32.8649 51.8247 33.1774 51.5125L38.7334 45.9565C38.8972 45.804 39.0285 45.6199 39.1196 45.4155C39.2107 45.211 39.2597 44.9903 39.2636 44.7665C39.2676 44.5427 39.2264 44.3204 39.1426 44.1129C39.0588 43.9053 38.934 43.7168 38.7757 43.5585C38.6174 43.4002 38.4289 43.2754 38.2214 43.1916C38.0138 43.1078 37.7915 43.0666 37.5677 43.0706C37.3439 43.0745 37.1232 43.1235 36.9187 43.2146C36.7143 43.3057 36.5303 43.437 36.3777 43.6008L33.6663 46.3121V39.2227C33.6663 38.7806 33.4907 38.3567 33.1782 38.0441C32.8656 37.7315 32.4416 37.5559 31.9996 37.5559C31.5575 37.5559 31.1335 37.7315 30.821 38.0441C30.5084 38.3567 30.3328 38.7806 30.3328 39.2227V46.3121V46.3121Z" fill="white"/>
            </svg>
        `
        const rotate = `
            <svg id="rotate" style="width: 4em; height: 4em; cursor: pointer; opacity: .4; margin-top: 1em;  transition: opacity .15s;" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 28C0 14.8007 0 8.20101 4.10051 4.10051C8.20101 0 14.8007 0 28 0H36C49.1993 0 55.799 0 59.8995 4.10051C64 8.20101 64 14.8007 64 28V36C64 49.1993 64 55.799 59.8995 59.8995C55.799 64 49.1993 64 36 64H28C14.8007 64 8.20101 64 4.10051 59.8995C0 55.799 0 49.1993 0 36V28Z" fill="#1B1B1B"/>
                <path d="M28.7376 15.5959C29.7604 15.1238 30.8734 14.8793 31.9999 14.8793C33.1264 14.8793 34.2394 15.1238 35.2622 15.5959L45.6293 20.3793C46.208 20.6466 46.6981 21.0741 47.0413 21.6113C47.3846 22.1485 47.5667 22.7728 47.5662 23.4102V27.5464H45.3424C44.6215 27.5458 43.9197 27.7789 43.3423 28.2106C42.7649 28.6423 42.3429 29.2495 42.1395 29.9413C41.9362 30.633 41.9624 31.3719 42.2143 32.0475C42.4662 32.723 42.9302 33.2988 43.5368 33.6885C40.7282 35.314 36.6765 36.4415 31.9977 36.4415C27.3211 36.4415 23.2694 35.314 20.4608 33.6862C21.0678 33.2972 21.5323 32.7218 21.7846 32.0465C22.0369 31.3711 22.0635 30.6321 21.8603 29.9404C21.6571 29.2487 21.2351 28.6415 20.6576 28.2098C20.0802 27.7782 19.3783 27.5454 18.6574 27.5464H16.4336V23.4102C16.4331 22.7728 16.6152 22.1485 16.9585 21.6113C17.3018 21.0741 17.7918 20.6466 18.3705 20.3793L28.7376 15.5959V15.5959ZM24.6548 24.2997C24.3835 24.1836 24.0772 24.1799 23.8032 24.2896C23.5292 24.3993 23.31 24.6133 23.1938 24.8846C23.0776 25.1559 23.074 25.4622 23.1837 25.7362C23.2933 26.0102 23.5074 26.2294 23.7787 26.3456L30.888 29.3922V33.1058C30.888 33.4007 31.0052 33.6835 31.2137 33.8921C31.4222 34.1006 31.705 34.2177 31.9999 34.2177C32.2948 34.2177 32.5776 34.1006 32.7861 33.8921C32.9946 33.6835 33.1118 33.4007 33.1118 33.1058V29.3922L40.2211 26.3456C40.3555 26.2881 40.4772 26.2047 40.5792 26.1001C40.6813 25.9955 40.7618 25.8719 40.8161 25.7362C40.8705 25.6006 40.8975 25.4555 40.8958 25.3094C40.894 25.1633 40.8635 25.0189 40.806 24.8846C40.7485 24.7503 40.665 24.6286 40.5605 24.5265C40.4559 24.4244 40.3323 24.3439 40.1966 24.2896C40.0609 24.2353 39.9159 24.2082 39.7698 24.21C39.6237 24.2117 39.4793 24.2422 39.345 24.2997L31.9999 27.4486L24.6548 24.2997Z" fill="white"/>
                <path d="M44.2308 30.882C44.2308 30.5871 44.348 30.3043 44.5565 30.0958C44.765 29.8873 45.0478 29.7701 45.3427 29.7701H50.9021C51.197 29.7701 51.4798 29.8873 51.6883 30.0958C51.8969 30.3043 52.014 30.5871 52.014 30.882V36.4414C52.014 36.7363 51.8969 37.0191 51.6883 37.2276C51.4798 37.4362 51.197 37.5533 50.9021 37.5533C50.6072 37.5533 50.3244 37.4362 50.1159 37.2276C49.9074 37.0191 49.7902 36.7363 49.7902 36.4414V34.2621C49.1282 35.036 48.3824 35.7341 47.5665 36.3436C47.1104 36.6876 46.6376 37.0089 46.15 37.3065C42.5297 39.5191 37.5262 40.8867 31.9979 40.8867C26.4719 40.8867 21.4684 39.5191 17.8459 37.3065C17.3599 37.0102 16.8886 36.6904 16.4338 36.348C15.6181 35.7392 14.8723 35.0419 14.2101 34.2688V36.4414C14.2101 36.7363 14.0929 37.0191 13.8844 37.2276C13.6759 37.4362 13.3931 37.5533 13.0982 37.5533C12.8033 37.5533 12.5205 37.4362 12.312 37.2276C12.1035 37.0191 11.9863 36.7363 11.9863 36.4414V30.882C11.9863 30.5871 12.1035 30.3043 12.312 30.0958C12.5205 29.8873 12.8033 29.7701 13.0982 29.7701H18.6576C18.9525 29.7701 19.2353 29.8873 19.4438 30.0958C19.6523 30.3043 19.7695 30.5871 19.7695 30.882C19.7695 31.1769 19.6523 31.4597 19.4438 31.6682C19.2353 31.8768 18.9525 31.9939 18.6576 31.9939H15.2775C15.5933 32.4742 15.978 32.9479 16.4338 33.4104C16.7051 33.684 16.9987 33.953 17.3211 34.2177C17.7881 34.6024 18.3107 34.976 18.8889 35.3362L19.0067 35.4096C19.9185 35.9655 20.9459 36.4726 22.0644 36.9062C24.8797 38.0047 28.2865 38.663 31.9979 38.663C35.7116 38.663 39.1206 38.0025 41.9381 36.9062C42.9979 36.498 44.0196 35.9972 44.9914 35.4096C45.614 35.0271 46.1766 34.6291 46.677 34.2177C46.9994 33.9508 47.2952 33.6795 47.5665 33.406C48.0224 32.9457 48.4048 32.472 48.7184 31.9939H45.3427C45.0478 31.9939 44.765 31.8768 44.5565 31.6682C44.348 31.4597 44.2308 31.1769 44.2308 30.882Z" fill="white"/>
                <path d="M31.9999 43.1127C26.0736 43.1127 20.5186 41.625 16.4336 39.0476V40.5776C16.4335 41.2147 16.6158 41.8385 16.9591 42.3752C17.3023 42.912 17.7921 43.3392 18.3705 43.6063L28.7376 48.3896C29.7604 48.8618 30.8734 49.1063 31.9999 49.1063C33.1264 49.1063 34.2394 48.8618 35.2622 48.3896L45.6293 43.6063C46.2077 43.3392 46.6975 42.912 47.0407 42.3752C47.384 41.8385 47.5663 41.2147 47.5662 40.5776V39.0454C43.4812 41.625 37.924 43.1127 31.9999 43.1127Z" fill="white"/>
            </svg>
        `
        const map = `
            <svg id="map" style="width: 4em; height: 4em; cursor: pointer; margin-top: 3em;" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<!--                <path d="M0 28C0 14.8007 0 8.20101 4.10051 4.10051C8.20101 0 14.8007 0 28 0H36C49.1993 0 55.799 0 59.8995 4.10051C64 8.20101 64 14.8007 64 28V36C64 49.1993 64 55.799 59.8995 59.8995C55.799 64 49.1993 64 36 64H28C14.8007 64 8.20101 64 4.10051 59.8995C0 55.799 0 49.1993 0 36V28Z" fill="transparent"/>-->
                <path style="transition: fill .15s" d="M26 21.7234L12 14.7234V41.1954L26 48.1954L38 42.1954L52 49.1954V22.7234L38 15.7234L26 21.7234ZM38 37.9594L26 43.9594V25.9594L38 19.9594V37.9594Z" fill="white"/>
            </svg>
        `
        const windmill = `
            <svg id="windmill" style="width: 4em; height: 4em; cursor: pointer;  margin-top: 1em;" width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
<!--                <path d="M0 28C0 14.8007 0 8.20101 4.10051 4.10051C8.20101 0 14.8007 0 28 0H36C49.1993 0 55.799 0 59.8995 4.10051C64 8.20101 64 14.8007 64 28V36C64 49.1993 64 55.799 59.8995 59.8995C55.799 64 49.1993 64 36 64H28C14.8007 64 8.20101 64 4.10051 59.8995C0 55.799 0 49.1993 0 36V28Z" fill="transparent"/>-->
                <path style="transition: fill .15s" d="M27.5271 25.3333L20.1197 32.7407L23.0826 35.7037L30.49 28.2963V26.8148L31.9715 25.3333L33.453 26.8148V28.2963L40.8604 35.7037L43.8233 32.7407L36.4159 25.3333H34.9345L33.453 23.8519L34.9345 22.3704H36.4159L43.8233 14.963L40.8604 12L33.453 19.4074V20.8889L31.9715 22.3704L30.49 20.8889V19.4074L23.0826 12L20.1197 14.963L27.5271 22.3704H29.0085L30.49 23.8519L29.0085 25.3333H27.5271ZM43.8233 49.037H40.8604L37.8974 37.1852L31.9715 31.2593L26.0456 37.1852L23.0826 49.037H20.1197C19.7268 49.037 19.3499 49.1931 19.0721 49.471C18.7943 49.7488 18.6382 50.1256 18.6382 50.5185C18.6382 50.9114 18.7943 51.2883 19.0721 51.5661C19.3499 51.8439 19.7268 52 20.1197 52H43.8233C44.2163 52 44.5931 51.8439 44.8709 51.5661C45.1487 51.2883 45.3048 50.9114 45.3048 50.5185C45.3048 50.1256 45.1487 49.7488 44.8709 49.471C44.5931 49.1931 44.2163 49.037 43.8233 49.037ZM33.453 49.037H30.49V44.5867C30.49 43.7719 31.1508 43.1111 31.9656 43.1111C32.7863 43.1111 33.453 43.7778 33.453 44.5985V49.037Z" fill="white"/>
            </svg>
        `

        const controlElements = document.createElement('div')
        const compassWrapper = document.createElement('div')

        controlElements.classList.add('control-elements')
        compassWrapper.classList.add('compass-wrapper')
        controlElements.style.cssText = `
            position: absolute; 
            top: 2rem; left: 2rem;
            display: flex;
            flex-direction: column;
        `
        compassWrapper.style.cssText = 'position: absolute; bottom: 2rem; right: 2rem;'
        controlElements.innerHTML = move + rotate + map + windmill
        compassWrapper.innerHTML = compass

        windmillScene.append(controlElements)
        windmillScene.append(compassWrapper)

        this.#controlElements.move.html = controlElements.querySelector('#move')
        this.#controlElements.rotate.html = controlElements.querySelector('#rotate')
        this.#map.html = controlElements.querySelector('#map')
        this.#windmill.html = controlElements.querySelector('#windmill')
        this.#compass = compassWrapper.querySelector('#compass')

        this.#controlElements.move.stateActive = false
        this.#controlElements.rotate.stateActive = true
        this.#map.stateActive = false
        this.#windmill.stateActive = false

        this.#controlElements.move.logic = this.#moveLogic
        this.#controlElements.rotate.logic = this.#rotateLogic

        location.append(windmillScene)
    }

    #sceneInterfaceLogic() {
        this.#compassLogic()
        this.#mapLogic()
        this.#windmillLogic()
        // control elements (move and rotate)
        const controlElementsArray = Object.values(this.#controlElements)
        controlElementsArray.forEach(controlElement => {
            controlElement.html.addEventListener('click', function () {
                if (!controlElement.stateActive) {
                    controlElementsArray.forEach(prevControlElement => {
                        if (prevControlElement.stateActive) {
                            prevControlElement.stateActive = false
                            prevControlElement.html.style.opacity = 0.8
                        }
                    })
                    controlElement.stateActive = true
                    controlElement.html.style.opacity = 0.2
                    controlElement.logic.call(this)
                }
            }.bind(this))
        })
    }
    #moveLogic() {
        this.#controls.enablePan = true
        this.#controls.enableRotate = false
        this.#controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
        }
        // this.#controls.touches = {
        //     ONE: THREE.MOUSE.PAN
        // }
    }
    #rotateLogic() {
        this.#controls.enablePan = false
        this.#controls.enableRotate = true
        this.#controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
        }
        // this.#controls.touches = {
        //     ONE: THREE.TOUCH.ROTATE,
        // }
    }
    #mapLogic() {
        this.#map.html.addEventListener('click', function () {
            if (!this.#map.stateActive) {
                this.#models.map.scene.children[0].material.map = this.#textures.mapBlack
                this.#map.html.querySelector('path').style.fill = '#2D95C6'
                this.#map.stateActive = true
                return
            }
            this.#models.map.scene.children[0].material.map = this.#textures.map
            this.#map.html.querySelector('path').style.fill = '#FFFFFF'
            this.#map.stateActive = false
        }.bind(this))
    }
    #windmillLogic() {
        let windmillMousemoveEvent, windmillClickEvent
        this.#windmill.html.addEventListener('click', function () {
            if (!this.#windmill.stateActive) {
                this.#scene.add(this.#hoverWindmill.object)
                this.#hoverWindmill.stateActive = true

                this.#canvas.addEventListener('mousemove', mousemoveHandler)
                this.#canvas.addEventListener('click', mouseclickHandler)

                this.#windmill.html.querySelector('path').style.fill = '#2D95C6'
                this.#windmill.stateActive = true
                return
            }

            this.#canvas.removeEventListener('mousemove', mousemoveHandler)
            this.#canvas.removeEventListener('click', mouseclickHandler)
            this.#scene.remove(this.#hoverWindmill.object)
            this.#hoverWindmill.stateActive = false
            this.#windmill.html.querySelector('path').style.fill = '#FFFFFF'
            this.#windmill.stateActive = false
        }.bind(this))

        const mousemoveHandler = function(e) {
            this.#mouseVector.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.#mouseVector.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.#raycasterIntersects.forEach(intersection => {
                if (intersection.object.name === 'plane') {
                    this.#hoverWindmillCoords = intersection.point
                    this.#hoverWindmill.object.position.set(this.#hoverWindmillCoords.x, this.#hoverWindmillCoords.y, this.#hoverWindmillCoords.z)
                }
            })
        }.bind(this)
        const mouseclickHandler = function() {
            const windmill = this.#models.windmill.scene.clone()
            windmill.position.set(this.#hoverWindmillCoords.x, this.#hoverWindmillCoords.y, this.#hoverWindmillCoords.z)
            this.#scene.add(windmill)
        }.bind(this)
    }
    #compassLogic() {
        const zoomingTime = 800
        this.#controls.addEventListener('change', function () {
            const cameraLookingVector = new THREE.Vector3()
            this.#camera.getWorldDirection(cameraLookingVector)
            const cameraLookingSpherical = new THREE.Spherical()
            cameraLookingSpherical.setFromVector3(cameraLookingVector)
            const rotationAroundY = THREE.Math.radToDeg(cameraLookingSpherical.theta)
            this.#compass.style.transform = `rotate(${rotationAroundY - 180}deg)`
        }.bind(this))

        this.#compass.addEventListener('click', function () {
            const startDataObject = Math.abs(this.#camera.position.y - 3000) < 2 && Math.abs(this.#camera.position.z - 100) < 2
                ? { cpX: 0, cpY: 3000, cpZ: -100, crX: -3, crY: 0, crZ: 0, ctX: 0, ctY:0, ctZ:0 }
                : { cpX: 0, cpY: 3000, cpZ: 100, crX: -3, crY: 0, crZ: 0, ctX: 0, ctY:0, ctZ:0 }
            const endDataObject = {
                cpX: this.#camera.position.x,
                cpY: this.#camera.position.y,
                cpZ: this.#camera.position.z,
                crX: this.#camera.rotation.x,
                crY: this.#camera.rotation.y,
                crZ: this.#camera.rotation.z,
                ctX: this.#controls.target.x,
                ctY: this.#controls.target.y,
                ctZ: this.#controls.target.z
            }

            this.cameraTween = new TWEEN.Tween(endDataObject)
                .to(startDataObject, zoomingTime)
                .onUpdate(() => {
                    // console.log(endDataObject)
                    this.#camera.position.set(endDataObject.cpX, endDataObject.cpY, endDataObject.cpZ)
                    this.#camera.rotation.set(endDataObject.crX, endDataObject.crY, endDataObject.crZ) // there is a problem with rotation, and i dont know why it doesnt work smooth ;( // i just fixed it with help of z = -100 in camera.rotation but its a bad solution
                    this.#controls.target.set(endDataObject.ctX, endDataObject.ctY, endDataObject.ctZ)
                    this.#controls.update()
                })
                .easing(TWEEN.Easing.Quadratic.InOut)
                .start()
        }.bind(this))
    }

    #render() {
        requestAnimationFrame(function animate() {
            this.#windowWidth = window.outerWidth

            const width = this.#canvas.clientWidth
            const height = this.#canvas.clientHeight
            const needResize = this.#canvas.width !== window.outerWidth || this.#canvas.height !== window.outerHeight

            if (needResize) {
                this.#renderer.setSize(width, height, false)
                this.#aspect = this.#canvas.clientWidth / this.#canvas.clientHeight
                this.#camera.aspect = this.#aspect
                this.#camera.updateProjectionMatrix()
            }

            /*addition elements to render*/
            TWEEN.update()
            this.#raycasterIntersection()
            /**/

            this.#controls.update();
            this.#renderer.render(this.#scene, this.#camera)
            requestAnimationFrame(animate.bind(this))
        }.bind(this))
    }
    #raycasterIntersection() {
        if (this.#hoverWindmill.stateActive) {
            // it is working only when "windmill" button is active
            this.#raycaster.setFromCamera(this.#mouseVector, this.#camera);
            // warning: eat so much cpu
            this.#raycasterIntersects = this.#raycaster.intersectObjects(this.#scene.children);
        }
    }
    #load(url, type = 'gltf', cb) {
        if (type === 'gltf') {
            this.#loaders.gltfLoader.load(url, cb)
        } else if (type === 'texture') {
            THREE.ImageUtils.loadTexture(url, undefined, cb)
        }
    }
}
