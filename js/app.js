// ==========================================
// KONFIGURASI API SERVERLESS
// ==========================================
const API_URLS = {
    settings: 'https://api.agenticaicenter.id/settings.php',
    styles: 'https://api.agenticaicenter.id/styles.php',
    tickets: 'https://api.agenticaicenter.id/tickets.php',
    upload: 'https://api.agenticaicenter.id/upload.php'
};

let appSettings = { apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', aiModel: 'gpt-image-2.5-sunburst' };
let availableStyles = {};
let selectedStyleId = null;
let pbVideoStream = null;
let pbCapturedBase64 = null;
let html5QrcodeScanner = null;

// ==========================================
// INISIALISASI UTAMA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = window.location.href.toLowerCase().includes('admin') || document.querySelector('.admin-dashboard') !== null || !document.getElementById('screen-welcome');

    if (!isAdmin) {
        setupEventListeners();
        await loadSettings();
        await loadStyles();
    }
});

// ==========================================
// PENGAMBILAN DATA (MURNI DARI API HOSTING)
// ==========================================
async function loadSettings() {
    try {
        const response = await fetch(API_URLS.settings);
        if (response.ok) {
            const data = await response.json();
            appSettings = { ...appSettings, ...data };
        }
    } catch (error) { console.error("Gagal load settings:", error); }
}

async function loadStyles() {
    try {
        const response = await fetch(API_URLS.styles);
        if (response.ok) {
            availableStyles = await response.json();
        }
    } catch (error) { 
        console.warn("Gagal terhubung ke API Styles."); 
    } finally {
        initHeroAnimation();
        renderStyleOptions();
    }
}

function getImageUrl(path) {
    if (!path) return '/assets/placeholder.jpg';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return path; 
    if (path.startsWith('assets/')) return `/${path}`; 
    return `https://api.agenticaicenter.id/${path}`;
}

// ==========================================
// FUNGSI GLOBAL & EVENT LISTENER HTML
// ==========================================
window.switchScreen = (screenId) => {
    document.querySelectorAll('section[id^="screen-"]').forEach(s => s.classList.add('screen-hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('screen-hidden');
};

function setupEventListeners() {
    document.getElementById('btn-start')?.addEventListener('click', () => {
        switchScreen('screen-pin');
        initQRScanner();
    });
    
    document.getElementById('btn-cancel-token')?.addEventListener('click', () => {
        switchScreen('screen-welcome');
        if (html5QrcodeScanner) {
            html5QrcodeScanner.clear().catch(e => console.error(e));
            html5QrcodeScanner = null;
        }
    });

    document.getElementById('btn-submit-token')?.addEventListener('click', () => {
        const token = document.getElementById('token-input')?.value.trim();
        if (token) validateTicket(token);
        else {
            const err = document.getElementById('token-error');
            if (err) err.innerText = "Masukkan kode tiket terlebih dahulu!";
        }
    });

    document.getElementById('btn-next-integrated')?.addEventListener('click', () => {
        switchScreen('screen-capture');
        initWebcam();
    });

    document.getElementById('btn-capture')?.addEventListener('click', takePhoto);
    document.getElementById('btn-retake')?.addEventListener('click', () => {
        document.getElementById('capture-decision')?.classList.add('hidden');
    });
    document.getElementById('btn-proceed-ai')?.addEventListener('click', processAIGeneration);
}

window.submitToken = () => {
    const token = document.getElementById('token-input')?.value.trim();
    if (token) validateTicket(token);
    else {
        const err = document.getElementById('token-error');
        if (err) err.innerText = "Masukkan kode tiket terlebih dahulu!";
    }
};
window.cancelTokenScreen = () => {
    switchScreen('screen-welcome');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.error(e));
        html5QrcodeScanner = null;
    }
};
window.confirmIntegratedOptionsAndGo = () => {
    switchScreen('screen-capture');
    initWebcam();
};
window.retakePhoto = () => document.getElementById('capture-decision')?.classList.add('hidden');
window.startAIProcessing = () => processAIGeneration();

// ==========================================
// SCANNER QR TIKET
// ==========================================
function initQRScanner() {
    if (html5QrcodeScanner) return; 
    const qrNode = document.getElementById('qr-reader');
    if (!qrNode) return;

    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    html5QrcodeScanner.render((decodedText) => {
        document.getElementById('token-input').value = decodedText;
        validateTicket(decodedText);
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
    }, (error) => {});
}

