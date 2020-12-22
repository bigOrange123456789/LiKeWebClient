function ListStorage(){
    this.cameraStatus=[];//成员为数组//每个成员长度为6
    this.preCameraStatus=null;
    this.list=[ [] ];//成员为数组//每个成员由多个字符串构成
    this.list_index=0;//初始值为0，每存储完一个视点的列表加1
}
var myListStorage=new ListStorage();

let sceneName = "hy";
let scene, camera, renderer, controls, sceneRoot;
let container,light, lightObj;
let startTime = performance.now();
let ws,interval;
let host='100.64.211.63',port = 8081;
const webService = "Lcrs";
const mWebClientExchangeCode = 4000;
const sliceLength = 500,synFreq = 1500;
let websocketReady = false;
let scenetLoadDone = false, firstComponent = false;

let radianceWidth = Math.floor(window.innerWidth/2), radianceHeight = Math.floor(window.innerHeight/2);
let cameraForward = new THREE.Vector3();

let gltfLoader = new THREE.GLTFLoader();
THREE.DRACOLoader.setDecoderPath('./lib/draco/');
THREE.DRACOLoader.setDecoderConfig({type: 'js'});
gltfLoader.setDRACOLoader(new THREE.DRACOLoader());

init();
animate();



function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    camera = new THREE.PerspectiveCamera(
        70, window.innerWidth / window.innerHeight, 0.3, 1000
    );
    camera.position.set(0, 0, 30);

    // renderer
    container = document.getElementById("container");
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    // controls
    controls = new THREE.OrbitControls(
        camera, renderer.domElement
    );
    controls.saveState();
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    light = new THREE.SpotLight(0xffffff);
    light.position.set(camera.position.x, camera.position.y, camera.position.z);
    light.distance = 800;
    light.intensity = 0.8;
    lightObj = new THREE.Object3D();
    lightObj.position.set(0, 0, 5);
    scene.add(lightObj);
    light.target = lightObj;
    scene.add(light);

    sceneRoot = new THREE.Object3D();
    sceneRoot.applyMatrix(new THREE.Matrix4().set(
        -1, 0, 0, 0,
        0, 0, 1, 0,
        0, 1, 0, 0,
        0, 0, 0, 1
    ));
    scene.add(sceneRoot);
    scene.add(new THREE.AxesHelper(5));
    //scene.add(new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshPhongMaterial({color:0xffff00})));
    window.addEventListener('resize', synWindowSize, false);
    initWebsocketNetwork();
}

function makeInstanced(geo, mtxObj, oriName, type) {
    //console.log(geo);
    //console.log(mtxObj);{446=IfcColumn: Array(16), 540=IfcColumn: Array(16)}
    //console.log(oriName);2336=IfcColumn
    //console.log(type);//IfcColumn
    let mtxKeys = Object.keys(mtxObj);
    let instanceCount = mtxKeys.length + 1;

    //生成mesh只需要两样东西，材质material和几何igeo
    //1.material
    var vert = document.getElementById('vertInstanced').textContent;
    var frag = document.getElementById('fragInstanced').textContent;

    let myTexture = selectTextureByType(type,0.001);

    var uniforms={
        texture:{type: 't', value: myTexture}
    };
    var material = new THREE.RawShaderMaterial({
        uniforms: uniforms,
        vertexShader: vert,
        fragmentShader: frag
    });

    //2.igeo几何//InstancedBufferGeometry//将原网格中的geo拷贝到igeo中
    var igeo=new THREE.InstancedBufferGeometry();//geometry//threeJS中有一种对象叫InstancedMesh，构造方法为InstancedMesh( geometry : BufferGeometry, material : Material, count : Integer )

    var vertices = geo.attributes.position.clone();
    igeo.addAttribute('position', vertices);//设置几何中的点
    igeo.setIndex(geo.index);
    var mcol0=new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);
    var mcol1=new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);
    var mcol2=new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);
    var mcol3=new THREE.InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);
    mcol0.setXYZ(0, 1, 0, 0);//设置原始mesh的变换矩阵与名称
    mcol1.setXYZ(0, 0, 1, 0);
    mcol2.setXYZ(0, 0, 0, 1);
    mcol3.setXYZ(0, 0, 0, 0);

    let instancedMeshName = oriName;
    for (let i = 1, ul = instanceCount; i < ul; i++){
        let currentName = mtxKeys[i - 1];
        let mtxElements = mtxObj[currentName];
        mcol0.setXYZ(i, mtxElements[0], mtxElements[1], mtxElements[2]);
        mcol1.setXYZ(i, mtxElements[4], mtxElements[5], mtxElements[6]);
        mcol2.setXYZ(i, mtxElements[8], mtxElements[9], mtxElements[10]);
        mcol3.setXYZ(i, mtxElements[12], mtxElements[13], mtxElements[14]);
        instancedMeshName+=('_' + currentName);
    }
    igeo.addAttribute('mcol0', mcol0);
    igeo.addAttribute('mcol1', mcol1);
    igeo.addAttribute('mcol2', mcol2);
    igeo.addAttribute('mcol3', mcol3);

    var colors = new THREE.InstancedBufferAttribute(
        new Float32Array(instanceCount * 3), 3
    );
    for (let i = 0, ul = colors.count; i < ul; i++) {// colors.setXYZ(i, color.r, color.g, color.b);
        colors.setXYZ(i, 0.33, 0.33, 0.33);
    }
    igeo.addAttribute('color', colors);

    //3.mesh
    var mesh = new THREE.Mesh(igeo, material);//生成的还是mesh对象
    mesh.scale.set(0.001, 0.001, 0.001);
    mesh.material.side = THREE.DoubleSide;
    mesh.frustumCulled = false;
    mesh.name = oriName;
    sceneRoot.add(mesh);
}

