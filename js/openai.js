// js/openai.js

async function processAI() {
    const apiKey = AppState.apiKey;
    const modelName = AppState.aiModel || "gpt-image-2.5-sunburst"; 

    if (!apiKey || apiKey.startsWith('//') || apiKey === 'disabled') {
        alert("API Key tidak valid! Pastikan Anda sudah menyimpannya di menu API Settings pada Admin Stage.");
        navigateTo('screen-welcome');
        return;
    }

    const statusText = document.getElementById('ai-status-text');
    const progressBar = document.getElementById('ai-progress-bar');
    const progressText = document.getElementById('ai-progress-text');

    statusText.innerText = `Menghubungkan ke ${modelName}...`;
    progressBar.style.width = "10%";
    progressText.innerText = "10%";

    const base64Image = AppState.captureImageURL;
    document.getElementById('review-blurred-img').src = base64Image;

    let finalPrompt = STYLE_CATALOG[AppState.selectedStyle]?.prompt_template || "Make a highly detailed cinematic portrait.";
    Object.keys(AppState.styleProfile).forEach(key => {
        const val = AppState.styleProfile[key];
        finalPrompt = finalPrompt.replace(new RegExp(`{${key}}`, 'g'), val);
    });

    console.log(`Menggunakan Model: ${modelName}`);
    console.log("Instruksi AI Final:", finalPrompt);

    let fakeProgress = 10;
    const progressInterval = setInterval(() => {
        if (fakeProgress < 85) {
            fakeProgress += Math.floor(Math.random() * 8) + 2;
            if(fakeProgress > 85) fakeProgress = 85;
            progressBar.style.width = `${fakeProgress}%`;
            progressText.innerText = `${fakeProgress}%`;
            
            if (fakeProgress > 30) statusText.innerText = "OpenAI sedang men-generate gambar Anda...";
            if (fakeProgress > 60) statusText.innerText = "Menyelesaikan proses...";
        }
    }, 1000);

    try {
        const img = new Image();
        img.src = base64Image;
        await new Promise(r => img.onload = r);
        
        const size = 1024;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size;
        tempCanvas.height = size;
        const ctx = tempCanvas.getContext('2d');
        
        const minSize = Math.min(img.width, img.height);
        const cropX = (img.width - minSize) / 2;
        const cropY = (img.height - minSize) / 2;
        ctx.drawImage(img, cropX, cropY, minSize, minSize, 0, 0, size, size);

        // MAGIC MASKING
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.ellipse(size / 2, size * 0.45, size * 0.22, size * 0.28, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "black";
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; 

        const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
        
        const formData = new FormData();
        formData.append("image", blob, "webcam.png");
        formData.append("model", modelName); 
        formData.append("prompt", finalPrompt);
        formData.append("n", 1);
        formData.append("size", "1024x1024");

        // [PENGAMAN KONEKSI] Menggunakan konfigurasi fetch dengan mode standar untuk menghindari ERR_QUIC
        let response;
        try {
            response = await fetch(`${AppState.apiBaseUrl}/images/edits`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}` 
                },
                body: formData,
                cache: 'no-store'
            });
        } catch (fetchErr) {
            // Jika gagal di percobaan pertama karena gangguan kuic/jaringan, coba sekali lagi secara otomatis
            console.warn("Percobaan pertama gagal, mencoba menghubungkan ulang...", fetchErr);
            await new Promise(r => setTimeout(r, 2000)); // Jeda 2 detik
            response = await fetch(`${AppState.apiBaseUrl}/images/edits`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}` 
                },
                body: formData,
                cache: 'no-store'
            });
        }

        clearInterval(progressInterval);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "OpenAI menolak permintaan.");
        }

        let imageUrl = null;
        if (data.data && data.data.length > 0) {
            if (data.data[0].url) {
                imageUrl = data.data[0].url;
            } else if (data.data[0].b64_json) {
                imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
            }
        } else if (data.output && data.output.length > 0) {
            imageUrl = typeof data.output[0] === 'string' ? data.output[0] : data.output[0].url;
        }

        if (!imageUrl) {
            throw new Error("OpenAI tidak mengirimkan link gambar.");
        }

        progressBar.style.width = "100%";
        progressText.innerText = "100%";
        statusText.innerText = "Selesai!";

        AppState.aiResultImageURL = imageUrl;
        
        // Lanjut ke proses upload dan hasil
        finalizePhotoAndUpload();

    } catch (error) {
        clearInterval(progressInterval);
        console.error("Detail Error AI:", error);
        
        // [TIPS JARINGAN] Jika error karena internet/QUIC, beri tahu user untuk mengganti jaringan sebentar (misal pakai tethering HP lain)
        alert(`Gangguan Koneksi / Gagal Menghubungkan ke AI: ${error.message}\n\nTips: Jika masalah berlanjut, coba gunakan sambungan internet/tethering operator lain (Telkomsel/XL/Indosat) karena terkadang jaringan WiFi lokal memblokir akses OpenAI.`);
        
        // Fallback: Menggunakan foto asli kamera jika jaringan benar-benar terputus
        AppState.aiResultImageURL = base64Image;
        finalizePhotoAndUpload();
    }
}