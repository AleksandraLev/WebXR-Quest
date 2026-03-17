import * as THREE from 'three';
//import * as THREE from "https://unpkg.com/three@0.183.2/build/three.module.js";
//import { ARButton } from "https://unpkg.com/three@0.183.2/examples/jsm/webxr/ARButton.js";
import { ARButton } from 'three/addons/webxr/ARButton.js';
//import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer;
let controller;

let reticle;
let hitTestSource=null;
let hitTestSourceRequested = false;

let key = null;
let chest = null;
let grabbedObject = null;

let level=1;
let collected=0;

const uiLevel=document.getElementById("level");
const uiTask=document.getElementById("task");
const uiScore=document.getElementById("score");

const soundCollect=new Audio("assets/sounds/collect.mp3");
const soundVictory=new Audio("assets/sounds/victory.mp3");

init();
animate();

function init(){

    scene=new THREE.Scene();

    camera=new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.01,20);

    renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.xr.enabled=true;

    document.body.appendChild(renderer.domElement);

    //document.body.appendChild(ARButton.createButton(renderer,{requiredFeatures:["hit-test"]}));
    document.body.appendChild(
        ARButton.createButton(renderer, {
            requiredFeatures: ["hit-test"],
            optionalFeatures: ["dom-overlay"],
            domOverlay: { root: document.body }
        })
    );
    
    const light=new THREE.HemisphereLight(0xffffff,0xbbbbff,1);
    scene.add(light);

    const geometry=new THREE.RingGeometry(0.1,0.15,32).rotateX(-Math.PI/2);
    const material=new THREE.MeshBasicMaterial({color:0x00ffff});

    reticle=new THREE.Mesh(geometry,material);
    reticle.matrixAutoUpdate=false;
    reticle.visible=false;

    scene.add(reticle);

    controller=renderer.xr.getController(0);
    controller.addEventListener("select",onSelect);

    scene.add(controller);

    window.addEventListener("click",raycastClick);
}

function spawnObject1(color){
    const geometry=new THREE.BoxGeometry(0.1,0.1,0.1);
    const material=new THREE.MeshStandardMaterial({color:color});

    const mesh=new THREE.Mesh(geometry,material);

    mesh.position.setFromMatrixPosition(reticle.matrix);
    mesh.position.x += (Math.random() - 0.5) * 0.5;
    mesh.position.z += (Math.random() - 0.5) * 0.5;
    mesh.userData.collectible=true;

    scene.add(mesh);
}

const loader = new GLTFLoader();

function spawnObject(modelPath){

  loader.load(modelPath, function(gltf){

    const model = gltf.scene;

    model.position.setFromMatrixPosition(reticle.matrix);

    // случайное смещение
    model.position.x += (Math.random() - 0.5) * 0.5;
    model.position.z += (Math.random() - 0.5) * 0.5;

    model.scale.set(0.2, 0.2, 0.2);

    model.userData.collectible = true;

    scene.add(model);

  });

}

function spawnLevel1(){

  loader.load("assets/models/key.glb", function(gltf){

    key = gltf.scene;
    key.scale.set(0.2,0.2,0.2);
    key.position.setFromMatrixPosition(reticle.matrix);

    key.position.x += getRandomFar(-2.5, -1.5, 1.5, 2.5);
    key.position.z += getRandomFar(-2.5, -1.5, 1.5, 2.5);
    key.userData.type = "key";

    scene.add(key);

  });

  loader.load("assets/models/sourse/chest.glb", function(gltf){

    chest = gltf.scene;
    chest.scale.set(0.3,0.3,0.3);

    chest.position.setFromMatrixPosition(reticle.matrix);
    // chest.position.x += 1; // чуть в сторону

    chest.userData.type = "chest";

    scene.add(chest);

  });

}


function getRandomFar(min1, max1, min2, max2) {
  if (Math.random() < 0.5) {
    return Math.random() * (max1 - min1) + min1;
  } else {
    return Math.random() * (max2 - min2) + min2;
  }
}

