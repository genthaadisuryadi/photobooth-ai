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
let appSettings = {
    apiKey: '',
    apiBaseUrl: 'https://api.openai.com/v1',
    aiModel: 'gpt-image-2.5-sunburst'
};
let availableStyles = {};
let selectedStyleId = null;
let videoStream = null;
let capturedBase64 = null;

// ==========================================
// DOM ELEMENTS
// ==========================================
const elements = {
    video: document.getElementById('camera-stream'),
    canvas: document.getElementById('photo-canvas'),
    resultImage: document.getElementById('result-image'),
    qrContainer: document.getElementById('qr-code-container'),
    btnCapture: document.getElementById('btn-capture'),
    ticketInput: document.getElementById('ticket-input'),
    btnSubmitTicket: document.getElementById('btn-submit-ticket'),
    loadingScreen: document.getElementById('loading-screen'),
    styleContainer: document.getElementById('style-container'),
    
    // Pencarian wadah gambar panggung secara agresif
    heroImageContainer: document.querySelector('.hero-images') || document.getElementById('floating-gallery') || document.querySelector('.right-panel') || document.querySelector('body > div > div:last-child'),
    
    // Admin Dashboard
    btnGenerateTicket: document.getElementById('btn-generate-ticket'),
    ticketDisplay: document.getElementById('ticket-display'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    inputApiKey: document.getElementById('input-api-key'),
    countTiketAktif: document.getElementById('count-tiket-aktif'),
    countTiketTerpakai: document.getElementById('count-tiket-terpakai'),
    countKatalogStyle: document.getElementById('count-katalog-style')
};

// ==========================================
// INISIALISASI AWAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadStyles();
    
    const isAdmin = window.location.href.toLowerCase().includes('admin') || 
                    document.body.innerText.includes('NODE.JS SERVER') ||
                    document.querySelector('.admin-dashboard') !== null;
    
    if (isAdmin) {
        loadAdminDashboard();
        setupAdminListeners();
    } else {
        initHeroAnimation();
        initCamera();
        setupEventListeners();
    }
});

// ==========================================
// PENGAMBILAN DATA & DASHBOARD ADMIN
// ==========================================
async function loadSettings() {
    try {
        const response = await fetch(API_URLS.settings);
        if (response.ok) {
            const data = await response.json();
            appSettings = { ...appSettings, ...data };
            if (elements.inputApiKey) elements.inputApiKey.value = appSettings.apiKey || '';
        }
    } catch (error) {
        console.error("Gagal memuat settings:", error);
    }
}

async function loadStyles() {
    try {
        const response = await fetch(API_URLS.styles);
        if (response.ok) {
            availableStyles = await response.json();
            renderStyleOptions();
        }
    } catch (error) {
        console.error("Gagal memuat styles:", error);
    }
}

async function loadAdminDashboard() {
    try {
        const allElements = document.querySelectorAll('span, p, div');
        for (let el of allElements) {
            if (el.innerText && el.innerText.includes('NODE.JS SERVER') && el.innerText.includes('Offline')) {
                el.innerHTML = 'API HOSTING <span style="color: #10B981; font-weight: bold; margin-left: 5px;">Online</span>';
                break;
            }
        }

        const resTickets = await fetch(API_URLS.tickets);
        let aktif = 0, terpakai = 0;
        if (resTickets.ok) {
            const tickets = await resTickets.json();
            for (let key in tickets) {
                if (tickets[key].status === 'active') aktif++;
                if (tickets[key].status === 'used') terpakai++;
            }
        }

        const totalStyles = Object.keys(availableStyles).length;

        if (elements.countTiketAktif) elements.countTiketAktif.innerText = aktif;
        if (elements.countTiketTerpakai) elements.countTiketTerpakai.innerText = terpakai;
        if (elements.countKatalogStyle) elements.countKatalogStyle.innerText = totalStyles;
        
        const numberElements = document.querySelectorAll('.bg-white h2, .bg-white .text-5xl, .card h2');
        if (numberElements.length >= 3) {
            numberElements[0].innerText = aktif;
            numberElements[1].innerText = terpakai;
            numberElements[2].innerText = totalStyles;
        }
    } catch (error) {
        console.error("Gagal memuat dashboard admin:", error);
    }
}