function myTest(){
    var geo=new THREE.CylinderGeometry(1,1,50,50,5);

    /*var igeo=new THREE.InstancedBufferGeometry();
    var vertices = geo.attributes.position.clone();
    igeo.addAttribute('position', vertices);//设置几何中的点
    igeo.setIndex(geo.index);

    var mcol0,mcol1,mcol2,mcol3;
    mcol0=mcol1=mcol2=mcol3=new THREE.InstancedBufferAttribute(
        new Float32Array(instanceCount * 3), 3
    );
    mcol0.setXYZ(0, 1, 0, 0);//设置原始mesh的变换矩阵与名称
    mcol1.setXYZ(0, 0, 1, 0);//四元数、齐次坐标
    mcol2.setXYZ(0, 0, 0, 1);
    mcol3.setXYZ(0, 0, 0, 0);//这16个数字构成了一个4*4的矩阵
    igeo.addAttribute('mcol0', mcol0);//四元数、齐次坐标
    igeo.addAttribute('mcol1', mcol1);
    igeo.addAttribute('mcol2', mcol2);
    igeo.addAttribute('mcol3', mcol3);*/

    var material= new THREE.MeshBasicMaterial({color:0x0f00f0, transparent: true,opacity: 0.5 });
    var mesh= new THREE.Mesh(geo, material);
    sceneRoot.add(mesh);
    //alert(123);
}myTest();

function animate() {
    requestAnimationFrame(animate);
    $("#triNum")[0].innerText = renderer.info.render.triangles;
    renderer.render(scene, camera);
    updateLight();
    controls.update();
}


function updateLight() {
    light.position.set(camera.position.x, camera.position.y, camera.position.z);
    let ps = new THREE.Vector3();
    camera.getWorldDirection(ps);
    lightObj.position.set(
        camera.position.x + ps.x * 10,
        camera.position.y + ps.y * 10,
        camera.position.z + ps.z * 10
    );
    light.target = lightObj;
}


