// import * as THREE from 'three';
// import { ARButton } from 'three/addons/webxr/ARButton.js';
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'https://unpkg.com/three@0.183.2/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.183.2/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.183.2/examples/jsm/loaders/GLTFLoader.js';

let scene, camera, renderer;
let controller;

let reticle;
let hitTestSource=null;
let hitTestSourceRequested = false;

let key = null;
let chest = null;

let level=1;
let collected = 0;
let levelstarted = false;

let balloon = null;
let balloonClicks = 0;
let balloonsDone = 0;

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

// function spawnObject1(color){
//     const geometry=new THREE.BoxGeometry(0.1,0.1,0.1);
//     const material=new THREE.MeshStandardMaterial({color:color});

//     const mesh=new THREE.Mesh(geometry,material);

//     mesh.position.setFromMatrixPosition(reticle.matrix);
//     mesh.position.x += (Math.random() - 0.5) * 0.5;
//     mesh.position.z += (Math.random() - 0.5) * 0.5;
//     mesh.userData.type = "collectible";

//     scene.add(mesh);
// }

// const loader = new GLTFLoader();

// function spawnObject(modelPath){

//   loader.load(modelPath, function(gltf){

//     const model = gltf.scene;

//     model.position.setFromMatrixPosition(reticle.matrix);

//     // случайное смещение
//     model.position.x += (Math.random() - 0.5) * 0.5;
//     model.position.z += (Math.random() - 0.5) * 0.5;

//     model.scale.set(0.2, 0.2, 0.2);

//     model.userData.type = "collectible";

//     scene.add(model);

//   });

// }

function spawnLevel1() {
    if (key != null || chest != null) return;

    if (levelstarted)
        return;
    const geometry=new THREE.BoxGeometry(0.3,0.07,0.07);
    const material=new THREE.MeshStandardMaterial({color:"yellow"});

    key = new THREE.Mesh(geometry, material);
    key.position.setFromMatrixPosition(reticle.matrix);
    key.position.x += getRandomFar(-2.5, -1.5, 1.5, 2.5);
    key.position.z += getRandomFar(-2.5, -1.5, 1.5, 2.5);
    key.position.y += 0.05;
    key.userData.type = "key";
    scene.add(key);
    
    const geometry2=new THREE.BoxGeometry(0.3,0.3,0.5);
    const material2=new THREE.MeshStandardMaterial({color:0x8C4D0A});

    chest = new THREE.Mesh(geometry2, material2);
    chest.position.setFromMatrixPosition(reticle.matrix);
    chest.position.y += 0.05;
    chest.userData.type = "chest";
    scene.add(chest);
    levelstarted = true;
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

    // геометрия монетки (тонкий цилиндр)
    const geometry = new THREE.CylinderGeometry(0.06, 0.06, 0.02, 32);
    const material = new THREE.MeshStandardMaterial({ color: 0xffd700 });

    const coin = new THREE.Mesh(geometry, material);
    coin.rotation.x = Math.PI / 2;
    // coin.rotation.z = Math.PI / 4;

    // позиция
    coin.position.setFromMatrixPosition(reticle.matrix);
    coin.position.x += getRandomFar(-1.5, -0.5, 0.5, 1.5);
    coin.position.z += getRandomFar(-1.5, -0.5, 0.5, 1.5);
    coin.position.y += 0.05;

    coin.userData.type = "collectible";

    scene.add(coin);
}

function spawnBalloon(){

    const geometry = new THREE.SphereGeometry(0.1, 32, 32);

    // случайный цвет
    const color = new THREE.Color(
        Math.random(),
        Math.random(),
        Math.random()
    );

    const material = new THREE.MeshStandardMaterial({ color });

    balloon = new THREE.Mesh(geometry, material);

    balloon.position.setFromMatrixPosition(reticle.matrix);

    // небольшой разброс (не далеко)
    balloon.position.x += (Math.random() - 0.5) * 0.5;
    balloon.position.z += (Math.random() - 0.5) * 0.5;
    balloon.position.y += 0.05;

    balloon.userData.type = "balloon";

    balloonClicks = 0;

    scene.add(balloon);
}

