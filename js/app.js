// ==========================================
// KONFIGURASI API SERVERLESS
// ==========================================
const API_URLS = {
    settings: 'https://api.agenticaicenter.id/settings.php',
    styles: 'https://api.agenticaicenter.id/styles.php',
    tickets: 'https://api.agenticaicenter.id/tickets.php',
    upload: 'https://api.agenticaicenter.id/upload.php'
};

const FALLBACK_B64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzFjMWYyOCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgYWxpZ25tZW50LWJhc2VsaW5lPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";

window.imgError = function(img) {
    img.onerror = null; 
    img.src = FALLBACK_B64;
};

let appSettings = { apiKey: '', apiBaseUrl: 'https://api.openai.com/v1', aiModel: 'gpt-image-2.5-sunburst' };
let availableStyles = {};
let selectedStyleId = null;
let selectedOptions = {};
let pbVideoStream = null;
let pbCapturedBase64 = null;
let html5QrcodeScanner = null;

// ==========================================
// INISIALISASI UTAMA
// ==========================================
function initApp() {
    const isAdmin = window.location.href.toLowerCase().includes('admin') || document.querySelector('.admin-dashboard') !== null || !document.getElementById('screen-welcome');
    if (!isAdmin) { 
        setupEventListeners(); 
        loadSettings().then(() => loadStyles()); 
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

async function loadSettings() {
    try {
        const response = await fetch(API_URLS.settings);
        if (response.ok) { const data = await response.json(); appSettings = { ...appSettings, ...data }; }
    } catch (error) { console.error("Gagal load settings:", error); }
}

async function loadStyles() {
    try {
        const response = await fetch(API_URLS.styles);
        if (response.ok) availableStyles = await response.json();
    } catch (error) { console.warn("Gagal terhubung ke API Styles."); } 
    finally { initHeroAnimation(); renderStyleOptions(); }
}

function getImageUrl(path) {
    if (!path) return FALLBACK_B64;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return path; 
    if (path.startsWith('assets/')) return `/${path}`; 
    return `https://api.agenticaicenter.id/${path}`;
}

window.switchScreen = (screenId) => {
    document.querySelectorAll('section[id^="screen-"]').forEach(s => s.classList.add('screen-hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('screen-hidden');
};

function setupEventListeners() {
    document.getElementById('btn-start')?.addEventListener('click', () => { switchScreen('screen-pin'); initQRScanner(); });
    document.getElementById('btn-cancel-token')?.addEventListener('click', () => { 
        switchScreen('screen-welcome'); if (html5QrcodeScanner) { html5QrcodeScanner.clear(); html5QrcodeScanner = null; }
    });
    document.getElementById('btn-submit-token')?.addEventListener('click', window.submitToken);
    document.getElementById('btn-next-integrated')?.addEventListener('click', window.confirmIntegratedOptionsAndGo);
    
    // Memicu Hitung Mundur 5 Detik saat tombol jepret ditekan
    document.getElementById('btn-capture')?.addEventListener('click', startCountdown);
    
    document.getElementById('btn-retake')?.addEventListener('click', window.retakePhoto);
    document.getElementById('btn-proceed-ai')?.addEventListener('click', window.startAIProcessing);
}

window.submitToken = () => {
    const token = document.getElementById('token-input')?.value.trim();
    if (token) validateTicket(token);
    else { const err = document.getElementById('token-error'); if (err) err.innerText = "Masukkan kode tiket terlebih dahulu!"; }
};

function checkReadyStatus(styleData) {
    let isComplete = true;
    if (styleData && styleData.options && styleData.options.length > 0) {
        styleData.options.forEach(optGroup => {
            if (!optGroup.optional) {
                let shouldShow = true;
                if (optGroup.depends_on) {
                    const parentVal = selectedOptions[optGroup.depends_on];
                    if (!parentVal) shouldShow = false;
                }
                if (shouldShow && !selectedOptions[optGroup.id]) isComplete = false;
            }
        });
    }
    const btnNext = document.getElementById('btn-next-integrated');
    if (btnNext) {
        btnNext.disabled = !isComplete;
        if(isComplete) btnNext.classList.remove('opacity-50');
        else btnNext.classList.add('opacity-50');
    }
}

window.confirmIntegratedOptionsAndGo = () => { switchScreen('screen-capture'); initWebcam(); };
window.retakePhoto = () => document.getElementById('capture-decision')?.classList.add('hidden');
window.startAIProcessing = () => processAIGeneration();

function initHeroAnimation() {
    const leftContainer = document.getElementById('welcome-gallery-left');
    const rightContainer = document.getElementById('welcome-gallery-right');
    if (!leftContainer || !rightContainer) return;

    leftContainer.innerHTML = ''; rightContainer.innerHTML = '';
    let styleKeys = Object.keys(availableStyles);
    
    if (styleKeys.length === 0) return;
    if (styleKeys.length > 10) styleKeys = styleKeys.slice(0, 10);
    const imagesToRender = [...styleKeys, ...styleKeys, ...styleKeys];

    imagesToRender.forEach((key, index) => {
        const style = availableStyles[key];
        const imgSrc = getImageUrl(style.cover);
        const imgHtml = `<img src="${imgSrc}" onerror="window.imgError(this)" class="w-full h-[280px] object-cover rounded-2xl border border-white/10 shadow-xl mb-3">`;

        if (index % 2 === 0) leftContainer.innerHTML += imgHtml;
        else rightContainer.innerHTML += imgHtml;
    });
}

function renderStyleOptions() {
    const container = document.getElementById('style-list-container');
    if (!container) return;
    container.innerHTML = "";

    if (Object.keys(availableStyles).length === 0) {
        container.innerHTML = `<div class="p-6 text-center"><p class="text-sm text-booth-muted">Belum ada gaya yang tersedia.</p></div>`;
        return;
    }

    let isFirst = true;

    for (const [id, style] of Object.entries(availableStyles)) {
        const imgSrc = getImageUrl(style.cover);
        const div = document.createElement('div');
        div.className = 'style-card cursor-pointer p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-4';
        
        div.innerHTML = `
            <img src="${imgSrc}" onerror="window.imgError(this)" class="w-16 h-16 object-cover rounded-lg shadow-md border border-white/10">
            <div>
                <h3 class="font-bold text-white">${style.name}</h3>
                <p class="text-xs text-booth-muted line-clamp-1">${style.description || 'Gaya Interaktif'}</p>
            </div>
        `;
        
        div.onclick = () => {
            selectedStyleId = id;
            selectedOptions = {};
            
            document.querySelectorAll('.style-card').forEach(el => el.classList.remove('border-booth-accent', 'bg-booth-accent/10'));
            div.classList.add('border-booth-accent', 'bg-booth-accent/10');

            const previewImg = document.getElementById('integrated-preview-img');
            const previewName = document.getElementById('integrated-preview-name');
            const previewDesc = document.getElementById('integrated-preview-desc');

            if (previewImg) { previewImg.onerror = function(){ window.imgError(this) }; previewImg.src = imgSrc; }
            if (previewName) previewName.innerText = style.name;
            if (previewDesc) previewDesc.innerText = style.description || style.prompt_template;

            renderSubStyleForm(style);
            checkReadyStatus(style);
        };
        
        container.appendChild(div);

        if (isFirst) {
            setTimeout(() => div.click(), 150);
            isFirst = false;
        }
    }
}

function renderSubStyleForm(styleData) {
    let formContainer = document.getElementById('integrated-options-form');
    if (!formContainer) {
        const descEl = document.getElementById('integrated-preview-desc');
        if (descEl) {
            formContainer = document.createElement('div');
            formContainer.id = 'integrated-options-form';
            formContainer.className = 'mt-6 flex flex-col gap-6';
            descEl.parentNode.insertBefore(formContainer, descEl.nextSibling);
        } else return;
    }

    formContainer.innerHTML = ''; 
    if (!styleData.options || styleData.options.length === 0) return;

    styleData.options.forEach(optGroup => {
        const groupDiv = document.createElement('div');
        groupDiv.className = `opt-group-${optGroup.id} flex flex-col gap-3`;
        if (optGroup.depends_on) groupDiv.style.display = 'none';

        let choicesHtml = '';
        optGroup.choices.forEach(choice => {
            const dependsAttr = choice.parent_value ? `data-parent-val="${choice.parent_value}"` : '';
            const hideClass = choice.parent_value ? 'hidden' : '';
            const optImg = choice.img ? getImageUrl(choice.img) : FALLBACK_B64;

            choicesHtml += `
                <div class="choice-card ${hideClass} cursor-pointer p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center gap-3 transition-all"
                     ${dependsAttr}
                     onclick="selectSubOption('${optGroup.id}', '${choice.value}', this, '${optGroup.depends_on || ''}')">
                    <img src="${optImg}" onerror="window.imgError(this)" class="w-12 h-12 object-cover rounded-md shadow-sm border border-white/10">
                    <div><h4 class="font-bold text-sm text-white">${choice.label}</h4></div>
                </div>
            `;
        });

        groupDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-booth-accent/20 text-booth-accent flex items-center justify-center text-xs font-bold font-mono border border-booth-accent/30">!</span>
                <h3 class="font-bold text-white uppercase tracking-wider text-xs">${optGroup.label} ${optGroup.optional ? '(Opsional)' : ''}</h3>
            </div>
            <div class="grid grid-cols-2 gap-3" id="choices-container-${optGroup.id}">${choicesHtml}</div>
        `;
        formContainer.appendChild(groupDiv);
    });
}

window.selectSubOption = (groupId, choiceValue, element, dependsOn) => {
    selectedOptions[groupId] = choiceValue;
    const container = document.getElementById(`choices-container-${groupId}`);
    if (container) {
        container.querySelectorAll('.choice-card').forEach(el => el.classList.remove('border-booth-accent', 'bg-booth-accent/10', 'ring-1', 'ring-booth-accent'));
    }
    element.classList.add('border-booth-accent', 'bg-booth-accent/10', 'ring-1', 'ring-booth-accent');

    const styleData = availableStyles[selectedStyleId];
    if (styleData && styleData.options) {
        styleData.options.forEach(optGroup => {
            if (optGroup.depends_on === groupId) {
                const childGroupDiv = document.querySelector(`.opt-group-${optGroup.id}`);
                if (childGroupDiv) {
                    childGroupDiv.style.display = 'flex';
                    childGroupDiv.querySelectorAll('.choice-card').forEach(card => {
                        if (card.getAttribute('data-parent-val') === choiceValue) card.classList.remove('hidden');
                        else card.classList.add('hidden');
                    });
                }
            }
        });
    }
    checkReadyStatus(styleData);
};

function initQRScanner() {
    if (html5QrcodeScanner) return; 
    const qrNode = document.getElementById('qr-reader');
    if (!qrNode) return;
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    html5QrcodeScanner.render((decodedText) => {
        document.getElementById('token-input').value = decodedText;
        window.submitToken();
    }, (error) => {});
}

async function validateTicket(token) {
    const errEl = document.getElementById('token-error');
    if (errEl) errEl.innerText = "Memvalidasi tiket...";
    try {
        const response = await fetch(`${API_URLS.tickets}?action=validate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) });
        const data = await response.json();
        if (data.success) {
            if (errEl) errEl.innerText = "";
            switchScreen('screen-style');
            if (html5QrcodeScanner) { html5QrcodeScanner.clear(); html5QrcodeScanner = null; }
        } else { if (errEl) errEl.innerText = "Tiket tidak valid atau sudah terpakai."; }
    } catch (error) { if (errEl) errEl.innerText = "Gagal terhubung ke server API."; }
}

async function initWebcam() {
    const videoEl = document.getElementById('webcam-video');
    if (!videoEl) return;
    try {
        pbVideoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080, facingMode: "user" }, audio: false });
        videoEl.srcObject = pbVideoStream;
    } catch (error) { console.error("Kamera error:", error); }
}