// ==========================================
// ANIMASI GALERI PANGGUNG (WELCOME SCREEN)
// ==========================================
function initHeroAnimation() {
    const leftContainer = document.getElementById('welcome-gallery-left');
    const rightContainer = document.getElementById('welcome-gallery-right');
    if (!leftContainer || !rightContainer) return;

    leftContainer.innerHTML = '';
    rightContainer.innerHTML = '';
    let styleKeys = Object.keys(availableStyles);
    let isDummy = false;
    
    // Jika API benar-benar kosong, gunakan 4 gambar dummy HANYA untuk mempercantik animasi panggung depan
    if (styleKeys.length === 0) {
        isDummy = true;
        const dummies = [
            'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&q=80',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
            'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80'
        ];
        styleKeys = [0, 1, 2, 3];
        availableStyles = styleKeys.map((_, i) => ({ cover: dummies[i] }));
    }

    if (styleKeys.length > 10) styleKeys = styleKeys.slice(0, 10);
    const imagesToRender = [...styleKeys, ...styleKeys, ...styleKeys];

    imagesToRender.forEach((key, index) => {
        const style = availableStyles[key];
        const imgSrc = isDummy ? style.cover : getImageUrl(style.cover);
        const imgHtml = `<img src="${imgSrc}" onerror="this.src='/assets/placeholder.jpg'" class="w-full h-[280px] object-cover rounded-2xl border border-white/10 shadow-xl mb-3">`;

        if (index % 2 === 0) leftContainer.innerHTML += imgHtml;
        else rightContainer.innerHTML += imgHtml;
    });

    // Kembalikan ke state kosong jika menggunakan dummy
    if (isDummy) availableStyles = {};
}

// ==========================================
// RENDER PILIHAN STYLE
// ==========================================
function renderStyleOptions() {
    const container = document.getElementById('style-list-container');
    if (!container) return;
    container.innerHTML = "";

    // Indikator jika database kosong
    if (Object.keys(availableStyles).length === 0) {
        container.innerHTML = `
            <div class="p-6 text-center border-2 border-dashed border-white/10 rounded-xl bg-white/5">
                <p class="text-sm font-medium text-booth-muted">Belum ada gaya yang tersedia.</p>
                <p class="text-xs text-white/40 mt-1">Silakan tambahkan gaya dan gambar melalui Admin Panel.</p>
            </div>
        `;
        return;
    }

    for (const [id, style] of Object.entries(availableStyles)) {
        const imgSrc = getImageUrl(style.cover);
        const div = document.createElement('div');
        div.className = 'style-card cursor-pointer p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-4';
        
        div.innerHTML = `
            <img src="${imgSrc}" onerror="this.src='/assets/placeholder.jpg'" class="w-16 h-16 object-cover rounded-lg shadow-md border border-white/10">
            <div>
                <h3 class="font-bold text-white">${style.name}</h3>
                <p class="text-xs text-booth-muted line-clamp-1">${style.description || 'Gaya Interaktif'}</p>
            </div>
        `;
        
        div.onclick = () => {
            selectedStyleId = id;
            document.querySelectorAll('.style-card').forEach(el => el.classList.remove('border-booth-accent', 'bg-booth-accent/10'));
            div.classList.add('border-booth-accent', 'bg-booth-accent/10');

            const previewImg = document.getElementById('integrated-preview-img');
            const previewName = document.getElementById('integrated-preview-name');
            const previewDesc = document.getElementById('integrated-preview-desc');
            const btnNext = document.getElementById('btn-next-integrated');

            if (previewImg) previewImg.src = imgSrc;
            if (previewName) previewName.innerText = style.name;
            if (previewDesc) previewDesc.innerText = style.description || style.prompt_template;
            if (btnNext) btnNext.disabled = false;
        };
        container.appendChild(div);
    }
}

