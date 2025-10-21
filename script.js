// --- 오디오 컨텍스트 및 마스터 게인 노드 설정 ---
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);

// --- 각 기능별 게인 노드 설정 ---
const beatGain = audioContext.createGain();
const rhythmGain = audioContext.createGain(); // 슬라이더로 조절되는 게인
const rhythmBoost = audioContext.createGain(); // ▼▼▼ [추가] 리듬 증폭용 게인 ▼▼▼
const chordGain = audioContext.createGain();
const audioGain = audioContext.createGain();

beatGain.connect(masterGain);
rhythmGain.connect(rhythmBoost); // ▼▼▼ [수정] 리듬 게인을 부스트 게인에 연결
rhythmBoost.connect(masterGain); // ▼▼▼ [추가] 부스트 게인을 마스터에 연결
rhythmBoost.gain.value = 2.0; // ▼▼▼ [추가] 리듬 소리를 2배로 증폭시킵니다.
chordGain.connect(masterGain);
audioGain.connect(masterGain);

// --- 상태 변수 ---
let bpm = 120;
let beatsPerMeasure = 4;
let isPlaying = false;
let nextNoteTime = 0.0;
let timerID;
let beatStates = [];
let rhythmPattern = [];
let nextRhythmPattern = [];
let current16thNote = 0;
let isRhythmModeEnabled = false;
let chords = ['C'];
let currentChordIndex = 0;
let isChordModeEnabled = false;
let audioBuffer = null;
let audioSource = null;
let audioStartTime = 0;
let audioPauseOffset = 0;
let progressAnimationId = null;
let practiceTimeInSeconds = 0;
let stopwatchIntervalId = null;
let nextRandomChord = null; 
let tickBuffer = null;
let accentBuffer = null;
let currentSoundPack = 'MetronomeQuartz'; // 기본값
let rhythmTickBuffer = null; // 리듬 일반 박자
let rhythmAccentBuffer = null; // 리듬 강세 박자
let currentRhythmSoundPack = 'SynthSquare';


const noteFrequencies = { 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99 };
const chordDefinitions = { 'C': ['C4', 'E4', 'G4'], 'G': ['G4', 'B4', 'D5'], 'Am': ['A4', 'C5', 'E5'], 'F': ['F4', 'A4', 'C5'], 'Dm': ['D4', 'F4', 'A4'], 'E': ['E4', 'G4', 'B4'] };
const availableChords = Object.keys(chordDefinitions);
const soundPacks = {
    'MetronomeQuartz': { accent: 'Perc_MetronomeQuartz_hi.wav', tick: 'Perc_MetronomeQuartz_lo.wav' },
    'SynthBlock': { accent: 'Synth_Block_A_hi.wav', tick: 'Synth_Block_A_lo.wav' },
    'DrumStick': { accent: 'Perc_Stick_hi.wav', tick: 'Perc_Stick_lo.wav' },
    'SynthTick': { accent: 'Synth_Tick_A_hi.wav', tick: 'Synth_Tick_A_lo.wav' },
    'Clap': { accent: 'Perc_Clap_hi.wav', tick: 'Perc_Clap_lo.wav' },
    'Glass': { accent: 'Perc_Glass_hi.wav', tick: 'Perc_Glass_lo.wav' },
    'Keyboard': { accent: 'Perc_Keyboard_hi.wav', tick: 'Perc_Keyboard_lo.wav' },
    'Snap': { accent: 'Perc_Snap_hi.wav', tick: 'Perc_Snap_lo.wav' }
};

const rhythmSoundPacks = {
    'SynthSquare': { accent: 'Synth_Square_C_hi.wav', tick: 'Synth_Square_C_lo.wav' },
    'SynthTick': { accent: 'Synth_Tick_C_hi.wav', tick: 'Synth_Tick_C_lo.wav' },
    'ClickToy': { accent: 'Perc_ClickToy_hi.wav', tick: 'Perc_ClickToy_lo.wav' },
    'Glass': { accent: 'Perc_Glass_hi.wav', tick: 'Perc_Glass_lo.wav' }
};

