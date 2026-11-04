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

// ==========================================
// INISIALISASI
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadStyles();

    const isAdmin = window.location.href.toLowerCase().includes('admin') || document.querySelector('.admin-dashboard') !== null;

    if (!isAdmin) {
        initHeroAnimation();
        
        // Listener manual untuk tombol yang tidak pakai onclick di HTML
        document.getElementById('btn-start')?.addEventListener('click', () => switchScreen('screen-pin'));
        document.getElementById('btn-capture')?.addEventListener('click', takePhoto);
    }
});

async function loadSettings() {
    try {
        const res = await fetch(API_URLS.settings);
        if (res.ok) appSettings = { ...appSettings, ...(await res.json()) };
    } catch (e) { console.error("Gagal load settings:", e); }
}

async function loadStyles() {
    try {
        const res = await fetch(API_URLS.styles);
        if (res.ok) {
            availableStyles = await res.json();
            initHeroAnimation();
            renderStyleOptions();
        }
    } catch (e) { console.error("Gagal load styles:", e); }
}

// ==========================================
// FUNGSI GLOBAL (DIHUBUNGKAN KE ONCLICK HTML)
// ==========================================
window.switchScreen = (screenId) => {
    document.querySelectorAll('section[id^="screen-"]').forEach(s => s.classList.add('screen-hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('screen-hidden');
};

window.submitToken = () => {
    const token = document.getElementById('token-input')?.value.trim();
    if (token) validateTicket(token);
    else document.getElementById('token-error').innerText = "Ketik kode tiket terlebih dahulu!";
};

window.cancelTokenScreen = () => switchScreen('screen-welcome');
window.confirmIntegratedOptionsAndGo = () => {
    switchScreen('screen-capture');
    initCamera(); // Nyalakan kamera hanya saat masuk layar capture
};
window.retakePhoto = () => document.getElementById('capture-decision')?.classList.add('hidden');
window.startAIProcessing = () => processAIGeneration();

// ==========================================
// ANIMASI PANGGUNG (WELCOME SCREEN)
// ==========================================
function initHeroAnimation() {
    const leftContainer = document.getElementById('welcome-gallery-left');
    const rightContainer = document.getElementById('welcome-gallery-right');
    if (!leftContainer || !rightContainer) return;

    leftContainer.innerHTML = ''; rightContainer.innerHTML = '';
    let styleKeys = Object.keys(availableStyles);
    let isDummy = false;

    if (styleKeys.length === 0) {
        isDummy = true;
        styleKeys = [0, 1, 2, 3];
        const dummies = [
            'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&q=80',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
            'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80'
        ];
        availableStyles = styleKeys.map((_, i) => ({ cover: dummies[i] }));
    }

    const imagesToRender = [...styleKeys, ...styleKeys, ...styleKeys];

    imagesToRender.forEach((key, i) => {
        const style = availableStyles[key];
        const imgSrc = isDummy ? style.cover : (style.cover ? `https://api.agenticaicenter.id/${style.cover}` : 'assets/placeholder.jpg');
        const imgHtml = `<img src="${imgSrc}" class="w-full h-[280px] object-cover rounded-2xl border border-white/10 shadow-xl mb-3">`;

        if (i % 2 === 0) leftContainer.innerHTML += imgHtml;
        else rightContainer.innerHTML += imgHtml;
    });

    if (isDummy) availableStyles = {};
}

// ==========================================
// RENDER PILIHAN STYLE
// ==========================================
function renderStyleOptions() {
    const container = document.getElementById('style-list-container');
    if (!container) return;
    container.innerHTML = "";

    for (const [id, style] of Object.entries(availableStyles)) {
        const imgSrc = style.cover ? `https://api.agenticaicenter.id/${style.cover}` : 'assets/placeholder.jpg';
        const div = document.createElement('div');
        div.className = 'style-card cursor-pointer p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-4';
        div.innerHTML = `
            <img src="${imgSrc}" class="w-16 h-16 object-cover rounded-lg">
            <div>
                <h3 class="font-bold text-white">${style.name}</h3>
                <p class="text-xs text-booth-muted line-clamp-1">${style.description || 'Gaya interaktif'}</p>
            </div>
        `;
        
        div.onclick = () => {
            selectedStyleId = id;
            document.querySelectorAll('.style-card').forEach(el => el.classList.remove('border-booth-accent', 'bg-booth-accent/10'));
            div.classList.add('border-booth-accent', 'bg-booth-accent/10');

            if (document.getElementById('integrated-preview-img')) document.getElementById('integrated-preview-img').src = imgSrc;
            if (document.getElementById('integrated-preview-name')) document.getElementById('integrated-preview-name').innerText = style.name;
            if (document.getElementById('integrated-preview-desc')) document.getElementById('integrated-preview-desc').innerText = style.prompt_template;
            
            if (document.getElementById('btn-next-integrated')) document.getElementById('btn-next-integrated').disabled = false;
        };
        container.appendChild(div);
    }
}

// ==========================================
// VALIDASI, KAMERA & AI
// ==========================================
async function validateTicket(token) {
    document.getElementById('token-error').innerText = "Memvalidasi tiket...";
    try {
        const response = await fetch(`${API_URLS.tickets}?action=validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('token-error').innerText = "";
            switchScreen('screen-style');
        } else document.getElementById('token-error').innerText = "Tiket tidak valid/terpakai.";
    } catch (e) { document.getElementById('token-error').innerText = "Gagal terhubung ke API."; }
}

async function initCamera() {
    const videoEl = document.getElementById('webcam-video');
    if (!videoEl) return;
    try {
        pbVideoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080, facingMode: "user" }, audio: false });
        videoEl.srcObject = pbVideoStream;
    } catch (e) { console.error("Kamera error:", e); }
}

function takePhoto() {
    const videoEl = document.getElementById('webcam-video');
    const canvasEl = document.getElementById('capture-canvas');
    if (!videoEl || !canvasEl) return;

    const context = canvasEl.getContext('2d');
    canvasEl.width = videoEl.videoWidth || 1280; canvasEl.height = videoEl.videoHeight || 720;
    
    context.translate(canvasEl.width, 0); context.scale(-1, 1);
    context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    
    pbCapturedBase64 = canvasEl.toDataURL('image/jpeg', 0.9);
    
    if (document.getElementById('capture-preview-img')) document.getElementById('capture-preview-img').src = pbCapturedBase64;
    document.getElementById('capture-decision')?.classList.remove('hidden');
}

async function processAIGeneration() {
    document.getElementById('capture-decision')?.classList.add('hidden');
    switchScreen('screen-review');
    
    if (document.getElementById('review-blurred-img')) document.getElementById('review-blurred-img').src = pbCapturedBase64;
    
    const updateProgress = (pct, txt) => {
        if (document.getElementById('ai-progress-bar')) document.getElementById('ai-progress-bar').style.width = `${pct}%`;
        if (document.getElementById('ai-progress-text')) document.getElementById('ai-progress-text').innerText = `${pct}%`;
        if (document.getElementById('ai-status-text')) document.getElementById('ai-status-text').innerText = txt;
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
            updateProgress(80, "Mengunggah ke server...");
            const finalImage = `data:image/jpeg;base64,${data.data[0].b64_json}`;
            await finalizePhotoAndUpload(finalImage, pbCapturedBase64);
            updateProgress(100, "Selesai!");
        } else throw new Error("Format respons AI salah.");
    } catch (e) {
        alert(`Gagal memproses AI: ${e.message}`);
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
        } else throw new Error("Gagal upload.");
    } catch (e) { alert("Koneksi gagal saat upload gambar."); switchScreen('screen-capture'); }
}