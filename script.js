// --- 오디오 컨텍스트 및 마스터 게인 노드 설정 ---
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioContext.createGain();
masterGain.connect(audioContext.destination);

// --- 각 기능별 게인 노드 설정 ---
const beatGain = audioContext.createGain();
const rhythmGain = audioContext.createGain();
const chordGain = audioContext.createGain();
beatGain.connect(masterGain);
rhythmGain.connect(masterGain);
chordGain.connect(masterGain);

// --- 상태 변수 ---
let bpm = 120;
let beatsPerMeasure = 4;
let isPlaying = false;
let nextNoteTime = 0.0;
let timerID;
let beatStates = [];
let rhythmPattern = [];
let current16thNote = 0;
let isRhythmModeEnabled = false;
let chords = ['C'];
let currentChordIndex = 0;
let isChordModeEnabled = false;

// --- 사운드 데이터 ---
const noteFrequencies = { 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99 };
const chordDefinitions = { 'C': ['C4', 'E4', 'G4'], 'G': ['G4', 'B4', 'D5'], 'Am': ['A4', 'C5', 'E5'], 'F': ['F4', 'A4', 'C5'], 'Dm': ['D4', 'F4', 'A4'], 'E': ['E4', 'G4', 'B4'] };
const availableChords = Object.keys(chordDefinitions);

// --- HTML 요소 가져오기 ---
const masterVolumeSlider = document.getElementById('master-volume-slider');
const masterVolumePercentage = document.getElementById('master-volume-percentage');
const beatVolumeSlider = document.getElementById('beat-volume-slider');
const beatVolumePercentage = document.getElementById('beat-volume-percentage');
const rhythmVolumeSlider = document.getElementById('rhythm-volume-slider');
const rhythmVolumePercentage = document.getElementById('rhythm-volume-percentage');
const chordVolumeSlider = document.getElementById('chord-volume-slider');
const chordVolumePercentage = document.getElementById('chord-volume-percentage');
const rhythmVolumeControl = document.getElementById('rhythm-volume-control'); // 이 줄 추가
const chordVolumeControl = document.getElementById('chord-volume-control');   // 이 줄 추가
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
const toggleChordPanelBtn = document.getElementById('toggle-chord-panel-btn');
const chordModule = document.querySelector('.chord-module');
const rhythmModule = document.querySelector('.rhythm-module');
const rhythmGrid = document.querySelector('.rhythm-grid');
const toggleRhythmPanelBtn = document.getElementById('toggle-rhythm-panel-btn');
const rhythmAccentCheckbox = document.getElementById('rhythm-accent-checkbox');
const randomRhythmCheckbox = document.getElementById('random-rhythm-checkbox');
const presetBtns = document.querySelectorAll('.preset-btn'); // 이 줄 추가

// --- 초기화 ---
initialize();

function initialize() {
    masterGain.gain.value = masterVolumeSlider.value;
    beatGain.gain.value = beatVolumeSlider.value;
    rhythmGain.gain.value = rhythmVolumeSlider.value;
    chordGain.gain.value = chordVolumeSlider.value;
    updateBeatStates();
    createBeatIndicators();
    createRhythmGrid();
    updateBpm(bpm);
}

// --- 이벤트 리스너 ---

masterVolumeSlider.addEventListener('input', e => { masterGain.gain.value = e.target.value; masterVolumePercentage.textContent = `${Math.round(e.target.value * 100)}%`; });
bpmSlider.addEventListener('input', e => {
    updateBpm(Number(e.target.value));
});
beatVolumeSlider.addEventListener('input', e => { beatGain.gain.value = e.target.value; beatVolumePercentage.textContent = `${Math.round(e.target.value * 100)}%`; });
rhythmVolumeSlider.addEventListener('input', e => { rhythmGain.gain.value = e.target.value; rhythmVolumePercentage.textContent = `${Math.round(e.target.value * 100)}%`; });
chordVolumeSlider.addEventListener('input', e => { chordGain.gain.value = e.target.value; chordVolumePercentage.textContent = `${Math.round(e.target.value * 100)}%`; });