// ==========================================
// UI & ANIMASI GAMBAR MELAYANG (FORCED CSS)
// ==========================================
function initHeroAnimation() {
    let container = elements.heroImageContainer;
    if (!container) return; 
    
    // Injeksi keyframe CSS untuk animasi naik
    if (!document.getElementById('hero-keyframes')) {
        const style = document.createElement('style');
        style.id = 'hero-keyframes';
        style.innerHTML = `@keyframes scrollUp { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }`;
        document.head.appendChild(style);
    }

    container.innerHTML = ''; 
    // Paksa kontainer menjadi Flexbox agar sejajar
    container.style.display = 'flex';
    container.style.gap = '1.5rem';
    container.style.overflow = 'hidden';
    container.style.height = '100vh';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.padding = '2rem';
    
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
        col.style.display = 'flex';
        col.style.flexDirection = 'column';
        col.style.gap = '1.5rem';
        col.style.width = '240px';
        col.style.animation = `scrollUp ${15 + i * 5}s linear infinite`;
        if (i % 2 !== 0) col.style.animationDirection = 'reverse';
        
        const imagesToRender = [...styleKeys, ...styleKeys, ...styleKeys];
        
        imagesToRender.forEach(key => {
            const style = availableStyles[key];
            const img = document.createElement('img');
            img.style.width = '100%';
            img.style.borderRadius = '1rem';
            img.style.objectFit = 'cover';
            img.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
            img.src = isDummy ? style.cover : (style.cover ? `https://api.agenticaicenter.id/${style.cover}` : 'assets/placeholder.jpg');
            col.appendChild(img);
        });
        
        container.appendChild(col);
    }
    
    if (isDummy) availableStyles = {}; 
}

function renderStyleOptions() {
    if (!elements.styleContainer) return;
    elements.styleContainer.innerHTML = "";
    
    for (const [id, style] of Object.entries(availableStyles)) {
        const div = document.createElement('div');
        div.className = 'style-card';
        div.innerHTML = `
            <img src="${style.cover ? `https://api.agenticaicenter.id/${style.cover}` : 'assets/placeholder.jpg'}" alt="${style.name}">
            <h3>${style.name}</h3>
        `;
        div.onclick = () => {
            selectedStyleId = id;
            document.querySelectorAll('.style-card').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
        };
        elements.styleContainer.appendChild(div);
    }
}

// ==========================================
// KONTROL KAMERA & PROSES AI
// ==========================================
async function initCamera() {
    if (!elements.video) return;
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" },
            audio: false
        });
        elements.video.srcObject = videoStream;
        elements.video.play();
    } catch (error) {
        console.error("Gagal mengakses kamera:", error);
    }
}

function takePhoto() {
    if (!elements.video || !elements.canvas) return;
    
    const context = elements.canvas.getContext('2d');
    elements.canvas.width = elements.video.videoWidth;
    elements.canvas.height = elements.video.videoHeight;
    
    context.translate(elements.canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(elements.video, 0, 0, elements.canvas.width, elements.canvas.height);
    
    capturedBase64 = elements.canvas.toDataURL('image/jpeg', 0.9);
    processAIGeneration();
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
            alert("Tiket Valid! Silakan pilih gaya dan mulai berfoto.");
            return true;
        } else {
            alert("Tiket tidak valid atau sudah terpakai.");
            return false;
        }
    } catch (error) {
        hideLoading();
        alert("Terjadi kesalahan jaringan saat memvalidasi tiket.");
        return false;
    }
}

async function processAIGeneration() {
    if (!capturedBase64) return alert("Belum ada foto yang ditangkap.");
    if (!selectedStyleId || !availableStyles[selectedStyleId]) return alert("Pilih gaya foto terlebih dahulu.");
    if (!appSettings.apiKey) return alert("API Key OpenAI belum dikonfigurasi di Settings.");

    showLoading("AI sedang memproses mahakarya Anda...");

    try {
        const styleData = availableStyles[selectedStyleId];
        const promptText = styleData.prompt_template || "Creative portrait, highly detailed.";
        const base64Image = capturedBase64.replace(/^data:image\/\w+;base64,/, "");

        const payload = {
            model: appSettings.aiModel,
            prompt: promptText,
            image: base64Image, 
            n: 1,
            size: "1024x1024"
        };

        const response = await fetch(`${appSettings.apiBaseUrl}/images/edits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${appSettings.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);

        if (data.data && data.data[0] && data.data[0].b64_json) {
            const finalImageBase64 = `data:image/jpeg;base64,${data.data[0].b64_json}`;
            if (elements.resultImage) elements.resultImage.src = finalImageBase64;
            await finalizePhotoAndUpload(finalImageBase64);
        } else {
            throw new Error("Format respons OpenAI tidak sesuai dugaan.");
        }
    } catch (error) {
        console.error("AI Processing gagal:", error);
        alert(`Gagal memproses gambar AI: ${error.message}`);
    } finally {
        hideLoading();
    }
}