// ==========================================
// VALIDASI, KAMERA & AI
// ==========================================
async function validateTicket(token) {
    const errEl = document.getElementById('token-error');
    if (errEl) errEl.innerText = "Memvalidasi tiket...";
    try {
        const response = await fetch(`${API_URLS.tickets}?action=validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        const data = await response.json();
        if (data.success) {
            if (errEl) errEl.innerText = "";
            switchScreen('screen-style');
            if (html5QrcodeScanner) {
                html5QrcodeScanner.clear().catch(e => console.error(e));
                html5QrcodeScanner = null;
            }
        } else {
            if (errEl) errEl.innerText = "Tiket tidak valid atau sudah terpakai.";
        }
    } catch (error) {
        if (errEl) errEl.innerText = "Gagal terhubung ke server API.";
    }
}

async function initWebcam() {
    const videoEl = document.getElementById('webcam-video');
    if (!videoEl) return;
    try {
        pbVideoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" }, 
            audio: false 
        });
        videoEl.srcObject = pbVideoStream;
    } catch (error) { console.error("Kamera error:", error); }
}

function takePhoto() {
    const videoEl = document.getElementById('webcam-video');
    const canvasEl = document.getElementById('capture-canvas');
    if (!videoEl || !canvasEl) return;

    const context = canvasEl.getContext('2d');
    canvasEl.width = videoEl.videoWidth || 1280;
    canvasEl.height = videoEl.videoHeight || 720;
    
    context.translate(canvasEl.width, 0);
    context.scale(-1, 1);
    context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    
    pbCapturedBase64 = canvasEl.toDataURL('image/jpeg', 0.9);
    
    const decisionModal = document.getElementById('capture-decision');
    const previewImg = document.getElementById('capture-preview-img');
    if (previewImg) previewImg.src = pbCapturedBase64;
    if (decisionModal) decisionModal.classList.remove('hidden');
}

async function processAIGeneration() {
    document.getElementById('capture-decision')?.classList.add('hidden');
    switchScreen('screen-review');
    
    const statusText = document.getElementById('ai-status-text');
    const progressText = document.getElementById('ai-progress-text');
    const progressBar = document.getElementById('ai-progress-bar');
    const blurImg = document.getElementById('review-blurred-img');

    if (blurImg) blurImg.src = pbCapturedBase64;
    
    const updateProgress = (pct, txt) => {
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressText) progressText.innerText = `${pct}%`;
        if (statusText) statusText.innerText = txt;
    };

    try {
        updateProgress(20, "Menghubungi AI Server...");
        const styleData = availableStyles[selectedStyleId] || { prompt_template: "HD Portrait" };
        const base64Image = pbCapturedBase64.replace(/^data:image\/\w+;base64,/, "");

        updateProgress(50, "Menerapkan gaya fotomu...");
        const response = await fetch(`${appSettings.apiBaseUrl}/images/edits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appSettings.apiKey}` },
            body: JSON.stringify({ model: appSettings.aiModel, prompt: styleData.prompt_template, image: base64Image, n: 1, size: "1024x1024" })
        });
        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);

        if (data.data && data.data[0] && data.data[0].b64_json) {
            updateProgress(80, "Selesai! Mengunggah ke server...");
            const finalImage = `data:image/jpeg;base64,${data.data[0].b64_json}`;
            await finalizePhotoAndUpload(finalImage, pbCapturedBase64);
            updateProgress(100, "Siap ditampilkan!");
        } else { throw new Error("Format respons AI tidak valid."); }
    } catch (error) {
        alert(`Gagal memproses AI: ${error.message}`);
        switchScreen('screen-capture'); 
    }
}

async function finalizePhotoAndUpload(aiImageBase64, originalImageBase64) {
    try {
        const responseAi = await fetch(API_URLS.upload, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: aiImageBase64 })
        });
        const dataAi = await responseAi.json();

        if (dataAi.success && dataAi.url) {
            document.getElementById('result-original-img').src = originalImageBase64;
            document.getElementById('result-final-img').src = aiImageBase64;
            
            document.getElementById('qrcode-original').innerHTML = "";
            document.getElementById('qrcode-ai').innerHTML = "";
            
            new QRCode(document.getElementById('qrcode-original'), { text: dataAi.url, width: 120, height: 120 });
            new QRCode(document.getElementById('qrcode-ai'), { text: dataAi.url, width: 120, height: 120 });
            
            switchScreen('screen-result');
        } else { throw new Error("Upload ke hosting gagal."); }
    } catch (error) { 
        alert("Gagal mengunggah foto ke jaringan."); 
        switchScreen('screen-capture'); 
    }
}