presetBtns.forEach(button => {
    button.addEventListener('click', (e) => {
        const newBpm = Number(e.currentTarget.dataset.bpm);
        updateBpm(newBpm);
    });
});

startStopBtn.addEventListener('click', () => {
    if (audioContext.state === 'suspended') audioContext.resume();
    isPlaying = !isPlaying;
    if (isPlaying) {
        chords = parseChordInput();
        currentChordIndex = 0;
        current16thNote = 0;
        nextNoteTime = audioContext.currentTime + 0.1;
        scheduler();
        startStopBtn.textContent = '정지';
    } else {
        clearTimeout(timerID);
        document.querySelectorAll('.beat-dot.active, .rhythm-cell.playing').forEach(el => { el.classList.remove('playing'); if (el.classList.contains('beat-dot')) el.classList.remove('active'); });
        startStopBtn.textContent = '시작';
    }
});

beatsPerMeasureInput.addEventListener('input', e => { const newBeats = Number(e.target.value); if (newBeats > 0 && newBeats <= 16) { beatsPerMeasure = newBeats; updateBeatStates(); createBeatIndicators(); createRhythmGrid(); }});
toggleRhythmPanelBtn.addEventListener('click', () => {
    isRhythmModeEnabled = !isRhythmModeEnabled;
    rhythmModule.classList.toggle('hidden');
    rhythmVolumeControl.classList.toggle('hidden'); // 리듬 볼륨 컨트롤도 토글
    toggleRhythmPanelBtn.textContent = isRhythmModeEnabled ? '리듬 끄기' : '리듬';
});

toggleChordPanelBtn.addEventListener('click', () => {
    isChordModeEnabled = !isChordModeEnabled;
    chordModule.classList.toggle('hidden');
    chordVolumeControl.classList.toggle('hidden'); // 코드 볼륨 컨트롤도 토글
    toggleChordPanelBtn.textContent = isChordModeEnabled ? '코드 끄기' : '코드';
});
randomChordsCheckbox.addEventListener('change', e => { chordInput.disabled = e.target.checked; chordInput.placeholder = e.target.checked ? '랜덤 코드가 생성됩니다.' : '코드 진행 입력 (예: C, G, Am, F)'; if(e.target.checked) chordInput.value = ''; });
randomRhythmCheckbox.addEventListener('change', e => { const isChecked = e.target.checked; const footerText = rhythmModule.querySelector('p'); footerText.textContent = isChecked ? '매 마디마다 랜덤 패턴이 생성됩니다.' : '각 셀을 클릭하여 리듬을 만드세요.'; if (isChecked) { generateRandomRhythmPattern(); displayRhythmPattern(); }});
rhythmAccentCheckbox.addEventListener('change', e => { if (!e.target.checked) { rhythmPattern = rhythmPattern.map(state => state === 2 ? 1 : state); displayRhythmPattern(); }});

// --- 핵심 로직: 스케줄러 및 사운드 ---

function scheduler() {
    while (nextNoteTime < audioContext.currentTime + 0.1) {
        scheduleNoteAndVisual(current16thNote, nextNoteTime);
        const secondsPer16thNote = (60.0 / bpm) / 4;
        nextNoteTime += secondsPer16thNote;
        current16thNote = (current16thNote + 1) % (beatsPerMeasure * 4);
    }
    timerID = setTimeout(scheduler, 25.0);
}

function playSound(time, freq, gainNode, type = 'sine', duration = 0.1) {
    const osc = audioContext.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.connect(gainNode);
    osc.start(time);
    osc.stop(time + duration);
}