function initWebsocketNetwork() {//这个函数只被初始化的时候执行一次
    ws = new WebSocket("ws://" + host + ":" + port + "/" + webService);
    ws.onopen = function (event) {//只被初始化的时候执行一次
        console.log("connect successfully");
        websocketReady = true;
        interval = setInterval(syncClientDataToServer,synFreq);
        myListStorage.cameraStatus.push([ camera.position,camera.rotation ]);
    };
    ws.onmessage = function (msg) {//每隔一段时间就会被执行一次//应该是每间隔一个单位时间就通过视点收到一部分数据
        console.log(performance.now());
        console.log("myListStorage",myListStorage);
        var headerReader = new FileReader();
        headerReader.onload = function (e) {
            console.log(e.target.result);//这是收到的数据//输出类型 ArrayBuffer(5100)//似乎是一个超大的缓冲区
            //get the buffer
            let arr = new Uint8Array(e.target.result);//将数据转化为整数数组的形式

            // glb file length info
            let glbLengthData = ab2str(arr.slice(0, sliceLength));//文件的结束通过单斜线，包的结束通过双斜线//将前500个整数数据转化成字符串//sliceLength是一个固定值500
            //  "1//"     "1152/1144/1164/1140/1148/1228/1176/1168/1164/1//"

            //glb file
            let glbData = arr.slice(sliceLength);//slice函数的end被省略，截取从500开始到结束的全部数据

            let glbLengthArr = glbLengthData.split('/');//表头通过 '/' 划分数据 //将字符串划分成字符串数组，遇到空字符串就可以结束了
            let totalLength = 0;

            let flag = false;
            var myflag;//判断这是否是视点流的最后一个文件段
            for (let i = 0; i < glbLengthArr.length - 3; i++) {//最后三个字符串分别为： “1” “”  “  ”
                if (!glbLengthArr[i])//如果长度为零
                    continue;//跳过本次循环
                if(!scenetLoadDone && glbLengthArr[glbLengthArr.length - 3]=='1' && i == glbLengthArr.length - 4)//貌似结尾为1\0表示是否结束
                {
                    //scenetLoadDone似乎是用来判断场景是否被加载，刚开始是false，之后一直是true
                    //glbLengthArr[glbLengthArr.length - 3]是否为1 标志着视点数据流是否结束
                    scenetLoadDone = true;
                    flag = true;//记录这个视点的数据流是否结束
                }
                if(glbLengthArr[glbLengthArr.length - 3]=='1'&&i == glbLengthArr.length - 4)myflag=true;
                else myflag=false;//不是视点流的最后一个文件段
                reuseDataParser( glbData.slice(totalLength, totalLength + 1.0 * glbLengthArr[i]),myflag);
                //reuseDataParser(glbData.slice(totalLength, totalLength + 1.0 * glbLengthArr[i]), flag,myflag);//解析gltf文件
                flag = false;
                totalLength += 1.0 * glbLengthArr[i];//totallength记录读取到哪里了
            }
        };
        headerReader.readAsArrayBuffer(msg.data);
    };
    ws.onclose = function (msg) {
        websocketReady = false;
        clearInterval(interval);
        console.log(msg);
        console.log("close,try reconnect");
    };
    ws.onerror = function (msg) {
        websocketReady = false;
        clearInterval(interval);
        console.log("Websocket connection error!"+msg);
        ws = new WebSocket("ws://" + host + ":" + port + "/" + webService);
    };
}

function reuseDataParser(data,myflag) {
//function reuseDataParser(data,flag,myflag) {//这个函数被网络通信函数调用，估计是用于渲染场景
    //这个函数只有一个功能，那就是使用下面这个方法加载gltf资源
    //flag为true表示当前视点的数据流结束
    gltfLoader.parse(data.buffer, './', (gltf) => {//将数据解析为gltf文件
        console.log(gltf);
        let name = gltf.parser.json.nodes[0].name;

        myListStorage.list[myListStorage.list_index].push(name);
        if(myflag){//flag为trus表示当前视点的数据流结束
            myListStorage.list_index++;
            myListStorage.list.push([]);
            myListStorage.cameraStatus.push([ camera.position,camera.rotation ]);
        }

        if (sceneRoot.getObjectByName(name)) return;//如果场景中有这个资源就不需要再次渲染
        console.log(`scene add new model: ${name}`);
        let geo = gltf.scene.children[0].geometry;//模型资源的几何结构
        let matrixObj = gltf.parser.json.nodes[0].matrixArrs;
        let type = name.slice(name.indexOf('=') + 1);
        if (matrixObj == undefined) {//如何这个资源没有被重用
            let mesh = gltf.scene.children[0];
            mesh.scale.set(0.001, 0.001, 0.001);
            mesh.name = name;
            let color = selectMaterialByType(type,name);
            mesh.material.color = color;
            mesh.material.side = THREE.DoubleSide;
            sceneRoot.add(mesh);
        } else {//如何这个资源没有被重用，如果这个资源被重用了使用实例化渲染技术
            makeInstanced(geo, JSON.parse(matrixObj), name, type);//JSON.parse(matrixObj)估计是重用的数量
        }
        //first model
        if(!firstComponent){
            firstComponent = true;
            $("#firstModelLoadTime")[0].innerText = ((performance.now() - startTime) / 1000).toFixed(2) + "秒";
            console.log("结束!!"+performance.now());
        }
    });
}

function packHeader() {
    return radianceWidth * mWebClientExchangeCode + radianceHeight;
}

