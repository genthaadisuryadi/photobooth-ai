// js/camera.js

let videoStream = null;

async function initCamera() {
    const video = document.getElementById('webcam-video');
    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        
        // Deteksi apakah perangkat mobile/potret atau desktop/lanskap
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
    
    const vWidth = video.videoWidth || 1280;
    const vHeight = video.videoHeight || 720;
    const isPortrait = window.innerHeight > window.innerWidth;

    // Menyesuaikan ukuran canvas secara dinamis dengan orientasi asli kamera (Potret vs Lanskap)
    if (isPortrait && vWidth > vHeight) {
        canvas.width = vHeight;
        canvas.height = vWidth;
    } else {
        canvas.width = vWidth;
        canvas.height = vHeight;
    }

    // =======================================================
    // LOGIKA PENGAMBILAN FOTO: MENGIKUTI ORIENTASI ALAMI
    // =======================================================
    ctx.save();
    
    // Jika ingin efek cermin saat foto, aktifkan baris translate & scale di bawah. 
    // Jika tidak ingin terbalik sama sekali, biarkan tanpa translate/scale mirror.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

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