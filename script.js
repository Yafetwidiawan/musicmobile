const CHORD_LIBRARY = {
    'c': { name: 'C',  major: [130.81, 261.63, 329.63, 392.00, 523.25], minor: [130.81, 261.63, 311.13, 392.00, 523.25], seventhMaj: 466.16, seventhMin: 466.16, color: '#00ff00' },
    'd': { name: 'D',  major: [146.83, 293.66, 369.99, 440.00, 587.33], minor: [146.83, 293.66, 349.23, 440.00, 587.33], seventhMaj: 523.25, seventhMin: 523.25, color: '#ffa500' },
    'e': { name: 'E',  major: [164.81, 329.63, 415.30, 493.88, 659.26], minor: [164.81, 329.63, 392.00, 493.88, 659.26], seventhMaj: 587.33, seventhMin: 587.33, color: '#ffff00' },
    'f': { name: 'F',  major: [174.61, 349.23, 440.00, 523.25, 698.46], minor: [174.61, 349.23, 415.30, 523.25, 698.46], seventhMaj: 659.25, seventhMin: 659.25, color: '#ff00a5' },
    'g': { name: 'G',  major: [196.00, 246.94, 293.66, 392.00, 493.88], minor: [196.00, 233.08, 293.66, 392.00, 466.16], seventhMaj: 349.23, seventhMin: 349.23, color: '#ff00ff' },
    'a': { name: 'A',  major: [220.00, 277.18, 329.63, 440.00, 554.37], minor: [220.00, 261.63, 329.63, 440.00, 523.25], seventhMaj: 392.00, seventhMin: 392.00, color: '#ffff00' },
    'b': { name: 'B',  major: [246.94, 311.13, 369.99, 493.88, 622.25], minor: [246.94, 293.66, 369.99, 493.88, 587.33], seventhMaj: 440.00, seventhMin: 440.00, color: '#0064ff' }
};

let audioCtx = null;
let mainAnalyser = null; 
let activeOscillators = {}; 
let currentlyHeldLetters = new Set(); 
let modifierKeys = new Set(); 
let isSystemActive = false; 
let currentSoundPreset = 'piano';
let lastPlayedChordToken = ""; 

let activeParticleElements = {};
let smoothDataArray = null;

let videoEl, chordDisplay, chordNameEl, btnStart, appBox, canvas, canvasCtx, particleContainer, mobileKeyboardEl;
let imageUploader, uploadPlaceholder, sheetPreview, btnRemoveSheet, sheetBox, browseBtn;

window.addEventListener('DOMContentLoaded', () => {
    btnStart = document.getElementById('btn-start');
    appBox = document.getElementById('app-box');
    videoEl = document.getElementById('webcam');
    chordDisplay = document.getElementById('chord-display');
    chordNameEl = document.getElementById('chord-name');
    canvas = document.getElementById('visualizer');
    if (canvas) canvasCtx = canvas.getContext('2d');
    particleContainer = document.getElementById('particle-container');
    mobileKeyboardEl = document.getElementById('mobile-keyboard');

    sheetBox = document.querySelector('.sheet-box');
    imageUploader = document.getElementById('image-uploader');
    uploadPlaceholder = document.getElementById('upload-placeholder');
    sheetPreview = document.getElementById('sheet-preview');
    btnRemoveSheet = document.getElementById('btn-remove-sheet');
    browseBtn = document.querySelector('.browse-btn');

    if (sheetBox) {
        sheetBox.addEventListener('click', (e) => {
            if (e.target !== btnRemoveSheet && sheetPreview.classList.contains('hidden')) {
                imageUploader.click();
            }
        });
    }
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            imageUploader.click();
        });
    }

    if (imageUploader) {
        imageUploader.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    sheetPreview.src = event.target.result;
                    sheetPreview.classList.remove('hidden');
                    btnRemoveSheet.classList.remove('hidden');
                    if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
                    if (sheetBox) sheetBox.style.borderStyle = 'solid';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (btnRemoveSheet) {
        btnRemoveSheet.addEventListener('click', (e) => {
            e.stopPropagation();
            imageUploader.value = '';
            sheetPreview.classList.add('hidden');
            btnRemoveSheet.classList.add('hidden');
            if (uploadPlaceholder) uploadPlaceholder.style.display = 'block';
            if (sheetBox) sheetBox.style.borderStyle = 'dashed';
        });
    }

    const soundButtons = document.querySelectorAll('.sound-btn');
    soundButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            soundButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentSoundPreset = e.currentTarget.getAttribute('data-sound');
        });
    });

    // Jalankan mesin pembuat tombol mobile dinamis mase
    buildMobileKeyboard();

    if (btnStart) {
        btnStart.addEventListener('click', () => {
            btnStart.style.display = 'none'; 
            if (appBox) appBox.classList.remove('hidden-app'); 
            isSystemActive = true;
            initAudio();
            startWebcam();
            resizeCanvas();
            drawWaveform(); 
        });
    }
});

function resizeCanvas() {
    if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
}

