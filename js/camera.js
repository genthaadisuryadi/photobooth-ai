// js/camera.js

let videoStream = null;

async function initCamera() {
    const video = document.getElementById('webcam-video');
    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        
        const isPortrait = window.innerHeight > window.innerWidth;
        const constraints = {
            video: {
                width: isPortrait ? { ideal: 720 } : { ideal: 1920 },
                height: isPortrait ? { ideal: 1280 } : { ideal: 1080 },
                facingMode: "user"
            },
            audio: false
        };

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        video.srcObject = videoStream;
        
        // PERBAIKAN: Menambahkan gaya transform scaleX(-1) agar preview kamera depan tidak terbalik (mirror) secara natural
        video.style.transform = "scaleX(-1)";
        video.style.objectFit = "contain"; // Mencegah efek zoom/potong berlebihan

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
            btnCapture.disabled = false;
        }
    }, 1000);
}

function takePhoto() {
    const canvas = document.getElementById('capture-canvas');
    const video = document.getElementById('webcam-video');
    const ctx = canvas.getContext('2d');
    
    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isPortrait && vWidth > vHeight) {
        canvas.width = vHeight;
        canvas.height = vWidth;
    } else {
        canvas.width = vWidth;
        canvas.height = vHeight;
    }

    ctx.save();
    // Mengembalikan posisi gambar agar hasil cetak/AI tidak terbalik mirror
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

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