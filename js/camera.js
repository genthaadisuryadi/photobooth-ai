// js/camera.js

let videoStream = null;

async function initCamera() {
    const video = document.getElementById('webcam-video');
    if (!video) return;

    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        
        // Meminta resolusi standar yang stabil agar tidak memaksa crop/zoom berlebihan di HP
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: false
        };

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        video.srcObject = videoStream;
        
        // Mengatur efek cermin (mirror) yang natural pada preview kamera depan
        video.style.transform = "scaleX(-1)";
        video.style.objectFit = "contain";

        await video.play();

        const btnCapture = document.getElementById('btn-capture');
        if (btnCapture) {
            const newBtn = btnCapture.cloneNode(true);
            btnCapture.parentNode.replaceChild(newBtn, btnCapture);
            newBtn.addEventListener('click', startCountdown);
        }

    } catch (err) {
        console.error("Akses kamera ditolak atau tidak ditemukan:", err);
        alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan di peramban Anda.");
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
    
    // Mengambil ukuran sensor asli video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    ctx.save();
    
    // Menyelaraskan hasil tangkapan foto agar normal dan tidak terbalik mirror
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