async function finalizePhotoAndUpload(imageBase64) {
    showLoading("Menyiapkan QR Code untuk di-upload...");
    try {
        const response = await fetch(API_URLS.upload, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageBase64 })
        });
        const data = await response.json();
        if (data.success && data.url) {
            generateQR(data.url);
        } else {
            throw new Error(data.message || "Gagal upload gambar.");
        }
    } catch (error) {
        console.error("Upload ke server gagal:", error);
        alert("Gagal melakukan upload foto ke server. Silakan coba lagi.");
    } finally {
        hideLoading();
    }
}

function generateQR(url) {
    if (!elements.qrContainer) return;
    elements.qrContainer.innerHTML = ""; 
    new QRCode(elements.qrContainer, {
        text: url, width: 256, height: 256,
        colorDark : "#000000", colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

// ==========================================
// FUNGSI ADMIN & EVENT LISTENERS
// ==========================================
async function generateTicket() {
    try {
        showLoading("Membuat tiket baru...");
        const response = await fetch(`${API_URLS.tickets}?action=generate`, { method: 'POST', body: JSON.stringify({}) });
        const data = await response.json();
        hideLoading();
        if (data.success) {
            if (elements.ticketDisplay) elements.ticketDisplay.innerText = data.token;
            alert(`Tiket berhasil dibuat: ${data.token}`);
            loadAdminDashboard();
        }
    } catch (error) {
        hideLoading();
        alert("Kesalahan jaringan saat membuat tiket.");
    }
}

async function saveAdminSettings(newSettings) {
    try {
        showLoading("Menyimpan pengaturan...");
        const response = await fetch(API_URLS.settings, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSettings)
        });
        const data = await response.json();
        hideLoading();
        if(data.success) {
            alert("Pengaturan berhasil disimpan ke server!");
            await loadSettings();
        }
    } catch(err) {
        hideLoading();
    }
}

function setupEventListeners() {
    if (elements.btnSubmitTicket) {
        elements.btnSubmitTicket.addEventListener('click', () => {
            if (elements.ticketInput.value.trim()) validateTicket(elements.ticketInput.value.trim());
        });
    }
    if (elements.btnCapture) elements.btnCapture.addEventListener('click', takePhoto);
}

function setupAdminListeners() {
    if (elements.btnGenerateTicket) elements.btnGenerateTicket.addEventListener('click', generateTicket);
    if (elements.btnSaveSettings) {
        elements.btnSaveSettings.addEventListener('click', () => {
            saveAdminSettings({ ...appSettings, apiKey: elements.inputApiKey ? elements.inputApiKey.value.trim() : appSettings.apiKey });
        });
    }
}

function showLoading(message = "Loading...") {
    if (elements.loadingScreen) {
        const span = elements.loadingScreen.querySelector('span');
        if(span) span.innerText = message;
        elements.loadingScreen.style.display = "flex";
    }
}

function hideLoading() {
    if (elements.loadingScreen) elements.loadingScreen.style.display = "none";
}