function syncClientDataToServer() {//这个函数似乎会被定时执行
    if(!websocketReady)
        return;
    var msg = new Float32Array(new ArrayBuffer(52));

    // Pack the size of radiance map at first
    msg[0] = packHeader();

    // Synchronize the position and rotation of camera
    msg[1] = -camera.position.x;
    msg[2] = camera.position.y;
    msg[3] = camera.position.z;

    camera.getWorldDirection(cameraForward);
    msg[4] = -cameraForward.x;//-camera.rotation.x * 57.29578;
    msg[5] = cameraForward.y;//camera.rotation.y * 57.29578;
    msg[6] = cameraForward.z;//camera.rotation.z * 57.29578;

    // Synchronize the position and rotation of main light
    msg[7] = 10.0; // reserveParam0
    msg[8] = 10.0; // reserveParam1
    msg[9] = 10.0; // reserveParam2

    if(myListStorage.preCameraStatus==null
     ||(myListStorage.preCameraStatus[0]===msg[1]&&
        myListStorage.preCameraStatus[1]===msg[2]&&
        myListStorage.preCameraStatus[2]===msg[3]&&
        myListStorage.preCameraStatus[3]===msg[4]&&
        myListStorage.preCameraStatus[4]===msg[5]&&
        myListStorage.preCameraStatus[5]===msg[6]
        )
    ){
        myListStorage.cameraStatus.push([ msg[1],msg[2],msg[3],msg[4],msg[5],msg[6]  ]);
        myListStorage.preCameraStatus=[ msg[1],msg[2],msg[3],msg[4],msg[5],msg[6]  ];
    }


    console.log(msg);//Float32Array(13) [1468387, -0, 1.8369700935892946e-15, 30, -0, -6.123234262925839e-17, -1, 10, 10, 10, 0, 0, 0]
    ws.send(msg);
}


function synWindowSize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    radianceWidth = Math.floor(window.innerWidth/2);
    radianceHeight = Math.floor(window.innerHeight/2);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function selectMaterialByType(type, name) {
    let color = new THREE.Color(0xaaaaaa);
    switch (type) {
        case"IfcFooting":
            color = new THREE.Color(0xFFBFFF);
            break;
        case "IfcWallStandardCase"://ok
            color = new THREE.Color(0xaeb1b3);
            break;
        case "IfcSlab"://ok
            color = new THREE.Color(0x505050);
            break;
        case "IfcStair"://ok
            color = new THREE.Color(0xa4a592);
            break;
        case "IfcDoor"://ok
            color = new THREE.Color(0x6f6f6f);
            break;
        case "IfcWindow":
            color = new THREE.Color(0x9ea3ef);
            break;
        case "IfcBeam"://ok
            color = new THREE.Color(0x949584);
            break;
        case "IfcCovering":
            color = new THREE.Color(0x777a6f);
            break;
        case "IfcFlowSegment"://ok
            color = new THREE.Color(0x999999);
            break;
        case "IfcWall"://ok
            color = new THREE.Color(0xbb9f7c);
            break;
        case "IfcRamp":
            color = new THREE.Color(0x4d5053);
            break;
        case "IfcRailing"://ok
            color = new THREE.Color(0x4f4f4f);
            break;
        case "IfcFlowTerminal"://ok
            color = new THREE.Color( 0xe9f5f8 );
            break;
        case "IfcBuildingElementProxy"://ok
            color = new THREE.Color(0x6f6f6f);
            break;
        case "IfcColumn"://ok
            color = new THREE.Color(0x8a8f80);
            break;
        case "IfcFlowController"://ok
            color = new THREE.Color(0x2c2d2b);
            break;
        case "IfcFlowFitting"://ok
            color = new THREE.Color(0x93a5aa);
            break;
        case "IfcPlate"://ok外体窗户
            color = new THREE.Color(0x2a4260);
            break;
        case "IfcMember"://ok外体窗户
            color = new THREE.Color(0x2f2f2f);
            break;
        default:
            color = new THREE.Color(0x194354);
            break;
    }
    return color;
}


function selectTextureByType(type, repeatTimes = 1) {
    let texture;
    switch (type) {
        case"IfcFooting":
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcWallStandardCase"://ok
            texture = THREE.ImageUtils.loadTexture('img/wall.jpg');
            break;
        case "IfcSlab"://ok
            texture = THREE.ImageUtils.loadTexture('img/slab.jpg');
            break;
        case "IfcStair"://ok
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcDoor"://ok
            texture = THREE.ImageUtils.loadTexture('img/door.jpg');
            break;
        case "IfcWindow":
            texture = THREE.ImageUtils.loadTexture('img/window.jpg');
            break;
        case "IfcBeam"://ok
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcCovering":
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcFlowSegment"://ok
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcWall"://ok
            texture = THREE.ImageUtils.loadTexture('img/wall.jpg');
            break;
        case "IfcRamp":
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcRailing"://ok
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcFlowTerminal"://ok
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcBuildingElementProxy"://ok
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcColumn"://ok
            texture = THREE.ImageUtils.loadTexture('img/column.jpg');
            break;
        case "IfcFlowController"://ok
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcFlowFitting"://ok
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        case "IfcPlate"://ok外体窗户
            texture = THREE.ImageUtils.loadTexture('img/window.jpg');
            break;
        case "IfcMember"://ok外体窗户
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
        default:
            texture = THREE.ImageUtils.loadTexture('img/default.jpg');
            break;
    }
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatTimes, repeatTimes);
    return texture;
}


/**
 * function arraybuffer to string
 * @param arraybuffer
 **/
function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