function startLevel(){
    collected=0;

    if (level === 1) {
        uiTask.textContent = "Найдите ключик и откройте сундук.";
        spawnLevel1()
    }

    if (level === 2) {
        if (levelstarted)
            return;
        uiTask.textContent = "Соберите 10 монет";
        uiScore.textContent = "Собрано: 0";

        collected = 0;

        for(let i = 0; i < 10; i++){
            spawnCoin();
        }
        levelstarted = true;
    }

    if (level === 3) {
        if (levelstarted)
            return;

        uiTask.textContent = "Лопните шарики!";
        balloonsDone = 0;

        spawnBalloon();
        
        levelstarted = true;
    }
}


function raycastClick(event) {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if(!intersects.length) return;

    // let obj = intersects[0].object;
    for (let hit of intersects) {
        let obj = hit.object;

        while (obj.parent && !obj.userData.type) {
            obj = obj.parent;
        }

        if(obj.userData.type === "collectible"){
            scene.remove(obj);
            collected++;
            soundCollect.play();
            checkProgress();
            return; // важно — выходим после первого найденного
        }
    }

    // поднимаемся до объекта с userData.type
    while(obj.parent && !obj.userData.type){
        obj = obj.parent;
    }
    obj.material.emissive = new THREE.Color(0xffffff);
    setTimeout(() => {
        obj.material.emissive = new THREE.Color(0x000000);
    }, 100);

    if(level === 1) {
        // Сначала ключ
        if(obj.userData.type === "key") {
            scene.remove(obj);
            key = null;
            soundCollect.play();
            uiTask.textContent = "Теперь откройте сундук!";
            return;
        }

        // Потом сундук, только если ключ уже собран
        if(obj.userData.type === "chest" && key === null) {
            scene.remove(obj);
            chest = null;
            nextLevel(); // Переход на уровень 2
            return;
        }
    }

    // Для остальных уровней оставляем обычную логику
    if(obj.userData.type === "collectible") {
        scene.remove(obj);
        collected++;
        soundCollect.play();
        checkProgress();
    }

    if(obj.userData.type === "balloon"){

        balloonClicks++;

        // увеличиваем размер
        //obj.scale.multiplyScalar(1.2);
        // obj.scale.x += 1.2;
        // obj.scale.y += 1.2;
        // obj.scale.z += 1.2;
        obj.userData.targetScale = obj.scale.x + 1.2;

        // после 5 кликов — "лопается"
        if (balloonClicks >= 5) {
            obj.userData.exploding = true;
            delete obj.userData.targetScale;
            //obj.material.opacity = 0.5;
            //obj.scale.set(0,0,0); 
            //scene.remove(obj);
            balloon = null;

            balloonsDone++;
            soundCollect.play();

            // если ещё есть шарики
            if(balloonsDone < 3){
                //spawnBalloon();
                setTimeout(() => spawnBalloon(), 300);
            }
            else {
                winGame();
            }
        }

        return;
    }
}

// function raycastClick(event) {
//     const mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
//     const raycaster = new THREE.Raycaster();
//     raycaster.setFromCamera(mouse, camera);
//     const intersects = raycaster.intersectObjects(scene.children);
//     intersects.forEach(obj => {
//         if (obj.object.userData.collectible) {
//             scene.remove(obj.object);
//             collected++;
//             soundCollect.play();
//             checkProgress();
//         }
//     });
// }

function checkProgress(){
    if(level === 2 && collected >= 10) nextLevel();

    uiScore.textContent="Собрано: "+collected;
}

function nextLevel(){
    level++;
    levelstarted = false;

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
    
    // if(scene.children.filter(o=>o.userData.type === "collectible").length===0 && !levelstarted){
    //     startLevel();
    // }
    if(level === 1 && !levelstarted){
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
    scene.traverse(obj => {
        if(obj.userData.targetScale){
            const s = obj.scale.x;

            if(s < obj.userData.targetScale){
                obj.scale.x += 0.02;
                obj.scale.y += 0.02;
                obj.scale.z += 0.02;
            }
        }
        if(obj.userData.exploding){
            obj.scale.multiplyScalar(1.1);
            obj.material.opacity -= 0.05;
            obj.material.transparent = true;

            if(obj.material.opacity <= 0){
                scene.remove(obj);
            }
        }
        
    });
    renderer.render(scene,camera);
}