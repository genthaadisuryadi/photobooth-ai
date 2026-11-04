// ==========================================
// KONFIGURASI API (FULL HOSTING SERVERLESS)
// ==========================================
const API_URLS = {
    settings: 'https://api.agenticaicenter.id/settings.php',
    styles: 'https://api.agenticaicenter.id/styles.php',
    tickets: 'https://api.agenticaicenter.id/tickets.php',
    upload: 'https://api.agenticaicenter.id/upload.php'
};

// ==========================================
// STATE APLIKASI
// ==========================================
let appSettings = { apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', aiModel: 'gpt-image-2.5-sunburst' };
let availableStyles = {};
let selectedStyleId = null;
let pbVideoStream = null;
let pbCapturedBase64 = null;

// ==========================================
// INISIALISASI AWAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadStyles();
    
    const isAdmin = window.location.href.toLowerCase().includes('admin') || 
                    document.body.innerText.includes('API Server') ||
                    document.querySelector('.admin-dashboard') !== null;
    
    if (isAdmin) {
        loadAdminDashboard();
        setupAdminListeners();
    } else {
        initHeroAnimation();
        initCamera();
        setupUniversalEventListeners();
    }
});

// ==========================================
// API REQUESTS
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
            renderStyleOptions();
            initHeroAnimation();
        }
    } catch (error) { console.error("Gagal load styles:", error); }
}

async function validateTicket(token) {
    try {
        showLoading("Memvalidasi tiket...");
        const response = await fetch(`${API_URLS.tickets}?action=validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            alert("Tiket Valid! Membuka kamera...");
            // Cari elemen pembungkus stage/kamera untuk digeser tampilannya
            const stageSection = document.getElementById('camera-section') || document.querySelector('.camera-view') || document.getElementById('stage-session');
            if (stageSection) stageSection.scrollIntoView({ behavior: 'smooth' });
            else {
                // Fallback jika tidak ada section khusus, sembunyikan area tiket dan tampilkan kamera
                const ticketBox = document.getElementById('ticket-container') || document.querySelector('.ticket-box');
                if (ticketBox) ticketBox.style.display = 'none';
            }
            return true;
        } else {
            alert("Tiket tidak valid atau sudah terpakai.");
            return false;
        }
    } catch (error) {
        hideLoading();
        alert("Gagal koneksi ke server tiket.");
        return false;
    }
}

// ==========================================
// ANIMASI PANGGUNG (HERO SECTION)
// ==========================================
function initHeroAnimation() {
    let container = document.querySelector('.hero-images') || document.getElementById('floating-gallery') || document.querySelector('.right-panel');
    if (!container) {
        const mainWrapper = document.querySelector('main') || document.body.firstElementChild;
        if (mainWrapper && mainWrapper.children.length > 1) {
            container = mainWrapper.lastElementChild;
        } else return;
    }

    if (!document.getElementById('hero-keyframes')) {
        const style = document.createElement('style');
        style.id = 'hero-keyframes';
        style.innerHTML = `@keyframes scrollUp { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }`;
        document.head.appendChild(style);
    }

    container.innerHTML = ''; 
    container.style.display = container.style.display || 'flex';
    container.style.gap = '1.5rem';
    container.style.overflow = 'hidden';
    
    let styleKeys = Object.keys(availableStyles);
    let isDummy = false;
    
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

    for (let i = 0; i < 2; i++) {
        const col = document.createElement('div');
        col.style.cssText = `display:flex; flex-direction:column; gap:1.5rem; width:220px; animation: scrollUp ${18 + i * 6}s linear infinite;`;
        if (i % 2 !== 0) col.style.animationDirection = 'reverse';
        
        const imagesToRender = [...styleKeys, ...styleKeys, ...styleKeys];
        imagesToRender.forEach(key => {
            const style = availableStyles[key];
            const img = document.createElement('img');
            img.style.cssText = 'width:100%; height:300px; border-radius:1rem; object-fit:cover; box-shadow:0 10px 15px -3px rgba(0,0,0,0.5);';
            img.src = isDummy ? style.cover : (style.cover ? `https://api.agenticaicenter.id/${style.cover}` : 'assets/placeholder.jpg');
            col.appendChild(img);
        });
        container.appendChild(col);
    }
    if (isDummy) availableStyles = {}; 
}

