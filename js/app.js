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

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadStyles();

    // Deteksi jika berada di halaman Admin, jangan jalankan UI Photobooth
    const isAdmin = window.location.href.toLowerCase().includes('admin') || document.querySelector('.admin-dashboard') !== null || !document.getElementById('screen-welcome');

    if (!isAdmin) {
        initHeroAnimation();
        initCamera();
        setupEventListeners();
    }
});

// ==========================================
// PENGAMBILAN DATA DARI API
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
            initHeroAnimation();
            renderStyleOptions();
        }
    } catch (error) { console.error("Gagal load styles:", error); }
}

// ==========================================
// KONTROL NAVIGASI LAYAR
// ==========================================
function switchScreen(screenId) {
    document.querySelectorAll('section[id^="screen-"]').forEach(s => {
        s.classList.add('screen-hidden');
    });
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('screen-hidden');
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

    // Jika katalog API kosong, gunakan gambar placeholder
    if (styleKeys.length === 0) {
        isDummy = true;
        const dummies = [
            'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&q=80',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
            'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80'
        ];
        styleKeys = [0, 1, 2, 3];
        availableStyles = styleKeys.map((_, i) => ({ cover: dummies[i], name: `Contoh ${i+1}` }));
    }

    // Gandakan array agar pergerakan looping ke atas tidak terputus
    const imagesToRender = [...styleKeys, ...styleKeys, ...styleKeys, ...styleKeys];

    imagesToRender.forEach((key, index) => {
        const style = availableStyles[key];
        const imgSrc = isDummy ? style.cover : (style.cover ? `https://api.agenticaicenter.id/${style.cover}` : 'assets/placeholder.jpg');
        const imgHtml = `<img src="${imgSrc}" class="w-full h-[280px] object-cover rounded-2xl border border-white/10 shadow-xl">`;

        // Pisahkan ke lajur kiri dan kanan
        if (index % 2 === 0) leftContainer.innerHTML += imgHtml;
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
                <p class="text-xs text-booth-muted line-clamp-1">${style.description || 'Pilih gaya fotomu di sini'}</p>
            </div>
        `;
        
        div.onclick = () => {
            selectedStyleId = id;
            
            // UI Highlight
            document.querySelectorAll('.style-card').forEach(el => el.classList.remove('border-booth-accent', 'bg-booth-accent/10'));
            div.classList.add('border-booth-accent', 'bg-booth-accent/10');

            // Update Panel Kanan (Integrated Preview)
            const previewImg = document.getElementById('integrated-preview-img');
            const previewName = document.getElementById('integrated-preview-name');
            const previewDesc = document.getElementById('integrated-preview-desc');
            const btnNext = document.getElementById('btn-next-integrated');

            if (previewImg) previewImg.src = imgSrc;
            if (previewName) previewName.innerText = style.name;
            if (previewDesc) previewDesc.innerText = style.description || style.prompt_template;
            
            // Aktifkan tombol lanjut
            if (btnNext) btnNext.disabled = false;
        };
        container.appendChild(div);
    }
}

// ==========================================
// EVENT LISTENERS TOMBOL UTAMA
// ==========================================
function setupEventListeners() {
    // Tombol Mulai Sesi -> Buka Layar Tiket
    document.getElementById('btn-start')?.addEventListener('click', () => switchScreen('screen-pin'));
    
    // Tombol Batal -> Kembali ke Welcome
    document.getElementById('btn-cancel-token')?.addEventListener('click', () => switchScreen('screen-welcome'));
    
    // Tombol Lanjut ke Kamera
    document.getElementById('btn-next-integrated')?.addEventListener('click', () => switchScreen('screen-capture'));

    // Validasi Tiket
    document.getElementById('btn-submit-token')?.addEventListener('click', () => {
        const token = document.getElementById('token-input')?.value.trim();
        if (token) validateTicket(token);
        else document.getElementById('token-error').innerText = "Masukkan kode tiket terlebih dahulu!";
    });

    // Kontrol Kamera
    document.getElementById('btn-capture')?.addEventListener('click', takePhoto);
    document.getElementById('btn-retake')?.addEventListener('click', () => {
        document.getElementById('capture-decision').classList.add('hidden');
    });
    document.getElementById('btn-proceed-ai')?.addEventListener('click', processAIGeneration);
}

// ==========================================
// PROSES VALIDASI, KAMERA & AI
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
        } else {
            if (errEl) errEl.innerText = "Tiket tidak valid atau sudah terpakai.";
        }
    } catch (error) {
        if (errEl) errEl.innerText = "Gagal terhubung ke server API.";
    }
}

async function initCamera() {
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
    
    // Cermin
    context.translate(canvasEl.width, 0);
    context.scale(-1, 1);
    context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    
    pbCapturedBase64 = canvasEl.toDataURL('image/jpeg', 0.9);
    
    // Munculkan popup konfirmasi hasil jepretan
    const decisionModal = document.getElementById('capture-decision');
    const previewImg = document.getElementById('capture-preview-img');
    if (previewImg) previewImg.src = pbCapturedBase64;
    if (decisionModal) decisionModal.classList.remove('hidden');
}

async function processAIGeneration() {
    // Tutup popup konfirmasi, pindah ke layar loading AI
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
            // Pasang gambar ke layar hasil akhir
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