function startWebcam() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && videoEl) {
        navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
            .then(stream => { videoEl.srcObject = stream; })
            .catch(err => console.log("Kamera aman mase."));
    }
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        mainAnalyser = audioCtx.createAnalyser();
        mainAnalyser.fftSize = 1024; 
        mainAnalyser.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// LOGIKA PEMBUATAN BUTTON MOBILE KEYBOARD CHORD DAN AUTO-RELEASE ENGINE
// LOGIKA PEMBUATAN BUTTON MOBILE KEYBOARD CHORD + TOGGLE AUTO-RELEASE ENGINE
function buildMobileKeyboard() {
    if (!mobileKeyboardEl) return;
    mobileKeyboardEl.innerHTML = "";
    
    // Daftar kombinasi chord pop terpopuler mase
    const mobileChords = [
        { rootKey: 'c', isMinor: false, label: 'C' },
        { rootKey: 'd', isMinor: false, label: 'D' },
        { rootKey: 'e', isMinor: false, label: 'E' },
        { rootKey: 'f', isMinor: false, label: 'F' },
        { rootKey: 'g', isMinor: false, label: 'G' },
        { rootKey: 'a', isMinor: false, label: 'A' },
        { rootKey: 'b', isMinor: false, label: 'B' },
        { rootKey: 'c', isMinor: true,  label: 'Cm' },
        { rootKey: 'd', isMinor: true,  label: 'Dm' },
        { rootKey: 'e', isMinor: true,  label: 'Em' },
        { rootKey: 'f', isMinor: true,  label: 'Fm' },
        { rootKey: 'g', isMinor: true,  label: 'Gm' },
        { rootKey: 'a', isMinor: true,  label: 'Am' },
        { rootKey: 'b', isMinor: true,  label: 'Bm' }
    ];

    mobileChords.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'mobile-chord-btn';
        btn.innerText = item.label;
        
        // Kasih aksen border warna indikator asli chord mase di sisi kiri button
        if (CHORD_LIBRARY[item.rootKey]) {
            btn.style.borderLeft = `5px solid ${CHORD_LIBRARY[item.rootKey].color}`;
        }

        // Pakai touchstart biar di HP super responsif tanpa delay mase
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!isSystemActive) return;
            initAudio();

            let currentToken = item.rootKey + (item.isMinor ? "m" : "");

            // REVISI FITUR: Jika tombol yang sama diklik lagi saat sedang aktif, matikan suaranya (Toggle Stop)
            if (btn.classList.contains('active-press')) {
                btn.classList.remove('active-press');
                if (lastPlayedChordToken === currentToken) {
                    stopChord(currentToken);
                    lastPlayedChordToken = "";
                }
                return;
            }

            // Lepas style aktif dari tombol lain yang sebelumnya menyala
            document.querySelectorAll('.mobile-chord-btn').forEach(b => b.classList.remove('active-press'));
            
            // Tandai tombol saat ini sebagai aktif
            btn.classList.add('active-press');

            // SISTEM OTOMATIS PINDAH CHORD (Jika ada chord lain yang bunyi, matikan dulu)
            if (lastPlayedChordToken && lastPlayedChordToken !== currentToken) {
                stopChord(lastPlayedChordToken);
            }

            lastPlayedChordToken = currentToken;
            playChord(item.rootKey, item.isMinor, false, currentToken);
        });

        mobileKeyboardEl.appendChild(btn);
    });
}

function evaluateCurrentChordState() {
    let rootKey = null;
    let wantMinor = currentlyHeldLetters.has('m');
    let is7th = modifierKeys.has('ArrowUp') || modifierKeys.has('ArrowDown');

    for (let key of currentlyHeldLetters) {
        if (CHORD_LIBRARY[key]) { rootKey = key; break; }
    }

    if (!rootKey) {
        if (lastPlayedChordToken) {
            stopChord(lastPlayedChordToken);
            lastPlayedChordToken = "";
        }
        return;
    }

    let currentToken = rootKey + (wantMinor ? "m" : "") + (is7th ? "7" : "");
    if (currentToken === lastPlayedChordToken) return;

    if (lastPlayedChordToken) {
        stopChord(lastPlayedChordToken);
    }

    lastPlayedChordToken = currentToken;
    playChord(rootKey, wantMinor, is7th, currentToken);
}

window.addEventListener('keydown', (e) => {
    if (!isSystemActive) return;
    initAudio();
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        modifierKeys.add(e.key);
        evaluateCurrentChordState();
    }
    if (CHORD_LIBRARY[key] || key === 'm') {
        currentlyHeldLetters.add(key);
        evaluateCurrentChordState();
    }
});

window.addEventListener('keyup', (e) => {
    if (!isSystemActive) return;
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        modifierKeys.delete(e.key);
        evaluateCurrentChordState();
    }
    if (currentlyHeldLetters.has(key)) {
        currentlyHeldLetters.delete(key);
        evaluateCurrentChordState();
    }
});

