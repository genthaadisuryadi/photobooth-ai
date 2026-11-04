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
// DOM ELEMENTS (TAMU & ADMIN)
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
    heroImageContainer: document.querySelector('.hero-images') || document.getElementById('floating-gallery') || document.querySelector('.right-panel')
};

const adminElements = {
    btnGenerateTicket: document.getElementById('btn-generate-ticket'),
    ticketDisplay: document.getElementById('ticket-display'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    inputApiKey: document.getElementById('input-api-key')
};

// ==========================================
// INISIALISASI AWAL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadStyles();
    initHeroAnimation();
    initCamera();
    setupEventListeners();
    setupAdminListeners();
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
            if (adminElements.inputApiKey) {
                adminElements.inputApiKey.value = appSettings.apiKey || '';
            }
            console.log("[System] Settings berhasil dimuat dari server.");
        }
    } catch (error) {
        console.error("[Error] Gagal memuat settings:", error);
    }
}

async function loadStyles() {
    try {
        const response = await fetch(API_URLS.styles);
        if (response.ok) {
            availableStyles = await response.json();
            renderStyleOptions();
            console.log("[System] Katalog Style berhasil dimuat.");
        }
    } catch (error) {
        console.error("[Error] Gagal memuat styles:", error);
    }
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
        console.error("[Error] Validasi tiket gagal:", error);
        return false;
    }
}

// ==========================================
// FUNGSI ADMIN PANEl
// ==========================================
async function generateTicket() {
    try {
        showLoading("Membuat tiket baru...");
        const response = await fetch(`${API_URLS.tickets}?action=generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}) 
        });
        
        const data = await response.json();
        hideLoading();
        
        if (data.success) {
            if (adminElements.ticketDisplay) {
                adminElements.ticketDisplay.innerText = data.token;
                adminElements.ticketDisplay.value = data.token; // Jika elemen berupa input text
            }
            alert(`Tiket berhasil dibuat: ${data.token}`);
            console.log("[Admin] Tiket baru:", data.token);
        } else {
            alert("Gagal membuat tiket dari server.");
        }
    } catch (error) {
        hideLoading();
        alert("Kesalahan jaringan saat membuat tiket.");
        console.error("[Error] Generate tiket gagal:", error);
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
        } else {
            alert("Gagal menyimpan pengaturan.");
        }
    } catch(err) {
        hideLoading();
        console.error("Gagal simpan settings", err);
    }
}

// ==========================================
// UI & ANIMASI GAMBAR MELAYANG
// ==========================================
function initHeroAnimation() {
    if (!elements.heroImageContainer) return; 
    
    elements.heroImageContainer.innerHTML = ''; 
    const styleKeys = Object.keys(availableStyles);
    
    if (styleKeys.length === 0) return;

    for (let i = 0; i < 2; i++) {
        const col = document.createElement('div');
        col.className = `hero-column col-${i+1}`; 
        
        const imagesToRender = [...styleKeys, ...styleKeys];
        
        imagesToRender.forEach(key => {
            const style = availableStyles[key];
            const img = document.createElement('img');
            img.src = style.cover ? `https://api.agenticaicenter.id/${style.cover}` : 'assets/placeholder.jpg';
            col.appendChild(img);
        });
        
        elements.heroImageContainer.appendChild(col);
    }
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
// KONTROL KAMERA
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
        console.error("[Error] Gagal mengakses kamera:", error);
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

// ==========================================
// PROSES AI & UPLOAD SERVERLESS
// ==========================================
async function processAIGeneration() {
    if (!capturedBase64) return alert("Belum ada foto yang ditangkap.");
    if (!selectedStyleId || !availableStyles[selectedStyleId]) return alert("Pilih gaya foto terlebih dahulu.");
    if (!appSettings.apiKey) return alert("API Key OpenAI belum dikonfigurasi di Settings.");

    showLoading("AI sedang memproses gambar di Stage...");

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
        console.error("[Error] AI Processing gagal:", error);
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
        console.error("[Error] upload ke server gagal:", error);
        alert("Gagal melakukan upload foto ke server. Silakan coba lagi.");
    } finally {
        hideLoading();
    }
}

function generateQR(url) {
    if (!elements.qrContainer) return;
    elements.qrContainer.innerHTML = ""; 
    
    new QRCode(elements.qrContainer, {
        text: url,
        width: 256,
        height: 256,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
    if (elements.btnSubmitTicket) {
        elements.btnSubmitTicket.addEventListener('click', () => {
            const token = elements.ticketInput.value.trim();
            if (token) validateTicket(token);
        });
    }

    if (elements.btnCapture) {
        elements.btnCapture.addEventListener('click', () => {
            takePhoto();
        });
    }
}

function setupAdminListeners() {
    if (adminElements.btnGenerateTicket) {
        adminElements.btnGenerateTicket.addEventListener('click', generateTicket);
    }
    
    if (adminElements.btnSaveSettings) {
        adminElements.btnSaveSettings.addEventListener('click', () => {
            const newSettings = {
                ...appSettings,
                apiKey: adminElements.inputApiKey ? adminElements.inputApiKey.value.trim() : appSettings.apiKey
            };
            saveAdminSettings(newSettings);
        });
    }
}

function showLoading(message = "Loading...") {
    if (elements.loadingScreen) {
        elements.loadingScreen.querySelector('span').innerText = message;
        elements.loadingScreen.style.display = "flex";
    }
}

function hideLoading() {
    if (elements.loadingScreen) {
        elements.loadingScreen.style.display = "none";
    }
}