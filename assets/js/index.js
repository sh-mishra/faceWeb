
// whether streaming video from the camera.
var streaming = false;

var videoWidth, videoHeight;
var video = document.getElementById('video');
var canvasOutput = document.getElementById('canvasOutput');
var canvasOutputCtx = canvasOutput.getContext('2d');
var stream = null;

var instructionBoxText = $('#instructionBoxText');

var hasProcessStopped = false;

// initial function when the process is started
// function asks for the camera permission
function startCamera() {
    if (streaming) { return; }
    navigator.mediaDevices.getUserMedia({video: true, audio: false}).then(function(s) {
        stream = s;
        video.srcObject = s;
        video.play();
    }).catch(function(err) {
        processCameraError(err);
    });

    video.addEventListener("canplay", function(ev){
        if (!streaming) {
            videoWidth = video.videoWidth;
            videoHeight = video.videoHeight;
            /*alert(videoWidth + " : " +$(window).width());*/
            // for mobile view the canvas goes beyond the viewpoint, increase or decrease the 
            // value to be subtracted, accordingly to your convience
            if($(window).width() < videoWidth){
                videoWidth = $(window).width() - 50;
            }
            video.setAttribute("width", videoWidth);
            video.setAttribute("height", videoHeight);
            // resizeing the canvas according to the video input
            canvasOutput.width = videoWidth;
            canvasOutput.height = videoHeight;
            streaming = true;
        }
        startVideoProcessing();
    }, false);
}

var faceClassifier = null;

var src = null;
var dstC1 = null;
var dstC3 = null;
var dstC4 = null;

var canvasInput = null;
var canvasInputCtx = null;

var canvasBuffer = null;
var canvasBufferCtx = null;

var requestAnimationFrameId = null;

// function where all the variables are initialized and the process is started
function startVideoProcessing() {
    if (!streaming) {
        console.warn("Please startup your webcam");
        return;
    }
    stopVideoProcessing();
    canvasInput = document.createElement('canvas');
    canvasInput.width = videoWidth;
    canvasInput.height = videoHeight;
    canvasInputCtx = canvasInput.getContext('2d');
    canvasBuffer = document.createElement('canvas');
    canvasBuffer.width = videoWidth;
    canvasBuffer.height = videoHeight;
    canvasBufferCtx = canvasBuffer.getContext('2d');
    srcMat = new cv.Mat(videoHeight, videoWidth, cv.CV_8UC4);
    grayMat = new cv.Mat(videoHeight, videoWidth, cv.CV_8UC1);
    var cropF = new cv.Mat();
    faceClassifier = new cv.CascadeClassifier();
    // haarcascade classifier, one can change the classifier here
    faceClassifier.load('haarcascade_frontalface_default.xml');
    hasProcessStopped = false;
    // video processing start here, one by one the frames are processed
    // requestAnimationFrame is inbuilt window/browser function 
    requestAnimationFrameId = requestAnimationFrame(processVideo);
}

function processVideo() {
    if(hasProcessStopped){
        return;
    }
    // comment below line if stats monitor is disabled, else error will be thrown
    stats.begin();
    // input image displayed to the canvas, red box will be drawn later
    canvasInputCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
    var imageData = canvasInputCtx.getImageData(0, 0, videoWidth, videoHeight);
    srcMat.data.set(imageData.data);
    cv.cvtColor(srcMat, grayMat, cv.COLOR_RGBA2GRAY);
    var faces = [];
    var size;
    var faceVect = new cv.RectVector();
    var faceMat = new cv.Mat();
    cv.pyrDown(grayMat, faceMat);
    cv.pyrDown(faceMat, faceMat);
    size = faceMat.size();
    faceClassifier.detectMultiScale(faceMat, faceVect);
    // below conditiotn check whether the captureMode is on or not
    // if capture mode is on the button will be disabled else 
    // if a face is detected then only the button will be enabled
    if(!$('#capture').hasClass('captureOn')){
        if(faceVect.size()===1){
            $('#capture').prop('disabled', false).removeClass('disabled');
        } else {
            $('#capture').prop('disabled', true).addClass('disabled');
        }
    }
    // console.log(requestAnimationFrameId + " at " + new Date().getTime());
    // below condition check whether mutiple faces are detected or not
    // if multiple faces are detected then an alert will be displayed and after 1 sec it will automatically disappear
    if(faceVect.size()>1){
        if($('#instructionBox').hasClass('alert-info')){
            var prev = instructionBoxText.html();
            console.log(prev);
        }
        // edit the multiple face detected error content from below line
        instructionBoxText.html("<span class='text-danger'>Multiple Faces Detected!!</span>");
        $('#instructionBox').removeClass("alert-info").addClass("alert-danger");
        setTimeout(function () {
            console.log(prev);
            instructionBoxText.html(prev);
            $('#instructionBox').removeClass("alert-danger").addClass("alert-info");
        }, 1000);
    }
    for (var i = 0; i < faceVect.size(); i++) {
        var face = faceVect.get(i);
        faces.push(new cv.Rect(face.x, face.y, face.width, face.height));
    }
    faceMat.delete();
    faceVect.delete();
    // canvasOutputCtx.scale(-1, 1);
    canvasOutputCtx.drawImage(canvasInput, 0, 0, videoWidth, videoHeight);
    // function to draw red box arround the detected face
    // one can change the color of the box from below
    drawResults(canvasOutputCtx, faces, 'red', size);
    // comment below line if stats monitor is disabled, else error will be thrown
    stats.end();
    requestAnimationFrameId = requestAnimationFrame(processVideo);
}