function playChord(rootKey, wantMinor, is7th, token) {
    const chordData = CHORD_LIBRARY[rootKey];
    if (!chordData) return;

    let freqsToPlay = wantMinor ? [...chordData.minor] : [...chordData.major];
    if (is7th) {
        let seventhFreq = wantMinor ? chordData.seventhMin : chordData.seventhMaj;
        freqsToPlay.push(seventhFreq);
    }

    activeOscillators[token] = [];
    let oscType = 'sine';
    let attackTime = 0.02;
    let baseVolume = 0.15;

    if (currentSoundPreset === 'guitar') { oscType = 'triangle'; attackTime = 0.01; baseVolume = 0.20; }
    else if (currentSoundPreset === 'brass') { oscType = 'sawtooth'; attackTime = 0.06; baseVolume = 0.10; }
    else if (currentSoundPreset === 'retro') { oscType = 'square'; attackTime = 0.005; baseVolume = 0.08; }

    freqsToPlay.forEach((freq, idx) => {
        let osc = audioCtx.createOscillator();
        let gainNode = audioCtx.createGain();
        
        if (currentSoundPreset === 'piano') {
            if (idx === 0) {
                osc.type = 'triangle'; 
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.015);
            } else if (idx === freqsToPlay.length - 1 && !is7th) {
                osc.type = 'sine';
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
            } else {
                osc.type = 'sine'; 
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.20, audioCtx.currentTime + 0.025);
            }
        } else {
            osc.type = oscType;
            let vol = (idx === 0) ? baseVolume * 1.3 : baseVolume;
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + attackTime);
        }
        
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.connect(gainNode);
        gainNode.connect(mainAnalyser);
        osc.start();
        activeOscillators[token].push({ osc, gainNode });
    });

    let suffix = is7th ? "7" : "";
    let fullChordName = wantMinor ? `${chordData.name}m${suffix}` : `${chordData.name}${suffix}`;
    if (chordNameEl) chordNameEl.innerText = `PLAYING: ${fullChordName}`;
    
    // Perbarui garis penunjuk warna chord asli mase
    if (chordDisplay) {
        chordDisplay.style.borderLeftColor = chordData.color;
        chordDisplay.classList.remove('hidden');
    }

    let pressedTextComponents = [rootKey.toUpperCase()];
    if (wantMinor) pressedTextComponents.push("M");
    if (is7th) pressedTextComponents.push("7");
    let dynamicLabel = pressedTextComponents.join(" + ");

    createFloatingChordParticle(token, dynamicLabel, chordData.color);
}

function createFloatingChordParticle(token, name, color) {
    if (!particleContainer) return;
    if (activeParticleElements[token]) {
        activeParticleElements[token].remove();
    }

    const particle = document.createElement('div');
    particle.className = 'floating-chord';
    particle.innerText = name;
    particle.style.color = color;
    
    particleContainer.appendChild(particle);
    activeParticleElements[token] = particle;

    setTimeout(() => { if (activeParticleElements[token]) { particle.classList.add('hold'); } }, 15);
}

function stopChord(token) {
    if (activeOscillators[token]) {
        activeOscillators[token].forEach(track => {
            let releaseTime = (currentSoundPreset === 'guitar' || currentSoundPreset === 'piano') ? 0.55 : 0.15;
            track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, audioCtx.currentTime);
            track.gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + releaseTime);
            setTimeout(() => { try { track.osc.stop(); track.osc.disconnect(); } catch(e) {} }, releaseTime * 1000 + 50);
        });
        delete activeOscillators[token];
    }
    
    if (activeParticleElements[token]) {
        const particle = activeParticleElements[token];
        particle.classList.remove('hold');
        particle.classList.add('fade-away'); 
        setTimeout(() => { try { particle.remove(); } catch(e){} }, 500);
        delete activeParticleElements[token];
    }

    setTimeout(() => {
        if (currentlyHeldLetters.size === 0 && Object.keys(activeOscillators).length === 0 && chordDisplay) {
            chordDisplay.classList.add('hidden');
        }
    }, 50);
}

function drawWaveform() {
    requestAnimationFrame(drawWaveform);
    if (!mainAnalyser || !canvasCtx || !canvas) return;

    const bufferLength = mainAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    mainAnalyser.getByteTimeDomainData(dataArray);

    if (!smoothDataArray) {
        smoothDataArray = new Float32Array(bufferLength);
        for (let i = 0; i < bufferLength; i++) smoothDataArray[i] = dataArray[i];
    }

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 4; 

    let activeToken = Object.keys(activeOscillators)[0];
    if (activeToken) {
        let root = activeToken.charAt(0);
        canvasCtx.strokeStyle = CHORD_LIBRARY[root] ? CHORD_LIBRARY[root].color : '#00ffff';
    } else {
        canvasCtx.strokeStyle = '#00ffff';
    }
    canvasCtx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        smoothDataArray[i] = (smoothDataArray[i] * 0.94) + (dataArray[i] * 0.06);
        const v = smoothDataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) { canvasCtx.moveTo(x, y); } 
        else { canvasCtx.lineTo(x, y); }
        x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
}

window.addEventListener('resize', resizeCanvas);