// --- HTML 요소 가져오기 ---
const soundPackSelect = document.getElementById('sound-pack-select'); 
const rhythmSoundPackSelect = document.getElementById('rhythm-sound-pack-select');
const masterVolumeSlider = document.getElementById('master-volume-slider');
const masterVolumePercentage = document.getElementById('master-volume-percentage');
const beatVolumeSlider = document.getElementById('beat-volume-slider');
const beatVolumePercentage = document.getElementById('beat-volume-percentage');
const rhythmVolumeSlider = document.getElementById('rhythm-volume-slider');
const rhythmVolumePercentage = document.getElementById('rhythm-volume-percentage');
const chordVolumeSlider = document.getElementById('chord-volume-slider');
const chordVolumePercentage = document.getElementById('chord-volume-percentage');
const bpmOutput = document.getElementById('bpm-output');
const bpmSlider = document.getElementById('bpm-slider');
const startStopBtn = document.getElementById('start-stop-btn');
const beatsPerMeasureInput = document.getElementById('beats-per-measure');
const beatIndicatorContainer = document.getElementById('beat-indicator-container');
const bpmPlusBtn = document.getElementById('bpm-plus-btn');
const bpmMinusBtn = document.getElementById('bpm-minus-btn');
const chordInput = document.getElementById('chord-input');
const randomChordsCheckbox = document.getElementById('random-chords-checkbox');
const chordDisplay = document.getElementById('chord-display');
const nextChordPreview = document.getElementById('next-chord-preview');
const toggleChordPanelBtn = document.getElementById('toggle-chord-panel-btn');
const chordModule = document.querySelector('.chord-module');
const rhythmModule = document.querySelector('.rhythm-module');
const rhythmGrid = document.querySelector('.rhythm-grid');
const rhythmPreviewContainer = document.getElementById('rhythm-preview-container');
const rhythmPreviewGrid = document.getElementById('rhythm-preview-grid');
const toggleRhythmPanelBtn = document.getElementById('toggle-rhythm-panel-btn');
const rhythmAccentCheckbox = document.getElementById('rhythm-accent-checkbox');
const randomRhythmCheckbox = document.getElementById('random-rhythm-checkbox');
const audioVolumeSlider = document.getElementById('audio-volume-slider');
const audioVolumePercentage = document.getElementById('audio-volume-percentage');
const audioUploadInput = document.getElementById('audio-upload-input');
const audioUploadBtn = document.getElementById('audio-upload-btn');
const audioFileName = document.getElementById('audio-file-name');
const audioProgressContainer = document.getElementById('audio-progress-container');
const audioProgressBar = document.getElementById('audio-progress-bar');
const audioCurrentTime = document.getElementById('audio-current-time');
const audioDuration = document.getElementById('audio-duration');
const stopwatchDisplay = document.getElementById('stopwatch-display');
const presetBtns = document.querySelectorAll('.preset-btn'); 
const toggleVolumeControlsBtn = document.getElementById('toggle-volume-controls-btn'); // [추가]
const secondaryVolumeControls = document.getElementById('secondary-volume-controls'); // [추가]


// --- 초기화 ---
initialize();
async function initialize() {

    populateSoundPackSelect();
    populateRhythmSoundPackSelect(); 
    
    await loadMetronomeSounds(); 
    await loadRhythmSounds(); 

    masterGain.gain.value = masterVolumeSlider.value;
    beatGain.gain.value = beatVolumeSlider.value;
    rhythmGain.gain.value = rhythmVolumeSlider.value;
    chordGain.gain.value = chordVolumeSlider.value;
    audioGain.gain.value = audioVolumeSlider.value;
    updateBeatStates();
    createBeatIndicators();
    createRhythmGrid();
    updateBpm(bpm);
}

