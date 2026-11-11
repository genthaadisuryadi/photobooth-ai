// js/camera.js

let videoStream = null;
let currentFacingMode = "user"; // "user" untuk depan/webcam, "environment" untuk belakang

async function initCamera(facing = "user") {
    const video = document.getElementById('webcam-video');
    if (!video) return;

    currentFacingMode = facing;

    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
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
        
        // Mengatur cermin (mirror) khusus kamera depan / webcam
        if (currentFacingMode === "user") {
            video.style.transform = "scaleX(-1)";
        } else {
            video.style.transform = "none";
        }
        video.style.objectFit = "cover";

        await video.play();

        const btnCapture = document.getElementById('btn-capture');
        if (btnCapture) {
            const newBtn = btnCapture.cloneNode(true);
            btnCapture.parentNode.replaceChild(newBtn, btnCapture);
            newBtn.addEventListener('click', startCountdown);
        }

    } catch (err) {
        console.error("Akses kamera ditolak atau tidak ditemukan:", err);
        alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
    }
}

function startCountdown() {
    const btnCapture = document.getElementById('btn-capture');
    if (btnCapture) btnCapture.disabled = true;
    
    let display = document.getElementById('countdown-display');
    let number = document.getElementById('countdownNumber');
    
    if (display) display.classList.remove('hidden');
    
    let count = 3;
    if (number) number.innerText = count;
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            if (number) number.innerText = count;
        } else {
            clearInterval(interval);
            if (display) display.classList.add('hidden');
            takePhoto();
            if (btnCapture) btnCapture.disabled = false;
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
    
    // PERBAIKAN PRESISI: Membalikkan posisi canvas agar hasil foto tidak terbalik saat pakai kamera depan/webcam
    if (currentFacingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    AppState.captureImageURL = imgData;
    
    const previewImg = document.getElementById('capture-preview-img');
    if (previewImg) previewImg.src = imgData;
    
    const decisionEl = document.getElementById('capture-decision');
    if (decisionEl) decisionEl.classList.remove('hidden');
    
    video.pause(); 
}

window.retakePhoto = function() {
    const decisionEl = document.getElementById('capture-decision');
    if (decisionEl) decisionEl.classList.add('hidden');
    const video = document.getElementById('webcam-video');
    if (video) video.play();
}

window.startAIProcessing = function() {
    const decisionEl = document.getElementById('capture-decision');
    if (decisionEl) decisionEl.classList.add('hidden');
    navigateTo('screen-review');
    
    if (typeof processAI === 'function') {
        processAI();
    }
}