// ==========================================
// HITUNG MUNDUR 5 DETIK & PENGAMBILAN FOTO
// ==========================================
function startCountdown() {
    const captureBtn = document.getElementById('btn-capture');
    captureBtn.disabled = true; 
    let count = 5;
    
    let overlay = document.getElementById('countdown-overlay');
    if (!overlay) {
        const videoContainer = document.getElementById('webcam-video').parentElement;
        overlay = document.createElement('div');
        overlay.id = 'countdown-overlay';
        overlay.className = 'absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all';
        overlay.innerHTML = '<span id="countdown-number" class="text-[160px] font-black text-white drop-shadow-[0_0_30px_rgba(232,84,62,0.8)] animate-pulse">5</span>';
        videoContainer.appendChild(overlay);
    } else {
        overlay.classList.remove('hidden');
        document.getElementById('countdown-number').innerText = count;
    }

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            document.getElementById('countdown-number').innerText = count;
        } else {
            clearInterval(timer);
            overlay.classList.add('hidden');
            captureBtn.disabled = false;
            takePhoto(); 
        }
    }, 1000);
}

function takePhoto() {
    const videoEl = document.getElementById('webcam-video');
    const canvasEl = document.getElementById('capture-canvas');
    if (!videoEl || !canvasEl) return;

    const targetSize = 1024;
    canvasEl.width = targetSize;
    canvasEl.height = targetSize;
    const context = canvasEl.getContext('2d');

    const vWidth = videoEl.videoWidth;
    const vHeight = videoEl.videoHeight;
    const minSize = Math.min(vWidth, vHeight);
    const startX = (vWidth - minSize) / 2;
    const startY = (vHeight - minSize) / 2;

    context.translate(targetSize, 0);
    context.scale(-1, 1);
    context.drawImage(videoEl, startX, startY, minSize, minSize, 0, 0, targetSize, targetSize);
    
    // Pakai PNG untuk berjaga-jaga standar API
    pbCapturedBase64 = canvasEl.toDataURL('image/png');
    
    document.getElementById('capture-preview-img').src = pbCapturedBase64;
    document.getElementById('capture-decision').classList.remove('hidden');
}