// --- 유틸리티 함수 ---
function formatTime(seconds, showHours = false) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (showHours) {
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function showToaster(message) {
    const existingToaster = document.querySelector('.toaster-popup');
    if (existingToaster) {
        existingToaster.remove();
    }
    const toaster = document.createElement('div');
    toaster.className = 'toaster-popup';
    toaster.textContent = message;
    document.body.appendChild(toaster);
    setTimeout(() => {
        toaster.remove();
    }, 2200);
}

function populateSoundPackSelect() {
    for (const packName in soundPacks) {
        const option = document.createElement('option');
        option.value = packName;
        option.textContent = packName;
        if (packName === currentSoundPack) {
            option.selected = true;
        }
        soundPackSelect.appendChild(option);
    }
}

function populateRhythmSoundPackSelect() {
    for (const packName in rhythmSoundPacks) {
        const option = document.createElement('option');
        option.value = packName;
        option.textContent = packName;
        if (packName === currentRhythmSoundPack) {
            option.selected = true;
        }
        rhythmSoundPackSelect.appendChild(option);
    }
}

async function loadRhythmSounds() {
    const pack = rhythmSoundPacks[currentRhythmSoundPack];
    if (!pack) {
        showToaster('선택한 리듬 사운드 팩을 찾을 수 없습니다.');
        return;
    }
    
    // Promise.all을 사용해 두 사운드를 병렬로 로드
    [rhythmTickBuffer, rhythmAccentBuffer] = await Promise.all([
        loadSound(pack.tick),
        loadSound(pack.accent)
    ]);

    if (!rhythmTickBuffer || !rhythmAccentBuffer) {
        showToaster(`'${currentRhythmSoundPack}' 리듬 사운드 팩 로딩에 실패했습니다.`);
    }
}

async function loadSound(url) {
    try {
        // 사운드 파일이 있는 폴더 경로를 지정하세요. 예: 'sounds/'
        const response = await fetch('sounds/' + url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error(`'${url}' 파일을 불러오는 중 오류 발생:`, error);
        return null;
    }
}

async function loadMetronomeSounds() {
    const pack = soundPacks[currentSoundPack];
    if (!pack) {
        showToaster('선택한 사운드 팩을 찾을 수 없습니다.');
        return;
    }
    
    // Promise.all을 사용해 두 사운드를 병렬로 로드
    [tickBuffer, accentBuffer] = await Promise.all([
        loadSound(pack.tick),
        loadSound(pack.accent)
    ]);

    if (!tickBuffer || !accentBuffer) {
        showToaster(`'${currentSoundPack}' 사운드 팩 로딩에 실패했습니다.`);
    }
}


function playOscillator(time, freq, gainNode, type = 'sine', duration = 0.1) {
    // Oscillator (신디사이저) 노드 생성
    const osc = audioContext.createOscillator();
    // 소리 크기 조절을 위한 Gain 노드 생성 (클릭 방지용)
    const env = audioContext.createGain();

    osc.type = type; // 'square', 'triangle' 등
    osc.frequency.setValueAtTime(freq, time);
    
    // 소리 봉투(Envelope) 적용: 짧은 Attack 및 Dureation에 맞춘 Decay
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(1, time + 0.01); // 0.01초간 Attack
    env.gain.linearRampToValueAtTime(0, time + duration); // duration에 걸쳐 소리 줄이기

    // 노드 연결
    osc.connect(env);
    env.connect(gainNode); // 마스터가 아닌 리듬/코드용 게인 노드에 연결
    
    // 재생 및 정지 예약
    osc.start(time);
    osc.stop(time + duration);
}


// --- 이벤트 리스너 ---
masterVolumeSlider.addEventListener('input', e => { masterGain.gain.value = e.target.value; masterVolumePercentage.textContent = `${Math.round(e.target.value * 100)}%`; });
bpmSlider.addEventListener('input', e => { updateBpm(Number(e.target.value)); });
beatVolumeSlider.addEventListener('input', e => { beatGain.gain.value = e.target.value; beatVolumePercentage.textContent = `${Math.round(e.target.value * 100)}%`; });
rhythmVolumeSlider.addEventListener('input', e => { rhythmGain.gain.value = e.target.value; rhythmVolumePercentage.textContent = `${Math.round(e.target.value * 100)}%`; });
chordVolumeSlider.addEventListener('input', e => { chordGain.gain.value = e.target.value; chordVolumePercentage.textContent = `${Math.round(e.target.value * 100)}%`; });
audioVolumeSlider.addEventListener('input', e => { audioGain.gain.value = e.target.value; audioVolumePercentage.textContent = `${Math.round(e.target.value * 100)}%`; });
audioUploadBtn.addEventListener('click', () => { audioUploadInput.click(); });
audioUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (isPlaying) startStopBtn.click();
        audioFileName.textContent = '파일을 읽는 중...';
        audioProgressContainer.classList.add('hidden'); 
        audioBuffer = null;
        audioPauseOffset = 0;
        cancelAnimationFrame(progressAnimationId);
        const reader = new FileReader();
        reader.onload = (event) => {
            audioContext.decodeAudioData(event.target.result, (buffer) => {
                audioBuffer = buffer;
                audioFileName.textContent = `로드 완료: ${file.name}`;
                audioProgressContainer.classList.remove('hidden');
                const duration = audioBuffer.duration;
                audioProgressBar.max = duration;
                audioProgressBar.value = 0;
                audioDuration.textContent = formatTime(duration);
                audioCurrentTime.textContent = formatTime(0);
            }, (error) => {
                audioFileName.textContent = '오류: 파일을 읽을 수 없습니다.';
            });
        };
        reader.readAsArrayBuffer(file);
    }
});
presetBtns.forEach(button => { button.addEventListener('click', (e) => { updateBpm(Number(e.currentTarget.dataset.bpm)); }); });

