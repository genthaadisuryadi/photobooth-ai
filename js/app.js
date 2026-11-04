// js/app.js

const AppState = {
    apiKey: localStorage.getItem('openai_api_key') || '',
    apiBaseUrl: localStorage.getItem('openai_base_url') || 'https://api.openai.com/v1',
    aiModel: localStorage.getItem('openai_model') || 'gpt-image-2.5-sunburst',
    pin: localStorage.getItem('photobooth_pin') || 'disabled',
    
    currentScreen: 'screen-welcome',
    captureImageURL: null,
    aiResultImageURL: null,
    finalImageURL: null,
    
    selectedStyle: null,
    styleProfile: {}
};

let STYLE_CATALOG = {};
let html5QrCode = null; 

// ==========================================
// INIT & NAVIGASI
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const setRes = await fetch('http://localhost:3000/api/settings');
        const setObj = await setRes.json();
        Object.assign(AppState, setObj);
    } catch(e) {}

    try {
        const response = await fetch('http://localhost:3000/api/styles');
        STYLE_CATALOG = await response.json();
        
        const galLeft = document.getElementById('welcome-gallery-left');
        const galRight = document.getElementById('welcome-gallery-right');
        const images = Object.values(STYLE_CATALOG).map(s => s.cover).filter(img => img);
        
        if (images.length > 0) {
            let html = '';
            images.forEach(img => {
                const imgUrl = img.startsWith('http') ? img : `http://localhost:3000/${img}`;
                html += `<figure class="welcome-gallery-card aspect-[4/3] rounded-[14px] overflow-hidden bg-[#191c22]"><img src="${imgUrl}" class="h-full w-full object-cover"></figure>`;
            });
            html += html; 
            if(galLeft) galLeft.innerHTML = html;
            if(galRight) galRight.innerHTML = html;
        }
    } catch (err) { console.error("Gagal memuat DB Style:", err); }

    const btnStart = document.getElementById('btn-start');
    if(btnStart) {
        btnStart.addEventListener('click', () => {
            initTokenScreen();
            navigateTo('screen-pin');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') openAdminModal();
    });
});

function navigateTo(targetId) {
    document.querySelectorAll('#app-container > section').forEach(sec => sec.classList.add('screen-hidden'));
    const target = document.getElementById(targetId);
    if(target) target.classList.remove('screen-hidden');
    AppState.currentScreen = targetId;
    
    if (targetId === 'screen-capture' && typeof initCamera === 'function') {
        initCamera();
    }
}

// ==========================================
// TICKET / TOKEN SCREEN
// ==========================================
function initTokenScreen() {
    const tokenInput = document.getElementById('token-input');
    if(tokenInput) {
        tokenInput.value = "";
        const err = document.getElementById('token-error');
        if(err) err.innerText = "";
        setTimeout(() => tokenInput.focus(), 100);
    }
    startScanner();
}

function startScanner() {
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
    }
    const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        disableFlip: false,
        videoConstraints: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
    };
    if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => { startActualScan(config); }).catch(err => console.log(err));
    } else {
        startActualScan(config);
    }
}

function startActualScan(config) {
    html5QrCode.start(
        { facingMode: "user" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => { console.warn("Gagal memulakan kamera pengimbas.", err); });
}

function onScanSuccess(decodedText) {
    const tokenInput = document.getElementById('token-input');
    if (tokenInput && !tokenInput.disabled) {
        if(tokenInput.value === decodedText) return; 
        tokenInput.value = decodedText; 
        const indicator = document.getElementById('qr-scan-indicator');
        if (indicator) {
            indicator.classList.remove('opacity-0');
            indicator.classList.add('bg-booth-accent/20');
            setTimeout(() => { 
                indicator.classList.add('opacity-0'); 
                indicator.classList.remove('bg-booth-accent/20'); 
            }, 500);
        }
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().catch(e => console.log(e));
        }
        submitToken(); 
    }
}

function onScanFailure(error) {}

window.cancelTokenScreen = function() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(e => console.error(e));
    }
    navigateTo('screen-welcome');
}

document.addEventListener('DOMContentLoaded', () => {
    const tokenInput = document.getElementById('token-input');
    if(tokenInput) {
        tokenInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); submitToken(); }
        });
    }
});