function scheduleNoteAndVisual(beat16, time) {
    if (beat16 === 0) {
        if (isRhythmModeEnabled && randomRhythmCheckbox.checked) { generateRandomRhythmPattern(); displayRhythmPattern(); }
        if (isChordModeEnabled) { if (randomChordsCheckbox.checked) chords = parseChordInput(); const currentChord = chords[currentChordIndex]; chordDisplay.textContent = currentChord; currentChordIndex = (currentChordIndex + 1) % chords.length; }
    }
    if (isRhythmModeEnabled) {
        const rhythmState = rhythmPattern[beat16];
        if (rhythmState > 0) {
            const freq = rhythmState === 2 ? 1600 : 1200;
            const duration = rhythmState === 2 ? 0.08 : 0.05;
            playSound(time, freq, rhythmGain, 'square', duration);
            const cell = rhythmGrid.children[beat16];
            setTimeout(() => { if (cell) { cell.classList.add('playing'); setTimeout(() => cell.classList.remove('playing'), 100); }}, (time - audioContext.currentTime) * 1000);
        }
    }
    if (beat16 % 4 === 0) {
        const quarterBeat = beat16 / 4;
        setTimeout(() => { document.querySelectorAll('.beat-dot').forEach(dot => dot.classList.remove('active')); const activeDot = document.querySelector(`.beat-dot[data-index='${quarterBeat}']`); if(activeDot) activeDot.classList.add('active'); }, (time - audioContext.currentTime) * 1000);
        if (isChordModeEnabled && quarterBeat === 0) {
            const chordToPlay = chords[currentChordIndex - 1] || chords[chords.length - 1];
            const notes = chordDefinitions[chordToPlay];
            if (notes) { notes.forEach(note => { const freq = noteFrequencies[note]; if (freq) playSound(time, freq, chordGain, 'triangle', 0.4); }); }
        }
        const currentState = beatStates[quarterBeat];
        if (currentState > 0) { const freq = currentState === 2 ? 880 : 440; playSound(time, freq, beatGain); }
    }
}

// --- UI 생성 및 업데이트 함수 ---