startStopBtn.addEventListener('click', () => {
    if (audioContext.state === 'suspended') audioContext.resume();
    isPlaying = !isPlaying;

    if (isPlaying) {
        current16thNote = 0;
        nextNoteTime = audioContext.currentTime + 0.1;
        nextRandomChord = null;
        
        if (isRhythmModeEnabled) {
            rhythmPattern = randomRhythmCheckbox.checked ? generateNewRandomPattern() : [...rhythmPattern];
            nextRhythmPattern = randomRhythmCheckbox.checked ? generateNewRandomPattern() : [...rhythmPattern];
            displayRhythmPattern();
            displayRhythmPreview();
        }

        scheduler();
        startStopBtn.textContent = '정지';
        startStopBtn.style.backgroundColor = '#f44336';

        if (audioBuffer) {
            playAudio();
            updateAudioProgress();
        }
        stopwatchIntervalId = setInterval(() => {
            practiceTimeInSeconds++;
            stopwatchDisplay.textContent = formatTime(practiceTimeInSeconds, true);
        }, 1000);
        
    } else {
        clearTimeout(timerID);
        
        if (audioSource) {
            if (audioContext.currentTime > audioStartTime) {
                 audioPauseOffset += audioContext.currentTime - audioStartTime;
            }
            audioSource.stop();
            audioSource = null;
            cancelAnimationFrame(progressAnimationId);
        }
        
        clearInterval(stopwatchIntervalId);

        document.querySelectorAll('.beat-dot.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.rhythm-cell.playing').forEach(el => el.classList.remove('playing'));
        startStopBtn.textContent = '시작';
        startStopBtn.style.backgroundColor = '#4CAF50';
    }
});

stopwatchDisplay.addEventListener('click', () => { showToaster('더블클릭하면 초기화됩니다.'); });
stopwatchDisplay.addEventListener('dblclick', () => {
    practiceTimeInSeconds = 0;
    stopwatchDisplay.textContent = formatTime(practiceTimeInSeconds, true);
    showToaster('타이머가 초기화되었습니다.');
});
beatsPerMeasureInput.addEventListener('input', e => { 
    const newBeats = Number(e.target.value); 
    if (newBeats > 0 && newBeats <= 16) { 
        beatsPerMeasure = newBeats; 
        updateBeatStates(); 
        createBeatIndicators(); 
        createRhythmGrid();
    }
});

// ▼▼▼ [추가] 볼륨 조절 버튼 이벤트 리스너 ▼▼▼
toggleVolumeControlsBtn.addEventListener('click', () => {
    secondaryVolumeControls.classList.toggle('hidden');
    const isHidden = secondaryVolumeControls.classList.contains('hidden');
    toggleVolumeControlsBtn.textContent = isHidden ? '볼륨 조절' : '볼륨 숨기기';
});
// ▲▲▲ [추가] ▲▲▲

toggleRhythmPanelBtn.addEventListener('click', () => {
    isRhythmModeEnabled = !isRhythmModeEnabled;
    rhythmModule.classList.toggle('hidden');
    toggleRhythmPanelBtn.textContent = isRhythmModeEnabled ? '리듬 끄기' : '리듬';
});
toggleChordPanelBtn.addEventListener('click', () => {
    isChordModeEnabled = !isChordModeEnabled;
    chordModule.classList.toggle('hidden');
    toggleChordPanelBtn.textContent = isChordModeEnabled ? '코드 끄기' : '코드';
});
randomChordsCheckbox.addEventListener('change', e => { chordInput.disabled = e.target.checked; chordInput.placeholder = e.target.checked ? '랜덤 코드가 생성됩니다.' : '코드 진행 입력 (예: C, G, Am, F)'; if(e.target.checked) chordInput.value = ''; });

