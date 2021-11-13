import * as THREE from 'three';
import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from '../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { Tween } from "@tweenjs/tween.js";
import {TWEEN} from "three/examples/jsm/libs/tween.module.min";

window.addEventListener("load", () => {
    const wScene = new WindmillScene()
    wScene.init()
    console.log(wScene.props)
})


class WindmillScene {
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
    #models = {
        gltfModels: {}
    }
    #lights = {}
    #compass

    constructor() {
        this.#canvas = document.createElement("canvas")
        this.#canvas.style.cssText = 'width: 100%; height: 100%;'

        this.#scene = new THREE.Scene()
        this.#scene.background = new THREE.Color(0x000000)

        // camera
        this.#fov = 45
        this.#aspect = window.outerWidth / window.outerHeight
        this.#near = 0.1
        this.#far = 15000
        this.#camera = new THREE.PerspectiveCamera(this.#fov, this.#aspect, this.#near, this.#far)
        this.#camera.position.set(0, 1000, 1500)


        // light
        this.#lights.ambientLight = new THREE.AmbientLight(0xFFFFFF, 1)
        this.#scene.add(this.#lights.ambientLight)

        const canvas = this.#canvas
        this.#renderer = new THREE.WebGLRenderer({canvas})

        // loaders
        this.#loaders.gltfLoader = new GLTFLoader()
        // this.#loaders.textureLoader = new TextureLoader()


        // Controls
        this.#controls = new OrbitControls(this.#camera, this.#canvas)
        this.#controls.target.set(0, 0, 0)
        this.#controls.enableDamping = true
        this.#controls.minPolarAngle = - Math.PI
        this.#controls.maxPolarAngle = 1.39626 // = 80 degrees
        this.#controls.minAzimuthAngle = - Infinity
        this.#controls.maxAzimuthAngle = Infinity
        this.#controls.minDistance = 20
        this.#controls.maxDistance = 7000
        this.#controls.update();

        // тестовая геометрия
        const cubeSize = 4;
        const cubeGeo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize)
        const cubeMat = new THREE.MeshPhongMaterial({color: '#8AC'})
        const mesh = new THREE.Mesh(cubeGeo, cubeMat)
        mesh.position.set(cubeSize + 1, cubeSize / 2, 0)
        this.#scene.add(mesh)
        //
    }

    get props() {
        return {
            canvas: this.#canvas,
            interface: {
              compass: this.#compass,
            },
            threejsProps: {
                scene: this.#scene,
                renderer: this.#renderer,
                camera: this.#camera,
                loaders: this.#loaders,
                models: this.#models,
                lights: this.#lights
            },
        }
    }

    init(locationId) {

        this.#sceneEnvironmentCreation(locationId)

        this.#load('../static/models/map.glb', 'gltf', function (gltf) {
            this.#models.gltfModels.map = gltf
            this.#load('../static/textures/map3588x2392.jpg', 'texture', function (texture) {
                gltf.scene.children[0].material.map = texture
                this.#scene.add(gltf.scene)
            }.bind(this))
        }.bind(this))

        this.#compassLogic()

        this.#render()
    }

    #sceneEnvironmentCreation(locationId) {
        const location = document.querySelector(locationId ? '#' + locationId : "body")

        // scene
        const windmillScene = document.createElement('div')
        windmillScene.classList.add('windmill-scene')
        windmillScene.style.cssText = 'position: relative; width: 100vw; height: 100vh;'
        windmillScene.append(this.#canvas)

        // compass
        const compass = `
            <svg id="compass" style="width: 2rem; height: 2rem; cursor: pointer;" width="496" height="512" viewBox="0 0 496 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M143.377 271.865L221.902 482.59C228.615 503.05 262.682 508.06 274.405 482.59L352.93 271.865C354.828 266.769 355.778 261.416 355.778 256.064L293.402 256.064C293.402 281.053 273.143 301.313 248.153 301.313C223.164 301.313 202.904 281.053 202.904 256.064L140.529 256.064C140.529 261.416 141.479 266.769 143.377 271.865Z" fill="#C6492D"/>
                <path d="M221.902 29.538L143.377 240.263C141.479 245.359 140.529 250.711 140.529 256.064H202.905C202.905 231.075 223.164 210.815 248.154 210.815C273.143 210.815 293.403 231.075 293.403 256.064L355.778 256.064C355.778 250.711 354.829 245.359 352.93 240.263L274.405 29.538C265.337 5.2201 230.97 5.22013 221.902 29.538Z" fill="#2D95C6"/>
            </svg>
        `
        const controlElements = document.createElement('div')
        controlElements.classList.add('control-elements')
        controlElements.style.cssText = 'position: absolute; bottom: 2rem; right: 2rem;'

        controlElements.innerHTML = compass
        windmillScene.append(controlElements)
        this.#compass = controlElements.querySelector('#compass')

        location.append(windmillScene)
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
            console.log(this.#camera.position)
        }.bind(this))

        this.#compass.addEventListener('click', function () {
            const cameraStartPositionVector = this.#camera.position
            const cameraEndPositionVector = new THREE.Vector3(this.#camera.position.x, 5000, this.#camera.position.z)
            // todo: Разобраться с подлетом камеры по нужной траектории, чтобы было красиво
            this.cameraTween = new TWEEN.Tween(cameraStartPositionVector)
                .to(cameraEndPositionVector, zoomingTime)
                .onUpdate(() => {
                    this.#camera.position.set(0, cameraStartPositionVector.y, 0)
                })
                .easing(TWEEN.Easing.Quadratic.InOut)
                .start()
        }.bind(this))
    }

    #render() {
        requestAnimationFrame(function animate() {
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
            /**/

            this.#controls.update();
            this.#renderer.render(this.#scene, this.#camera)
            requestAnimationFrame(animate.bind(this))
        }.bind(this))
    }

    #load(url, type = 'gltf', cb) {
        if (type === 'gltf') {
            this.#loaders.gltfLoader.load(url, cb)
        } else if (type === 'texture') {
            THREE.ImageUtils.loadTexture(url, undefined, cb)
        }
    }
}