window.submitToken = async function() {
    const inputEl = document.getElementById('token-input');
    const errorEl = document.getElementById('token-error');
    const btn = document.getElementById('btn-submit-token');
    if(!inputEl || !errorEl || !btn) return;

    const token = inputEl.value.trim();
    if(!token) { errorEl.innerText = "Harap masukkan kode tiket!"; return; }

    btn.disabled = true; 
    inputEl.disabled = true;
    btn.innerText = "Memeriksa Tiket..."; 
    errorEl.innerText = "";

    try {
        const response = await fetch('http://localhost:3000/api/tickets/validate', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ token: token })
        });
        const result = await response.json();
        
        if(result.success) {
            if (html5QrCode && html5QrCode.isScanning) { html5QrCode.stop().catch(e => console.error(e)); }
            renderStyleCatalog();
            navigateTo('screen-style');
        } else {
            errorEl.innerText = result.message;
            inputEl.value = ""; 
            inputEl.disabled = false; 
            inputEl.focus();
            inputEl.classList.add('animate-shake');
            setTimeout(() => inputEl.classList.remove('animate-shake'), 500);
            if (html5QrCode && !html5QrCode.isScanning) { startScanner(); }
        }
    } catch (err) { 
        errorEl.innerText = "Gagal terhubung ke mesin tiket. Server offline."; 
        inputEl.disabled = false;
        if (html5QrCode && !html5QrCode.isScanning) { startScanner(); }
    } finally { 
        btn.disabled = false; 
        btn.innerText = "Mulai Sesi Photobooth \u2192"; 
    }
}

// ==========================================
// STYLE CATALOG & ORANGE OUTLINE SELECTION
// ==========================================
function buildOptionCardHtml(optId, choice, isOptional, isCustomParent = false) {
    let hasImg = `<div class="w-full h-full bg-white/5 flex items-center justify-center"></div>`;
    if (choice.img) {
        const imgUrl = choice.img.startsWith('http') ? choice.img : `http://localhost:3000/${choice.img}`;
        const fbJpg = imgUrl.replace('.png', '.jpg');
        const fbJpeg = imgUrl.replace('.png', '.jpeg');
        hasImg = `<img src="${imgUrl}" class="w-full h-full object-cover" onerror="if(this.src.endsWith('.png')){this.src='${fbJpg}';}else if(this.src.endsWith('.jpg')){this.src='${fbJpeg}';}else{this.style.opacity='0';this.parentElement.classList.add('bg-white/5');}">`;
    }
    const onClickAction = isCustomParent ? `onclick="selectNestedCategory('${choice.value}')"` : `onclick="validateIntegratedOptions()"`;

    // Memberikan kelas border dasar pada card opsi
    return `
        <label class="group relative flex flex-col border-2 border-white/10 rounded-xl overflow-hidden cursor-pointer hover:border-booth-accent/50 transition-all bg-booth-card" ${onClickAction}>
            <input type="radio" name="${optId}" value="${choice.prompt || choice.value}" class="hidden">
            <div class="relative aspect-video bg-booth-bg">${hasImg}</div>
            <div class="p-3 text-center flex items-center justify-center flex-1">
                <span class="font-bold text-[12px] group-hover:text-white text-booth-text leading-tight">${choice.label}</span>
            </div>
        </label>
    `;
}

function renderStyleCatalog() {
    const container = document.getElementById('style-list-container');
    if(!container) return;
    container.innerHTML = '';
    
    let isFirst = true;
    Object.keys(STYLE_CATALOG).forEach((key) => {
        const style = STYLE_CATALOG[key];
        if (isFirst) { selectStyle(key); isFirst = false; }
        const imgUrl = style.cover.startsWith('http') ? style.cover : `http://localhost:3000/${style.cover}`;

        // Memberikan border-2 agar outline konsisten tebalnya
        container.innerHTML += `
            <button onclick="selectStyle('${key}')" id="card-${key}" class="relative flex min-h-[118px] flex-row overflow-hidden rounded-[14px] border-2 border-white/10 bg-transparent text-left transition-all duration-150 hover:bg-booth-panel focus:outline-none">
                <div class="w-[148px] bg-booth-panel shrink-0"><img src="${imgUrl}" class="w-full h-full object-cover" onerror="this.src=''; this.parentElement.classList.add('bg-white/5');"></div>
                <div class="flex-1 p-4 flex flex-col justify-center">
                    <span class="text-[19px] font-bold text-white">${style.name}</span>
                    <span class="mt-1 text-[11px] text-booth-muted line-clamp-2">${style.description}</span>
                </div>
            </button>
        `;
    });
}