randomRhythmCheckbox.addEventListener('change', e => { 
    const isChecked = e.target.checked; 
    const footerText = rhythmModule.querySelector('p'); 
    footerText.textContent = isChecked ? '매 마디마다 랜덤 패턴이 생성됩니다.' : '각 셀을 클릭하여 리듬을 만드세요.'; 
    
    if (isChecked) {
        rhythmPreviewContainer.classList.remove('hidden');
        generateRandomRhythmPattern();
    } else {
        rhythmPreviewContainer.classList.add('hidden');
    }
});

soundPackSelect.addEventListener('change', (e) => {
    currentSoundPack = e.target.value;
    loadMetronomeSounds(); // 새로운 사운드 팩 로드
    showToaster(`${currentSoundPack} 사운드로 변경되었습니다.`);
});

rhythmSoundPackSelect.addEventListener('change', (e) => {
    currentRhythmSoundPack = e.target.value;
    loadRhythmSounds();
    showToaster(`리듬 사운드가 ${currentRhythmSoundPack} (으)로 변경되었습니다.`);
});


rhythmAccentCheckbox.addEventListener('change', e => { 
    if (!e.target.checked) { 
        rhythmPattern = rhythmPattern.map(state => state === 2 ? 1 : state); 
        nextRhythmPattern = [...rhythmPattern];
        displayRhythmPattern(); 
        displayRhythmPreview();
    }
});

function scheduler() {
    while (nextNoteTime < audioContext.currentTime + 0.1) {
        scheduleNoteAndVisual(current16thNote, nextNoteTime);
        
        const secondsPer16thNote = (60.0 / bpm) / 4;
        nextNoteTime += secondsPer16thNote;

        current16thNote = (current16thNote + 1) % (beatsPerMeasure * 4);
    }
    timerID = setTimeout(scheduler, 25.0);
}


function playSound(time, buffer, gainNode) {
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.start(time);
}

function scheduleNoteAndVisual(beat16, time) {
    const quarterBeat = Math.floor(beat16 / 4);

    if (beat16 % 4 === 0) {
        setTimeout(() => {
            document.querySelectorAll('.beat-dot').forEach(dot => dot.classList.remove('active'));
            const activeDot = document.querySelector(`.beat-dot[data-index='${quarterBeat}']`);
            if (activeDot) {
                activeDot.classList.add('active');
            }
        }, (time - audioContext.currentTime) * 1000);
    }
    
    if (beat16 === 0) {
        if (isRhythmModeEnabled) {
            rhythmPattern = [...nextRhythmPattern];
            nextRhythmPattern = randomRhythmCheckbox.checked ? generateNewRandomPattern() : [...rhythmPattern];
            displayRhythmPattern();
            displayRhythmPreview();
        }
        
        if (isChordModeEnabled) { 
            let currentChord, nextChord;
            
            if (randomChordsCheckbox.checked) {
                if (nextRandomChord === null) {
                    currentChord = availableChords[Math.floor(Math.random() * availableChords.length)];
                    nextRandomChord = availableChords[Math.floor(Math.random() * availableChords.length)];
                } else {
                    currentChord = nextRandomChord;
                    nextRandomChord = availableChords[Math.floor(Math.random() * availableChords.length)];
                }
                chords = [currentChord];
                currentChordIndex = 0;
                nextChord = nextRandomChord;
            } else {
                chords = parseChordInput();
                currentChord = chords[currentChordIndex];
                nextChord = chords[(currentChordIndex + 1) % chords.length];
            }

            chordDisplay.textContent = currentChord;
            nextChordPreview.textContent = (chords.length > 1 || randomChordsCheckbox.checked) && nextChord !== currentChord ? `(→ ${nextChord})` : '';

            currentChordIndex = (currentChordIndex + 1) % chords.length;
        }
    }
    
    if (isRhythmModeEnabled) {
        const rhythmState = rhythmPattern[beat16];
        if (rhythmState > 0) {
            const bufferToPlay = (rhythmState === 2) ? rhythmAccentBuffer : rhythmTickBuffer;
            playSound(time, bufferToPlay, rhythmGain);
            const cell = rhythmGrid.children[beat16];
            setTimeout(() => { if (cell) { cell.classList.add('playing'); setTimeout(() => cell.classList.remove('playing'), 100); }}, (time - audioContext.currentTime) * 1000);
        }
    }
    if (beat16 % 4 === 0) {
        if (isChordModeEnabled && quarterBeat === 0) {
            const chordToPlay = chords[0]; 
            const notes = chordDefinitions[chordToPlay];
            if (notes) { notes.forEach(note => { const freq = noteFrequencies[note]; if (freq) playOscillator(time, freq, chordGain, 'triangle', 0.4); }); }
       }
        const currentState = beatStates[quarterBeat];if (currentState > 0) {
            const bufferToPlay = (currentState === 2) ? accentBuffer : tickBuffer;
            playSound(time, bufferToPlay, beatGain);
        }
    }
}

