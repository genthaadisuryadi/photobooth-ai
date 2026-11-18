// js/camera.js

let videoStream = null;
currentFacingMode = "user"; 
let isCountingDown = false;
let handsDetector = null;
let handsCamera = null;

async function initCamera(facing = "user") {
    const video = document.getElementById('webcam-video');
    if (!video) return;

    currentFacingMode = facing;
    isCountingDown = false;

    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        if (handsCamera) {
            handsCamera.stop();
            handsCamera = null;
        }
        
        const constraints = {
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                facingMode: currentFacingMode
            },
            audio: false
        };

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = videoStream;
        
        if (currentFacingMode === "user") {
            video.style.transform = "scaleX(-1)";
        } else {
            video.style.transform = "none";
        }
        video.style.objectFit = "cover";

        await video.play();

        // Inisialisasi Hand Tracking MediaPipe 
        initHandTracking(video);

    } catch (err) {
        console.error("Akses kamera ditolak atau tidak ditemukan:", err);
        alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
    }
}

function initHandTracking(videoElement) {
    const statusText = document.getElementById('hand-detector-status');
    if(statusText) statusText.classList.remove('hidden');

    handsDetector = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});
    
    handsDetector.setOptions({
        maxNumHands: 1, 
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65
    });

    handsDetector.onResults(onHandDetected);

    handsCamera = new camera_utils.Camera(videoElement, {
        onFrame: async () => {
            if (!isCountingDown && handsDetector) {
                await handsDetector.send({image: videoElement});
            }
        },
        width: 640,
        height: 480
    });
    
    handsCamera.start();
}

function onHandDetected(results) {
    if (isCountingDown) return; 

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        const isThumbOpen = Math.abs(landmarks[4].x - landmarks[2].x) > 0.05; 
        const isIndexOpen = landmarks[8].y < landmarks[6].y;
        const isMiddleOpen = landmarks[12].y < landmarks[10].y;
        const isRingOpen = landmarks[16].y < landmarks[14].y;
        const isPinkyOpen = landmarks[20].y < landmarks[18].y;

        const minX = Math.min(...landmarks.map(l => l.x));
        const maxX = Math.max(...landmarks.map(l => l.x));
        const minY = Math.min(...landmarks.map(l => l.y));
        const maxY = Math.max(...landmarks.map(l => l.y));
        
        const handWidth = maxX - minX;
        const handHeight = maxY - minY;

        if (isThumbOpen && isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen) {
            if (handWidth > 0.15 && handHeight > 0.25) { 
                const statusText = document.getElementById('hand-detector-status');
                if(statusText) statusText.innerText = "Tangan Terdeteksi! 📸";
                
                startCountdown();
            }
        }
    }
}

function startCountdown() {
    if (isCountingDown) return;
    isCountingDown = true;
    
    const btnCapture = document.getElementById('btn-capture');
    if (btnCapture) btnCapture.disabled = true;
    
    let display = document.getElementById('countdown-display');
    let number = document.getElementById('countdownNumber');
    
    if (display) display.classList.remove('hidden');
    
    let count = 5; 
    if (number) number.innerText = count;
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            if (number) number.innerText = count;
        } else {
            clearInterval(interval);
            if (display) display.classList.add('hidden');
            takePhoto();
        }
    }, 1000);
}

function takePhoto() {
    const canvas = document.getElementById('capture-canvas');
    const video = document.getElementById('webcam-video');
    if (!video || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    ctx.save();
    
    if (currentFacingMode === "user") {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    if (typeof AppState !== 'undefined') AppState.captureImageURL = imgData;
    
    const previewImg = document.getElementById('capture-preview-img');
    if (previewImg) previewImg.src = imgData;
    
    const decisionEl = document.getElementById('capture-decision');
    if (decisionEl) decisionEl.classList.remove('hidden');
    
    video.pause(); 
    if(handsCamera) handsCamera.stop();
}

window.retakePhoto = function() {
    isCountingDown = false;
    const btnCapture = document.getElementById('btn-capture');
    if (btnCapture) btnCapture.disabled = false;
    
    const statusText = document.getElementById('hand-detector-status');
    if(statusText) statusText.innerText = "Menunggu Pose 5 Jari✋";
    
    const decisionEl = document.getElementById('capture-decision');
    if (decisionEl) decisionEl.classList.add('hidden');
    
    const video = document.getElementById('webcam-video');
    if (video) {
        video.play();
        if (handsCamera) handsCamera.start();
    }
}

window.startAIProcessing = function() {
    const decisionEl = document.getElementById('capture-decision');
    if (decisionEl) decisionEl.classList.add('hidden');
    
    if (typeof switchScreen === 'function') {
        switchScreen('screen-review');
    }
    
    if (typeof processAI === 'function') {
        processAI();
    }
}