function generateRandomRhythmPattern() { const patternLength = beatsPerMeasure * 4; rhythmPattern = []; const accentMode = rhythmAccentCheckbox.checked; for (let i = 0; i < patternLength; i++) { if (accentMode) { const rand = Math.random(); if (rand < 0.6) rhythmPattern.push(0); else if (rand < 0.9) rhythmPattern.push(1); else rhythmPattern.push(2); } else { rhythmPattern.push(Math.random() < 0.5 ? 1 : 0); }}}
function displayRhythmPattern() { const cells = rhythmGrid.children; for (let i = 0; i < cells.length; i++) { updateRhythmCellStyle(cells[i], rhythmPattern[i]); }}
function createRhythmGrid() { rhythmGrid.innerHTML = ''; const patternLength = beatsPerMeasure * 4; rhythmGrid.style.setProperty('--grid-columns', beatsPerMeasure); for (let i = 0; i < patternLength; i++) { const cell = document.createElement('div'); cell.classList.add('rhythm-cell'); cell.addEventListener('click', () => { if (!randomRhythmCheckbox.checked) { if (rhythmPattern.length !== patternLength) rhythmPattern = new Array(patternLength).fill(0); if (rhythmAccentCheckbox.checked) { rhythmPattern[i] = (rhythmPattern[i] + 1) % 3; } else { rhythmPattern[i] = rhythmPattern[i] > 0 ? 0 : 1; } updateRhythmCellStyle(cell, rhythmPattern[i]); }}); rhythmGrid.appendChild(cell); }}
function updateRhythmCellStyle(cell, state) { cell.classList.remove('active', 'accent'); if (state === 1) cell.classList.add('active'); else if (state === 2) cell.classList.add('accent'); }
function createBeatIndicators() { beatIndicatorContainer.innerHTML = ''; for (let i = 0; i < beatsPerMeasure; i++) { const dot = document.createElement('div'); dot.classList.add('beat-dot'); dot.dataset.index = i; updateDotStyle(dot, beatStates[i]); dot.addEventListener('click', e => { const index = Number(e.target.dataset.index); beatStates[index] = (beatStates[index] + 2) % 3; updateDotStyle(e.target, beatStates[index]); }); beatIndicatorContainer.appendChild(dot); }}
function updateBeatStates() { beatStates = []; for (let i = 0; i < beatsPerMeasure; i++) { beatStates.push(i === 0 ? 2 : 1); }}
function updateDotStyle(dotElement, state) { dotElement.classList.remove('state-accent', 'state-tick', 'state-silent'); if (state === 2) dotElement.classList.add('state-accent'); else if (state === 1) dotElement.classList.add('state-tick'); else if (state === 0) dotElement.classList.add('state-silent'); }
function parseChordInput() { if (randomChordsCheckbox.checked) { const randomIndex = Math.floor(Math.random() * availableChords.length); return [availableChords[randomIndex]]; } const rawInput = chordInput.value.trim(); if (rawInput === '') return ['N.C.']; const parsedChords = rawInput.split(/[\s,]+/).filter(c => c !== ''); return parsedChords.length > 0 ? parsedChords : ['N.C.']; }
function updateBpm(newBpm) {
    bpm = Math.max(40, Math.min(240, newBpm));
    bpmOutput.textContent = bpm;
    bpmSlider.value = bpm;

    // ▼▼▼ 이 부분 추가 ▼▼▼
    // 모든 프리셋 버튼의 active 클래스를 일단 제거
    presetBtns.forEach(button => button.classList.remove('active'));
    // 현재 BPM과 일치하는 프리셋 버튼을 찾아 active 클래스 추가
    const activeButton = document.querySelector(`.preset-btn[data-bpm='${bpm}']`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

let pressTimer = null, intervalId = null, isLongPress = false; const LONG_PRESS_DURATION = 500, REPEAT_INTERVAL = 250;
bpmPlusBtn.addEventListener('mousedown', () => { isLongPress = false; pressTimer = setTimeout(() => { isLongPress = true; let newBpm = Math.ceil(bpm / 10) * 10; if (newBpm <= bpm) newBpm += 10; updateBpm(newBpm); intervalId = setInterval(() => updateBpm(bpm + 10), REPEAT_INTERVAL); }, LONG_PRESS_DURATION); });
bpmMinusBtn.addEventListener('mousedown', () => { isLongPress = false; pressTimer = setTimeout(() => { isLongPress = true; let newBpm = Math.floor(bpm / 10) * 10; if (newBpm >= bpm) newBpm -= 10; updateBpm(newBpm); intervalId = setInterval(() => updateBpm(bpm - 10), REPEAT_INTERVAL); }, LONG_PRESS_DURATION); });
const cancelBpmChange = () => {
    clearTimeout(pressTimer);
    clearInterval(intervalId);
};
const handleBpmButtonRelease = (e) => {
    // 롱 프레스가 아니었을 경우에만 '짧은 클릭'으로 처리
    if (!isLongPress) {
        if (e.currentTarget.id === 'bpm-plus-btn') {
            updateBpm(bpm + 1);
        } else if (e.currentTarget.id === 'bpm-minus-btn') {
            updateBpm(bpm - 1);
        }
    }
    // 마우스를 떼면 무조건 타이머는 취소
    cancelBpmChange();
};


bpmPlusBtn.addEventListener('mouseup', handleBpmButtonRelease);
bpmPlusBtn.addEventListener('mouseleave', cancelBpmChange); // mouseleave는 이제 타이머 취소만 담당
bpmMinusBtn.addEventListener('mouseup', handleBpmButtonRelease);
bpmMinusBtn.addEventListener('mouseleave', cancelBpmChange); // mouseleave는 이제 타이머 취소만 담당