function generateRandomRhythmPattern() { 
    rhythmPattern = generateNewRandomPattern();
    nextRhythmPattern = generateNewRandomPattern();
    displayRhythmPattern();
    displayRhythmPreview();
}

function generateNewRandomPattern() {
    const patternLength = beatsPerMeasure * 4;
    const newPattern = [];
    const accentMode = rhythmAccentCheckbox.checked;
    for (let i = 0; i < patternLength; i++) {
        if (accentMode) {
            const rand = Math.random();
            if (rand < 0.6) newPattern.push(0);
            else if (rand < 0.9) newPattern.push(1);
            else newPattern.push(2);
        } else {
            newPattern.push(Math.random() < 0.5 ? 1 : 0);
        }
    }
    return newPattern;
}


function displayRhythmPattern() { 
    const cells = rhythmGrid.children; 
    for (let i = 0; i < cells.length; i++) { 
        updateRhythmCellStyle(cells[i], rhythmPattern[i]);
    }
}

function displayRhythmPreview() {
    const previewCells = rhythmPreviewGrid.children;
    for (let i = 0; i < previewCells.length; i++) {
        const state = nextRhythmPattern[i];
        previewCells[i].classList.remove('active', 'accent');
        if (state === 1) {
            previewCells[i].classList.add('active');
        } else if (state === 2) {
            previewCells[i].classList.add('accent');
        }
    }
}

function createRhythmGrid() { 
    rhythmGrid.innerHTML = ''; 
    rhythmPreviewGrid.innerHTML = '';
    const patternLength = beatsPerMeasure * 4; 
    rhythmGrid.style.setProperty('--grid-columns', beatsPerMeasure); 
    rhythmPreviewGrid.style.setProperty('--grid-columns', beatsPerMeasure);
    
    rhythmPattern = new Array(patternLength).fill(0);
    nextRhythmPattern = new Array(patternLength).fill(0);

    for (let i = 0; i < patternLength; i++) { 
        const cell = document.createElement('div'); 
        cell.classList.add('rhythm-cell'); 
        cell.addEventListener('click', () => { 
            if (!randomRhythmCheckbox.checked) { 
                if (rhythmAccentCheckbox.checked) { 
                    rhythmPattern[i] = (rhythmPattern[i] + 1) % 3; 
                } else { 
                    rhythmPattern[i] = rhythmPattern[i] > 0 ? 0 : 1; 
                } 
                nextRhythmPattern = [...rhythmPattern];
                displayRhythmPattern();
                displayRhythmPreview();
            }
        }); 
        rhythmGrid.appendChild(cell);

        const previewCell = document.createElement('div');
        previewCell.classList.add('preview-cell');
        rhythmPreviewGrid.appendChild(previewCell);
    }
    displayRhythmPattern();
    displayRhythmPreview();
}

function updateRhythmCellStyle(cell, state) { 
    cell.classList.remove('active', 'accent'); 
    if (state === 1) cell.classList.add('active'); 
    else if (state === 2) cell.classList.add('accent'); 
}

