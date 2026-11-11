// js/camera.js

let videoStream = null;

async function initCamera() {
    const video = document.getElementById('webcam-video');
    if (!video) return;

    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        
        // Meminta stream kamera depan secara stabil
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
        
        // Mengatur gaya mirror yang natural dan ukuran penuh
        video.style.transform = "scaleX(-1)";
        video.style.objectFit = "cover";

        await video.play();

        // Memastikan tombol ambil foto terikat dengan benar
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
    
    let overlay = document.getElementById('countdown-overlay');
    if (!overlay) {
        const videoContainer = document.getElementById('webcam-video').parentElement;
        overlay = document.createElement('div');
        overlay.id = 'countdown-overlay';
        overlay.className = 'absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-all';
        overlay.innerHTML = '<span id="countdown-number" class="text-[160px] font-black text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-pulse">3</span>';
        videoContainer.appendChild(overlay);
    } else {
        overlay.classList.remove('hidden');
        document.getElementById('countdown-number').innerText = '3';
    }

    let count = 3;
    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            document.getElementById('countdown-number').innerText = count;
        } else {
            clearInterval(timer);
            overlay.classList.add('hidden');
            if (btnCapture) btnCapture.disabled = false;
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
    
    // Menyelaraskan hasil tangkapan foto agar normal dan tidak terbalik
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