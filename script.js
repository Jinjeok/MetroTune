const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);

let bpm = 120;
let beatsPerMeasure = 4;
let currentBeatInMeasure = 0;
let isPlaying = false;
let isChordModeEnabled = false; // 이 줄 추가
let nextNoteTime = 0.0;
let timerID;
let visualTimerID;
let beatStates = [];
let chords = ['C'];
let currentChordIndex = 0;

const noteFrequencies = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99,
};

const chordDefinitions = {
    'C': ['C4', 'E4', 'G4'],    'G': ['G4', 'B4', 'D5'],
    'Am': ['A4', 'C5', 'E5'],   'F': ['F4', 'A4', 'C5'],
    'Dm': ['D4', 'F4', 'A4'],   'E': ['E4', 'G4', 'B4'],
};
const availableChords = Object.keys(chordDefinitions);

const bpmOutput = document.getElementById('bpm-output');
const bpmSlider = document.getElementById('bpm-slider');
const volumeSlider = document.getElementById('volume-slider');
const startStopBtn = document.getElementById('start-stop-btn');
const beatsPerMeasureInput = document.getElementById('beats-per-measure');
const beatIndicatorContainer = document.getElementById('beat-indicator-container');
const bpmPlusBtn = document.getElementById('bpm-plus-btn');
const bpmMinusBtn = document.getElementById('bpm-minus-btn');
const chordInput = document.getElementById('chord-input');
const randomChordsCheckbox = document.getElementById('random-chords-checkbox');
const chordDisplay = document.getElementById('chord-display');
const toggleChordPanelBtn = document.getElementById('toggle-chord-panel-btn'); // 토글 버튼
const chordModule = document.querySelector('.chord-module'); // 코드 모듈


initialize();

function initialize() {
    updateBeatStates();
    createBeatIndicators();
    gainNode.gain.value = volumeSlider.value;
}

function updateBpm(newBpm) {
    bpm = Math.max(40, Math.min(240, newBpm));
    bpmOutput.textContent = bpm;
    bpmSlider.value = bpm;
}

bpmSlider.addEventListener('input', (e) => {
    updateBpm(Number(e.target.value));
});

volumeSlider.addEventListener('input', (e) => {
    gainNode.gain.value = e.target.value;
});

let pressTimer = null;
let intervalId = null;
let isLongPress = false;
const LONG_PRESS_DURATION = 500;
const REPEAT_INTERVAL = 250; // 요청하신 대로 250으로 수정


toggleChordPanelBtn.addEventListener('click', () => {
    isChordModeEnabled = !isChordModeEnabled; // 상태 뒤집기
    chordModule.classList.toggle('hidden'); // hidden 클래스 토글

    if (isChordModeEnabled) {
        toggleChordPanelBtn.textContent = '코드 연습 끄기';
    } else {
        toggleChordPanelBtn.textContent = '코드 연습 켜기';
    }
});


bpmPlusBtn.addEventListener('mousedown', () => {
    isLongPress = false;
    pressTimer = setTimeout(() => {
        isLongPress = true;
        let newBpm = Math.ceil(bpm / 10) * 10;
        if (newBpm <= bpm) newBpm += 10;
        updateBpm(newBpm);
        intervalId = setInterval(() => {
            updateBpm(bpm + 10);
        }, REPEAT_INTERVAL);
    }, LONG_PRESS_DURATION);
});

bpmMinusBtn.addEventListener('mousedown', () => {
    isLongPress = false;
    pressTimer = setTimeout(() => {
        isLongPress = true;
        let newBpm = Math.floor(bpm / 10) * 10;
        if (newBpm >= bpm) newBpm -= 10;
        updateBpm(newBpm);
        intervalId = setInterval(() => {
            updateBpm(bpm - 10);
        }, REPEAT_INTERVAL);
    }, LONG_PRESS_DURATION);
});

const stopBpmChange = (e) => {
    clearTimeout(pressTimer);
    clearInterval(intervalId);
    if (!isLongPress) {
        if (e.currentTarget.id === 'bpm-plus-btn') {
            updateBpm(bpm + 1);
        } else if (e.currentTarget.id === 'bpm-minus-btn') {
            updateBpm(bpm - 1);
        }
    }
};

bpmPlusBtn.addEventListener('mouseup', stopBpmChange);
bpmPlusBtn.addEventListener('mouseleave', stopBpmChange);
bpmMinusBtn.addEventListener('mouseup', stopBpmChange);
bpmMinusBtn.addEventListener('mouseleave', stopBpmChange);

randomChordsCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    chordInput.disabled = isChecked;
    if (isChecked) {
        chordInput.value = '';
        chordInput.placeholder = '랜덤 코드가 생성됩니다.';
    } else {
        chordInput.placeholder = '코드 진행 입력 (예: C, G, Am, F)';
    }
});

function parseChordInput() {
    if (randomChordsCheckbox.checked) {
        const randomIndex = Math.floor(Math.random() * availableChords.length);
        return [availableChords[randomIndex]];
    }
    const rawInput = chordInput.value.trim();
    if (rawInput === '') return ['N.C.'];
    const parsedChords = rawInput.split(/[\s,]+/).filter(c => c !== '');
    return parsedChords.length > 0 ? parsedChords : ['N.C.'];
}

startStopBtn.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    isPlaying = !isPlaying;
    if (isPlaying) {
        chords = parseChordInput();
        currentChordIndex = 0;
        currentBeatInMeasure = 0;
        nextNoteTime = audioContext.currentTime + 0.1;
        scheduler();
        startStopBtn.textContent = '정지';
    } else {
        clearTimeout(timerID);
        clearTimeout(visualTimerID);
        document.querySelectorAll('.beat-dot').forEach(dot => dot.classList.remove('active'));
        startStopBtn.textContent = '시작';
    }
});

function scheduler() {
    while (nextNoteTime < audioContext.currentTime + 0.1) {
        scheduleNoteAndVisual(currentBeatInMeasure, nextNoteTime);
        const secondsPerBeat = 60.0 / bpm;
        nextNoteTime += secondsPerBeat;
        currentBeatInMeasure = (currentBeatInMeasure + 1) % beatsPerMeasure;
    }
    timerID = setTimeout(scheduler, 25.0);
}

function playChord(chordName, time) {
    const notes = chordDefinitions[chordName];
    if (notes) {
        notes.forEach(note => {
            const freq = noteFrequencies[note];
            if (freq) {
                const osc = audioContext.createOscillator();
                osc.type = 'triangle'; // 'sine'에서 'triangle'로 변경
                osc.frequency.setValueAtTime(freq, time);
                osc.connect(gainNode);
                osc.start(time);
                osc.stop(time + 0.4);
            }
        });
    }
}


function scheduleNoteAndVisual(beatNumber, time) {
    // isChordModeEnabled가 true이고 첫 박자일 때만 코드 로직 실행
    if (isChordModeEnabled && beatNumber === 0) { 
        if (randomChordsCheckbox.checked) {
            chords = parseChordInput();
            currentChordIndex = 0;
        }
        const currentChord = chords[currentChordIndex];
        chordDisplay.textContent = currentChord;
        playChord(currentChord, time);
        currentChordIndex = (currentChordIndex + 1) % chords.length;
    }
    

    const currentState = beatStates[beatNumber];
    if (currentState > 0) {
        const oscillator = audioContext.createOscillator();
        if (currentState === 2) {
            oscillator.frequency.setValueAtTime(880, time);
        } else {
            oscillator.frequency.setValueAtTime(440, time);
        }
        oscillator.type = 'sine';
        oscillator.connect(gainNode);
        oscillator.start(time);
        oscillator.stop(time + 0.1);
    }
    const delay = (time - audioContext.currentTime) * 1000;
    visualTimerID = setTimeout(() => drawVisual(beatNumber), delay);
}

function drawVisual(beatNumber) {
    const dots = document.querySelectorAll('.beat-dot');
    dots.forEach(dot => dot.classList.remove('active'));
    if (dots[beatNumber]) {
        dots[beatNumber].classList.add('active');
    }
}

function createBeatIndicators() {
    beatIndicatorContainer.innerHTML = '';
    for (let i = 0; i < beatsPerMeasure; i++) {
        const dot = document.createElement('div');
        dot.classList.add('beat-dot');
        dot.dataset.index = i;
        updateDotStyle(dot, beatStates[i]);
        dot.addEventListener('click', (e) => {
            const index = Number(e.target.dataset.index);
            beatStates[index] = (beatStates[index] + 2) % 3;
            updateDotStyle(e.target, beatStates[index]);
        });
        beatIndicatorContainer.appendChild(dot);
    }
}

function updateBeatStates() {
    beatStates = [2];
    for (let i = 1; i < beatsPerMeasure; i++) {
        beatStates.push(1);
    }
}




function updateDotStyle(dotElement, state) {
    dotElement.classList.remove('state-accent', 'state-tick', 'state-silent');
    // 요청하신 대로 textContent 설정 부분을 제거
    switch (state) {
        case 2:
            dotElement.classList.add('state-accent');
            break;
        case 1:
            dotElement.classList.add('state-tick');
            break;
        case 0:
            dotElement.classList.add('state-silent');
            break;
    }
}