function createBeatIndicators() { beatIndicatorContainer.innerHTML = ''; for (let i = 0; i < beatsPerMeasure; i++) { const dot = document.createElement('div'); dot.classList.add('beat-dot'); dot.dataset.index = i; updateDotStyle(dot, beatStates[i]); dot.addEventListener('click', e => { const index = Number(e.target.dataset.index); beatStates[index] = (beatStates[index] + 2) % 3; updateDotStyle(e.target, beatStates[index]); }); beatIndicatorContainer.appendChild(dot); }}
function updateBeatStates() { beatStates = []; for (let i = 0; i < beatsPerMeasure; i++) { beatStates.push(i === 0 ? 2 : 1); }}
function updateDotStyle(dotElement, state) { dotElement.classList.remove('state-accent', 'state-tick', 'state-silent'); if (state === 2) dotElement.classList.add('state-accent'); else if (state === 1) dotElement.classList.add('state-tick'); else if (state === 0) dotElement.classList.add('state-silent'); }
function parseChordInput() { if (randomChordsCheckbox.checked) { const randomIndex = Math.floor(Math.random() * availableChords.length); return [availableChords[randomIndex]]; } const rawInput = chordInput.value.trim(); if (rawInput === '') return ['N.C.']; const parsedChords = rawInput.split(/[\s,]+/).filter(c => c !== ''); return parsedChords.length > 0 ? parsedChords : ['N.C.']; }
function updateBpm(newBpm) {
    bpm = Math.max(40, Math.min(240, newBpm));
    bpmOutput.textContent = bpm;
    bpmSlider.value = bpm;
    presetBtns.forEach(button => button.classList.remove('active'));
    const activeButton = document.querySelector(`.preset-btn[data-bpm='${bpm}']`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}
function playAudio() {
    if (!audioBuffer) return;
    if (audioPauseOffset >= audioBuffer.duration) {
        audioPauseOffset = 0;
    }
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioGain);
    
    audioStartTime = audioContext.currentTime;
    audioSource.start(audioStartTime, audioPauseOffset);
}
function updateAudioProgress() {
    if (!isPlaying || !audioBuffer) return;
    const elapsedTime = audioPauseOffset + (audioContext.currentTime - audioStartTime);
    if (elapsedTime < 0) {
        progressAnimationId = requestAnimationFrame(updateAudioProgress);
        return;
    }
    if (elapsedTime >= audioBuffer.duration) {
        startStopBtn.click();
        audioProgressBar.value = audioProgressBar.max;
        return;
    }
    audioProgressBar.value = elapsedTime;
    audioCurrentTime.textContent = formatTime(elapsedTime);
    progressAnimationId = requestAnimationFrame(updateAudioProgress);
}
audioProgressBar.addEventListener('input', (e) => {
    if (!audioBuffer) return;
    const seekTime = Number(e.target.value);
    audioPauseOffset = seekTime;
    audioCurrentTime.textContent = formatTime(seekTime);
    if (isPlaying) {
        audioSource.stop();
        playAudio();
    }
});
let pressTimer = null, intervalId = null, isLongPress = false; const LONG_PRESS_DURATION = 500, REPEAT_INTERVAL = 250;
bpmPlusBtn.addEventListener('mousedown', () => { isLongPress = false; pressTimer = setTimeout(() => { isLongPress = true; let newBpm = Math.ceil(bpm / 10) * 10; if (newBpm <= bpm) newBpm += 10; updateBpm(newBpm); intervalId = setInterval(() => updateBpm(bpm + 10), REPEAT_INTERVAL); }, LONG_PRESS_DURATION); });
bpmMinusBtn.addEventListener('mousedown', () => { isLongPress = false; pressTimer = setTimeout(() => { isLongPress = true; let newBpm = Math.floor(bpm / 10) * 10; if (newBpm >= bpm) newBpm -= 10; updateBpm(newBpm); intervalId = setInterval(() => updateBpm(bpm - 10), REPEAT_INTERVAL); }, LONG_PRESS_DURATION); });
const cancelBpmChange = () => {
    clearTimeout(pressTimer);
    clearInterval(intervalId);
};
const handleBpmButtonRelease = (e) => {
    if (!isLongPress) {
        if (e.currentTarget.id === 'bpm-plus-btn') {
            updateBpm(bpm + 1);
        } else if (e.currentTarget.id === 'bpm-minus-btn') {
            updateBpm(bpm - 1);
        }
    }
    cancelBpmChange();
};
bpmPlusBtn.addEventListener('mouseup', handleBpmButtonRelease);
bpmPlusBtn.addEventListener('mouseleave', cancelBpmChange);
bpmMinusBtn.addEventListener('mouseup', handleBpmButtonRelease);
bpmMinusBtn.addEventListener('mouseleave', cancelBpmChange);