function spawnCoin() {
    if(!reticle.visible) return;

    loader.load("assets/models/coin.glb", function(gltf){

        const coin = gltf.scene;

        coin.scale.set(0.1, 0.1, 0.1);

        // позиция от reticle (как база)
        coin.position.setFromMatrixPosition(reticle.matrix);

        // рандомный разброс (далеко от центра)
        coin.position.x += getRandomFar(-2, -1, 1, 2);
        coin.position.z += getRandomFar(-2, -1, 1, 2);

        // помечаем как собираемый объект
        coin.userData.type = "collectible";

        // важно для raycast
        coin.traverse(child => {
        if(child.isMesh){
            child.userData.type = "collectible";
        }
        });

        scene.add(coin);

    });

}

function startLevel(){
    collected=0;

    if (level === 1) {
        uiTask.textContent = "Найдите ключик и откройте сундук.";
        spawnLevel1()
    }

    if(level===2){
        uiTask.textContent = "Соберите 10 монет";

        collected = 0;

        for(let i = 0; i < 10; i++){
            spawnCoin();
        }
    }

    if(level===3){
        uiTask.textContent="Соберите 3 зелёных объекта";

        spawnObject1("green");
        spawnObject1("green");
        spawnObject1("green");
    }
}


function raycastClick(event) {
    if(grabbedObject) return;

    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if(intersects.length){

        let obj = intersects[0].object;

        // поднимаемся вверх до объекта с userData
        while(obj.parent && !obj.userData.type){
        obj = obj.parent;
        }

        // 🔑 КЛЮЧ — взять
        if(obj.userData.type === "key"){
        grabbedObject = obj;
        return;
        }

        // 📦 ОБЫЧНЫЙ ПРЕДМЕТ — собрать
        if(obj.userData.type === "collectible"){

        scene.remove(obj);

        collected++;
        soundCollect.play();

        checkProgress();
        }
    }
}
function checkProgress(){
    if(level === 2 && collected === 10) nextLevel();
    if(level===3 && collected===3) winGame();

    uiScore.textContent="Собрано: "+collected;
}

function nextLevel(){
    level++;

    uiLevel.textContent=level;

    soundVictory.play();

    startLevel();
}

function winGame(){
    uiTask.textContent="Вы прошли квест!";
    soundVictory.play();
    level = 99;
}

function onSelect(){
    if(!reticle.visible) return;

    if (grabbedObject && chest) {
        const distance = grabbedObject.position.distanceTo(chest.position);
        if (distance < 0.5) {
            // Убираем ключ и сундук
            scene.remove(grabbedObject);
            scene.remove(chest);

            grabbedObject = null;
            key = null;
            chest = null;

            nextLevel(); // Переход на уровень 2
            return; // важно, чтобы не запускался следующий блок
        }
    }
    
    if(scene.children.filter(o=>o.userData.collectible).length===0){
        startLevel();
    }
}

function animate(){
    renderer.setAnimationLoop(render);
}

function render(timestamp,frame){

    if(frame){
        const referenceSpace=renderer.xr.getReferenceSpace();
        const session=renderer.xr.getSession();

        if(hitTestSourceRequested===false){
            session.requestReferenceSpace("viewer").then(function(referenceSpace){

            session.requestHitTestSource({space:referenceSpace}).then(function(source){
                    hitTestSource=source;});

            });

            session.addEventListener("end",function(){
                hitTestSourceRequested=false;
                hitTestSource=null;});
            hitTestSourceRequested=true;
        }

        if(hitTestSource){
            const hitTestResults=frame.getHitTestResults(hitTestSource);

            if(hitTestResults.length){

                const hit=hitTestResults[0];

                reticle.visible=true;

                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);

            }
            
            else {
                reticle.visible=false;
            }
        }
    }
    if(grabbedObject){

        const direction = new THREE.Vector3(0, 0, -1)
            .applyQuaternion(camera.quaternion);

        const position = camera.position
            .clone()
            .add(direction.multiplyScalar(1));

        grabbedObject.position.copy(position);
    }
    renderer.render(scene,camera);
}