function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
    return new Blob([ab], {type: mimeString});
}

// ==========================================
// PROSES AI (DIKEMBALIKAN KE FORMAT PENGUNCI WAJAH)
// ==========================================
async function processAIGeneration() {
    document.getElementById('capture-decision')?.classList.add('hidden');
    switchScreen('screen-review');
    document.getElementById('review-blurred-img').src = pbCapturedBase64;
    
    const updateProgress = (pct, txt) => {
        document.getElementById('ai-progress-bar').style.width = `${pct}%`;
        document.getElementById('ai-progress-text').innerText = `${pct}%`;
        document.getElementById('ai-status-text').innerText = txt;
    };

    try {
        updateProgress(10, "Verifikasi API Key...");
        if (!appSettings.apiKey) throw new Error("API Key belum diatur di Admin Panel!");

        updateProgress(20, "Menganalisis opsi yang dipilih...");
        const styleData = availableStyles[selectedStyleId];
        let finalPrompt = styleData.prompt_template || "HD Portrait";
        
        let profileTextArr = [];
        if (styleData.options) {
            styleData.options.forEach(optGroup => {
                const chosenVal = selectedOptions[optGroup.id];
                if (chosenVal) {
                    const choiceObj = optGroup.choices.find(c => c.value === chosenVal);
                    if (choiceObj && choiceObj.prompt) profileTextArr.push(choiceObj.prompt);
                }
            });
        }

        if (profileTextArr.length > 0) {
            const addedPrompt = profileTextArr.join(' ');
            if (finalPrompt.includes('{profile_text}')) { finalPrompt = finalPrompt.replace('{profile_text}', addedPrompt); } 
            else { finalPrompt += ' ' + addedPrompt; }
        } else { finalPrompt = finalPrompt.replace('{profile_text}', ''); }

        updateProgress(50, "Menerapkan gaya fotomu via AI...");
        
        // PENTING: Pengiriman data kembali disederhanakan tanpa 'mask' transparan
        // Mesin AI proxy yang Anda gunakan sebelumnya dirancang mengenali wajah langsung dari 'image' utama
        const formData = new FormData();
        formData.append("image", dataURItoBlob(pbCapturedBase64), "image.png");
        formData.append("prompt", finalPrompt.trim());
        formData.append("model", appSettings.aiModel || "gpt-image-2.5-sunburst");
        formData.append("n", "1");
        formData.append("size", "1024x1024");

        const response = await fetch(`${appSettings.apiBaseUrl}/images/edits`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${appSettings.apiKey}` },
            body: formData
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let finalImage = "";
        let isUrl = false;
        
        if (data.data && data.data[0]) {
            if (data.data[0].b64_json) {
                finalImage = `data:image/jpeg;base64,${data.data[0].b64_json}`;
            } else if (data.data[0].url) {
                finalImage = data.data[0].url;
                isUrl = true; 
            }
        }

        if (!finalImage) throw new Error("Format respons AI salah atau kosong.");

        updateProgress(80, "Selesai! Mengunggah ke server...");
        await finalizePhotoAndUpload(finalImage, pbCapturedBase64, isUrl);
        updateProgress(100, "Siap ditampilkan!");
    } catch (error) {
        alert(`Gagal memproses AI: ${error.message}`);
        switchScreen('screen-capture'); 
    }
}

async function finalizePhotoAndUpload(aiImage, originalImageBase64, isUrl = false) {
    try {
        const payload = isUrl ? { image_url: aiImage } : { image: aiImage };
        
        const responseAi = await fetch(API_URLS.upload, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        const dataAi = await responseAi.json();

        if (dataAi.success && dataAi.url) {
            document.getElementById('result-original-img').src = originalImageBase64;
            document.getElementById('result-final-img').src = dataAi.url;
            
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