window.selectStyle = function(key) {
    AppState.selectedStyle = key;
    const style = STYLE_CATALOG[key];

    // Efek Outline Oranye Tebal (border-2 border-booth-accent) pada kartu gaya utama di kiri
    document.querySelectorAll('#style-list-container button').forEach(b => {
        b.classList.remove('border-booth-accent', 'bg-booth-surface', 'border-2');
        b.classList.add('border-2', 'border-white/10');
    });
    const card = document.getElementById(`card-${key}`);
    if (card) {
        card.classList.remove('border-white/10');
        card.classList.add('border-2', 'border-booth-accent', 'bg-booth-surface');
    }
    
    const imgUrl = style.cover.startsWith('http') ? style.cover : `http://localhost:3000/${style.cover}`;
    document.getElementById('integrated-preview-img').src = imgUrl;
    document.getElementById('integrated-preview-name').innerText = style.name;
    document.getElementById('integrated-preview-desc').innerText = style.description;

    const form = document.getElementById('integrated-options-form');
    form.innerHTML = '';

    const standardKeys = ['name', 'cover', 'description', 'prompt_template', 'options'];
    const customKey = Object.keys(style).find(k => !standardKeys.includes(k));

    if (customKey && style.options && style.options.length > 0) {
        renderCustomNestedOptions(form, style, customKey);
        return;
    }

    if (style.options && style.options.length > 0) {
        style.options.forEach(opt => {
            let html = `<div class="flex flex-col gap-3"><h3 class="text-[11px] font-extrabold uppercase text-booth-accent">${opt.label}</h3><div class="grid grid-cols-2 xl:grid-cols-3 gap-3">`;
            opt.choices.forEach(choice => { html += buildOptionCardHtml(opt.id, choice, opt.optional); });
            html += `</div></div>`;
            form.innerHTML += html;
        });
        updateNextButton(true);
    } else {
        updateNextButton(false);
    }
}

function renderCustomNestedOptions(form, style, customKey) {
    const parentOpt = style.options[0]; 
    let html = `<div class="flex flex-col gap-3"><h3 class="text-[11px] font-extrabold uppercase text-booth-accent">${parentOpt.label}</h3><div class="grid grid-cols-2 xl:grid-cols-3 gap-3">`;
    parentOpt.choices.forEach(choice => { html += buildOptionCardHtml(parentOpt.id, choice, false, true); });
    html += `</div></div><div id="dynamic-nested-options" class="flex flex-col gap-6 mt-2"></div>`;
    form.innerHTML = html;
    updateNextButton(true);
}

window.selectNestedCategory = function(parentKey) {
    validateIntegratedOptions();
    const style = STYLE_CATALOG[AppState.selectedStyle];
    const standardKeys = ['name', 'cover', 'description', 'prompt_template', 'options'];
    const customKey = Object.keys(style).find(k => !standardKeys.includes(k));
    
    if(!customKey || !style[customKey][parentKey]) return;

    const data = style[customKey][parentKey];
    const container = document.getElementById('dynamic-nested-options');
    
    let html = '';
    Object.keys(data).forEach(k => {
        if(Array.isArray(data[k])) {
            const labelCapital = k.charAt(0).toUpperCase() + k.slice(1);
            html += `<div class="flex flex-col gap-3"><h3 class="text-[11px] font-extrabold uppercase text-booth-accent">Pilih ${labelCapital}</h3><div class="grid grid-cols-2 xl:grid-cols-3 gap-3">`;
            data[k].forEach(choice => { html += buildOptionCardHtml(k, choice, false); });
            html += `</div></div>`;
        }
    });
    
    container.innerHTML = html;
    updateNextButton(true);
}

function updateNextButton(isDisabled) {
    const btn = document.getElementById('btn-next-integrated');
    if (isDisabled) {
        btn.disabled = true;
        btn.className = "inline-flex min-h-[54px] min-w-[200px] shrink-0 items-center justify-between rounded-xl bg-[#13151a] px-6 text-[15px] font-bold text-[#686871] border border-white/10 transition-all cursor-not-allowed";
    } else {
        btn.disabled = false;
        btn.className = "inline-flex min-h-[54px] min-w-[200px] shrink-0 items-center justify-between rounded-xl bg-booth-accent px-6 text-[15px] font-bold text-white hover:bg-booth-accentLight transition-all border-none shadow-[0_0_15px_rgba(232,84,62,0.3)] cursor-pointer";
    }
}

window.validateIntegratedOptions = function() {
    setTimeout(() => {
        const form = document.getElementById('integrated-options-form');
        
        const radioGroups = new Set();
        form.querySelectorAll('input[type="radio"]').forEach(inp => radioGroups.add(inp.name));

        let allGroupsSelected = true;

        radioGroups.forEach(groupName => {
            const checkedRadio = form.querySelector(`input[name="${groupName}"]:checked`);
            if (!checkedRadio) {
                allGroupsSelected = false;
            }
        });

        // [EFEK OUTLINE ORANYE TEBAL] Menandai kartu sub-opsi yang dipilih dengan border oranye tebal
        form.querySelectorAll('label').forEach(lbl => {
            const radio = lbl.querySelector('input');
            if(radio && radio.checked) {
                lbl.classList.remove('border-white/10', 'bg-booth-card');
                lbl.classList.add('border-2', 'border-booth-accent', 'bg-booth-surface', 'shadow-[0_0_15px_rgba(232,84,62,0.25)]');
                const txt = lbl.querySelector('span');
                if(txt) txt.classList.add('text-white');
            } else {
                lbl.classList.remove('border-booth-accent', 'bg-booth-surface', 'shadow-[0_0_15px_rgba(232,84,62,0.25)]');
                lbl.classList.add('border-2', 'border-white/10', 'bg-booth-card');
                const txt = lbl.querySelector('span');
                if(txt) txt.classList.remove('text-white');
            }
        });

        updateNextButton(!allGroupsSelected);
    }, 50);
}