function renderStyleOptions() {
    const container = document.getElementById('style-container') || document.querySelector('.style-grid');
    if (!container) return;
    container.innerHTML = "";
    
    for (const [id, style] of Object.entries(availableStyles)) {
        const div = document.createElement('div');
        div.className = 'style-card cursor-pointer p-2 border rounded-xl hover:border-brand-500 transition-all';
        div.innerHTML = `
            <img src="${style.cover ? `https://api.agenticaicenter.id/${style.cover}` : 'assets/placeholder.jpg'}" class="w-full h-40 object-cover rounded-lg mb-2">
            <h3 class="font-bold text-sm">${style.name}</h3>
        `;
        div.onclick = () => {
            selectedStyleId = id;
            document.querySelectorAll('.style-card').forEach(el => el.classList.remove('border-brand-500', 'ring-2'));
            div.classList.add('border-brand-500', 'ring-2');
        };
        container.appendChild(div);
    }
}

// ==========================================
// KAMERA & AI
// ==========================================
async function initCamera() {
    const videoEl = document.getElementById('camera-stream') || document.querySelector('video');
    if (!videoEl) return;
    try {
        pbVideoStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        videoEl.srcObject = pbVideoStream;
        videoEl.play();
    } catch (error) { console.error("Kamera error:", error); }
}

function takePhoto() {
    const videoEl = document.getElementById('camera-stream') || document.querySelector('video');
    const canvasEl = document.getElementById('photo-canvas') || document.createElement('canvas');
    if (!videoEl) return alert("Kamera tidak aktif.");

    const context = canvasEl.getContext('2d');
    canvasEl.width = videoEl.videoWidth || 1280;
    canvasEl.height = videoEl.videoHeight || 720;
    
    context.translate(canvasEl.width, 0);
    context.scale(-1, 1);
    context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    
    pbCapturedBase64 = canvasEl.toDataURL('image/jpeg', 0.9);
    processAIGeneration();
}

async function processAIGeneration() {
    if (!pbCapturedBase64) return alert("Belum ada foto.");
    if (!selectedStyleId) return alert("Silakan pilih salah satu style terlebih dahulu!");
    if (!appSettings.apiKey) return alert("API Key OpenAI belum diatur di menu Admin Settings.");

    showLoading("AI sedang memproses foto Anda...");
    try {
        const styleData = availableStyles[selectedStyleId] || { prompt_template: "HD Portrait" };
        const base64Image = pbCapturedBase64.replace(/^data:image\/\w+;base64,/, "");

        const response = await fetch(`${appSettings.apiBaseUrl}/images/edits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appSettings.apiKey}` },
            body: JSON.stringify({ model: appSettings.aiModel, prompt: styleData.prompt_template, image: base64Image, n: 1, size: "1024x1024" })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        if (data.data && data.data[0] && data.data[0].b64_json) {
            const finalImage = `data:image/jpeg;base64,${data.data[0].b64_json}`;
            const resultImg = document.getElementById('result-image');
            if (resultImg) resultImg.src = finalImage;
            await finalizePhotoAndUpload(finalImage);
        } else { throw new Error("Format respons AI tidak valid."); }
    } catch (error) {
        alert(`Gagal memproses AI: ${error.message}`);
    } finally { hideLoading(); }
}

async function finalizePhotoAndUpload(imageBase64) {
    showLoading("Mengunggah hasil ke server...");
    try {
        const response = await fetch(API_URLS.upload, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageBase64 })
        });
        const data = await response.json();
        if (data.success && data.url) {
            generateQR(data.url);
        } else { throw new Error(data.message || "Gagal upload."); }
    } catch (error) { alert("Gagal mengunggah foto."); }
    finally { hideLoading(); }
}

function generateQR(url) {
    const qrDiv = document.getElementById('qr-code-container');
    if (!qrDiv) return;
    qrDiv.innerHTML = "";
    new QRCode(qrDiv, { text: url, width: 256, height: 256, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
}

// ==========================================
// UNIVERSAL EVENT LISTENERS (ANTI-GAGAL TOMBOL)
// ==========================================
function setupUniversalEventListeners() {
    // Tombol Kirim Tiket / Mulai Sesi
    const ticketBtn = document.getElementById('btn-submit-ticket') || document.querySelector('button[type="submit"]') || document.querySelector('button');
    const ticketInput = document.getElementById('ticket-input') || document.querySelector('input[type="text"]');

    if (ticketBtn) {
        ticketBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const token = ticketInput ? ticketInput.value.trim() : "";
            if (token) validateTicket(token);
            else alert("Masukkan kode tiket terlebih dahulu!");
        });
    }

    // Tombol Ambil Foto / Capture
    const captureBtn = document.getElementById('btn-capture') || document.querySelector('.btn-capture') || document.querySelectorAll('button')[1];
    if (captureBtn) {
        captureBtn.addEventListener('click', (e) => {
            e.preventDefault();
            takePhoto();
        });
    }
}

// ==========================================
// ADMIN LISTENERS
// ==========================================
function setupAdminListeners() {
    const btnGen = document.getElementById('btn-generate-ticket');
    const btnSave = document.getElementById('btn-save-settings');
    const inputKey = document.getElementById('set-apiKey') || document.getElementById('input-api-key');

    if (btnGen) {
        btnGen.addEventListener('click', async () => {
            try {
                const res = await fetch(`${API_URLS.tickets}?action=generate`, { method: 'POST' });
                const data = await res.json();
                if(data.success) {
                    alert(`Tiket Berhasil Dibuat: ${data.token}`);
                    loadAdminDashboard();
                }
            } catch(e) { alert("Gagal membuat tiket"); }
        });
    }

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const newSettings = {
                apiKey: inputKey ? inputKey.value.trim() : appSettings.apiKey,
                apiBaseUrl: appSettings.apiBaseUrl,
                aiModel: appSettings.aiModel
            };
            try {
                const res = await fetch(API_URLS.settings, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newSettings)
                });
                if(res.ok) alert("Pengaturan berhasil disimpan!");
            } catch(e) { alert("Gagal menyimpan pengaturan"); }
        });
    }
}

async function loadAdminDashboard() {
    try {
        const resTickets = await fetch(API_URLS.tickets);
        const tickets = await resTickets.json();
        let active = 0, used = 0;
        Object.values(tickets).forEach(t => { if (t.status === 'active') active++; if (t.status === 'used') used++; });
        
        const elActive = document.getElementById('stat-active-tickets');
        const elUsed = document.getElementById('stat-used-tickets');
        const elTotal = document.getElementById('stat-total-styles');
        
        if (elActive) elActive.innerText = active;
        if (elUsed) elUsed.innerText = used;
        if (elTotal) elTotal.innerText = Object.keys(availableStyles).length;
    } catch (err) { console.error("Gagal load admin dashboard:", err); }
}

function showLoading(msg = "Loading...") {
    const screen = document.getElementById('loading-screen');
    if (screen) {
        const span = screen.querySelector('span');
        if (span) span.innerText = msg;
        screen.style.display = "flex";
    }
}

function hideLoading() {
    const screen = document.getElementById('loading-screen');
    if (screen) screen.style.display = "none";
}