// js/camera.js

let videoStream = null;

async function initCamera() {
    const video = document.getElementById('webcam-video');
    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
            audio: false
        });
        
        video.srcObject = videoStream;
        await video.play();

        const btnCapture = document.getElementById('btn-capture');
        if (btnCapture) {
            const newBtn = btnCapture.cloneNode(true);
            btnCapture.parentNode.replaceChild(newBtn, btnCapture);
            newBtn.addEventListener('click', startCountdown);
        }

    } catch (err) {
        console.error("Akses kamera ditolak atau tidak ditemukan:", err);
        alert("Gagal mengakses kamera. Pastikan webcam terhubung dan diizinkan oleh peramban.");
    }
}

function startCountdown() {
    const btnCapture = document.getElementById('btn-capture');
    btnCapture.disabled = true;
    
    const display = document.getElementById('countdown-display');
    const number = document.getElementById('countdownNumber');
    display.classList.remove('hidden');
    
    let count = 3;
    number.innerText = count;
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            number.innerText = count;
        } else {
            clearInterval(interval);
            display.classList.add('hidden');
            takePhoto();
            btnCapture.disabled = false;
        }
    }, 1000);
}

function takePhoto() {
    const canvas = document.getElementById('capture-canvas');
    const video = document.getElementById('webcam-video');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1920; 
    canvas.height = 1200;

    // =======================================================
    // LOGIKA ANTI-MIRROR SAAT MEMOTRET (FOTO DIAMBIL)
    // =======================================================
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
    const videoRatio = video.videoWidth / video.videoHeight;
    const canvasRatio = canvas.width / canvas.height;
    
    let drawWidth, drawHeight, offsetX, offsetY;

    if (videoRatio > canvasRatio) {
        drawHeight = canvas.height;
        drawWidth = video.videoWidth * (canvas.height / video.videoHeight);
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
    } else {
        drawWidth = canvas.width;
        drawHeight = video.videoHeight * (canvas.width / video.videoWidth);
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
    }

    ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Wajib kembalikan matriks normal

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    AppState.captureImageURL = imgData;
    
    const previewImg = document.getElementById('capture-preview-img');
    previewImg.src = imgData;
    
    document.getElementById('capture-decision').classList.remove('hidden');
    video.pause(); 
}

window.retakePhoto = function() {
    document.getElementById('capture-decision').classList.add('hidden');
    const video = document.getElementById('webcam-video');
    video.play();
}

window.startAIProcessing = function() {
    document.getElementById('capture-decision').classList.add('hidden');
    navigateTo('screen-review');
    
    if (typeof processAI === 'function') {
        processAI();
    }
}