window.confirmIntegratedOptionsAndGo = function() {
    const form = document.getElementById('integrated-options-form');
    const formData = new FormData(form);
    AppState.styleProfile = {};
    for (let [key, value] of formData.entries()) { AppState.styleProfile[key] = value; }
    navigateTo('screen-capture');
}

// ==========================================
// UPLOAD GDRIVE & TAMPILKAN HASIL
// ==========================================
window.finalizePhotoAndUpload = async function() {
    const statusText = document.getElementById('ai-status-text');
    if (statusText) statusText.innerText = "Menyiapkan URL Kode QR...";

    try {
        const finalBase64 = AppState.aiResultImageURL; 
        const originalBase64 = AppState.captureImageURL;
        
        const uploadImage = async (base64Str) => {
            const res = await fetch('http://localhost:3000/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64Str })
            });
            const result = await res.json();
            if(!result.success) throw new Error(result.message);
            return result.url; 
        };

        const [originalUrl, aiUrl] = await Promise.all([
            uploadImage(originalBase64),
            uploadImage(finalBase64)
        ]);
        
        document.getElementById('result-original-img').src = originalBase64;
        document.getElementById('result-final-img').src = finalBase64;
        
        const qrOrigContainer = document.getElementById('qrcode-original');
        qrOrigContainer.innerHTML = ""; 
        new QRCode(qrOrigContainer, { text: originalUrl, width: 140, height: 140, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.L });

        const qrAiContainer = document.getElementById('qrcode-ai');
        qrAiContainer.innerHTML = ""; 
        new QRCode(qrAiContainer, { text: aiUrl, width: 140, height: 140, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.L });
        
        navigateTo('screen-result');
        
    } catch (e) {
        console.error("Gagal Render QR:", e);
        document.getElementById('result-original-img').src = AppState.captureImageURL;
        document.getElementById('result-final-img').src = AppState.aiResultImageURL;
        navigateTo('screen-result');
    }
}

// ==========================================
// ADMIN MODAL
// ==========================================
function openAdminModal() {
    const modal = document.getElementById('admin-modal');
    modal.classList.remove('screen-hidden');
    modal.innerHTML = `
        <div class="bg-[#1a2029] p-8 rounded-[20px] w-[500px] border border-booth-accent/30 shadow-[0_0_40px_rgba(232,84,62,0.15)]">
            <h2 class="text-3xl font-bold mb-6 text-white">⚙️ Pengaturan Cepat</h2>
            <label class="block mb-2 text-xs font-bold uppercase text-booth-muted">OpenAI API Key</label>
            <input type="password" id="adm-key" value="${AppState.apiKey}" class="w-full p-4 mb-4 rounded-xl bg-black/50 text-white border border-white/10 focus:border-booth-accent outline-none">
            <label class="block mb-2 text-xs font-bold uppercase text-booth-muted">Base URL API</label>
            <input type="text" id="adm-base" value="${AppState.apiBaseUrl}" class="w-full p-4 mb-4 rounded-xl bg-black/50 text-white border border-white/10 outline-none">
            
            <div class="flex gap-4 mt-6">
                <button onclick="document.getElementById('admin-modal').classList.add('screen-hidden')" class="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-white transition-all">Batal</button>
                <button onclick="saveAdmin()" class="flex-1 py-4 bg-booth-accent hover:bg-booth-accentLight rounded-xl font-bold text-white transition-all">Simpan</button>
            </div>
        </div>
    `;
}

window.saveAdmin = async function() {
    const k = document.getElementById('adm-key').value.trim();
    const b = document.getElementById('adm-base').value.trim();
    Object.assign(AppState, { apiKey: k, apiBaseUrl: b });
    try {
        await fetch('http://localhost:3000/api/settings', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: k, apiBaseUrl: b, aiModel: AppState.aiModel, pin: AppState.pin })
        });
    } catch(e) {}
    document.getElementById('admin-modal').classList.add('screen-hidden');
}