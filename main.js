import * as THREE from "https://unpkg.com/three@0.183.2/build/three.module.js";
import { ARButton } from "https://unpkg.com/three@0.183.2/examples/jsm/webxr/ARButton.js";

let scene, camera, renderer;
let controller;

let reticle;
let hitTestSource=null;
let hitTestSourceRequested=false;

let level=1;
let collected=0;

const uiLevel=document.getElementById("level");
const uiTask=document.getElementById("task");
const uiScore=document.getElementById("score");

const soundCollect=new Audio("sounds/collect.mp3");
const soundWin=new Audio("sounds/win.mp3");

init();
animate();

function init(){

scene=new THREE.Scene();

camera=new THREE.PerspectiveCamera(70,window.innerWidth/window.innerHeight,0.01,20);

renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.xr.enabled=true;

document.body.appendChild(renderer.domElement);

document.body.appendChild(ARButton.createButton(renderer,{requiredFeatures:["hit-test"]}));

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

function spawnObject(color){

const geometry=new THREE.BoxGeometry(0.1,0.1,0.1);
const material=new THREE.MeshStandardMaterial({color:color});

const mesh=new THREE.Mesh(geometry,material);

mesh.position.setFromMatrixPosition(reticle.matrix);
mesh.userData.collectible=true;

scene.add(mesh);

}

function startLevel(){

collected=0;

if(level===1){
uiTask.textContent="Найдите красный куб";
spawnObject("red");
}

if(level===2){

uiTask.textContent="Соберите 2 синих объекта";

spawnObject("blue");
spawnObject("blue");

}

if(level===3){

uiTask.textContent="Соберите 3 зелёных объекта";

spawnObject("green");
spawnObject("green");
spawnObject("green");

}

}

function raycastClick(event){

const mouse=new THREE.Vector2(
(event.clientX/window.innerWidth)*2-1,
-(event.clientY/window.innerHeight)*2+1
);

const raycaster=new THREE.Raycaster();
raycaster.setFromCamera(mouse,camera);

const intersects=raycaster.intersectObjects(scene.children);

intersects.forEach(obj=>{

if(obj.object.userData.collectible){

scene.remove(obj.object);

collected++;

soundCollect.play();

checkProgress();

}

});

}

function checkProgress(){

if(level===1 && collected===1) nextLevel();
if(level===2 && collected===2) nextLevel();
if(level===3 && collected===3) winGame();

uiScore.textContent="Собрано: "+collected;

}

function nextLevel(){

level++;

uiLevel.textContent=level;

soundWin.play();

startLevel();

}

function winGame(){

uiTask.textContent="Вы прошли квест!";
soundWin.play();

}

function onSelect(){

if(!reticle.visible) return;

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

hitTestSource=source;

});

});

session.addEventListener("end",function(){

hitTestSourceRequested=false;
hitTestSource=null;

});

hitTestSourceRequested=true;

}

if(hitTestSource){

const hitTestResults=frame.getHitTestResults(hitTestSource);

if(hitTestResults.length){

const hit=hitTestResults[0];

reticle.visible=true;

reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);

}else{

reticle.visible=false;

}

}

}

renderer.render(scene,camera);

}