// function draws the red box on the screen
function drawResults(ctx, results, color, size) {
    for (var i = 0; i < results.length; ++i) {
        var rect = results[i];
        var xRatio = videoWidth/size.width;
        var yRatio = videoHeight/size.height;
        // change the line width of the box from below
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.strokeRect(rect.x*xRatio, rect.y*yRatio, rect.width*xRatio, rect.height*yRatio);
        // when ever the capture button is clicked the area inside the red box is taken only not 
        // the rest of the background noise
        // change the coordinates or the ratio if want to increase the image size
        cropF = srcMat.roi(new cv.Rect(rect.x*xRatio, rect.y*yRatio, rect.width*xRatio, rect.height*yRatio));
        // tmpCanvas is a hidden canvas where the cropped image will be displayed, although the canvas is hidden 
        // hence no effect will be seen to the user
        cv.imshow("tmpCanvas",cropF);
        cropF.delete();
    }
}

function stopVideoProcessing() {
    if (src !== null && !src.isDeleted()) { src.delete(); }
    if (dstC1 !== null && !dstC1.isDeleted()){ dstC1.delete(); }
    if (dstC3 !== null && !dstC3.isDeleted()){ dstC3.delete(); }
    if (dstC4 !== null && !dstC4.isDeleted()){ dstC4.delete(); }
}

// function to be called whenever, one want to stop the camera
function stopCamera() {
    if (!streaming) return;
    /*alert(requestAnimationFrameId);*/
    hasProcessStopped = true;
    stopVideoProcessing();
    video.pause();
    video.srcObject=null;
    stream.getVideoTracks()[0].stop();
    canvasOutputCtx.clearRect(0, 0, canvasOutput.width, canvasOutput.height);
    window.cancelAnimationFrame(requestAnimationFrameId);
    // console.log("last requestAnimationFrameId: "+requestAnimationFrameId + " at " + new Date().getTime());
    $('#container').empty();
    streaming = false;
}

// add a stat monitor on the upper left of the screen
function initUI() {
    stats = new Stats();
    stats.showPanel(0);
    document.getElementById('container').appendChild(stats.dom);
}

// first function to be called when start process button is clicked
function opencvIsReady() {
    console.log('OpenCV.js is ready');
    // comment the below function, if dont want the stat monitor
    initUI();
    startCamera();
}

function setCookie(cookieName, cookieValue, expireAfter) {
    var d = new Date();
    d.setTime(d.getTime() + (expireAfter*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    console.log(d.toUTCString());
    document.cookie = cookieName + "=" + cookieValue + ";" + expires + ";path=/";
}

// function to retrieve cookie
function getCookie(cookieName) {
    var name = cookieName + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

// function to check if cookie exists or not
function ifCookieExists(cookieName) {
    var cookieValue = getCookie("cookieName");
    if (cookieValue !== "") {
        return false;
    } else {
        return true;
    }
}

// convert binary image to blob
function dataURItoBlob(dataURI) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0)
        byteString = atob(dataURI.split(',')[1]);
    else
        byteString = unescape(dataURI.split(',')[1]);

    // separate out the mime component
    // var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to a typed array
    var ia = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ia], {type: 'image/jpeg'});
}

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

// when an error occured that the camera isn't accessible
function processCameraError(err){
    instructionBoxText.html("<span class='text-danger'>"+err+"</span>");
    $('#instructionBox').removeClass("alert-info").addClass("alert-danger");
    $('#container').empty();
    alert("Camera Error!!");
    console.warn("Camera Error: "+err);
    $('#startCamera').html('<i class="fa fa-camera-retro"></i>&nbsp;Start Process').prop('disabled', false);
}

function validateEmail(input) {
    var mailformat = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if(input.match(mailformat)) {
        return true;
    }
    return false;
}
