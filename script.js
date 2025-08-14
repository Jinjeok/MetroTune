// 오디오 컨텍스트와 메트로놈 관련 변수 초기화
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let bpm = 120;
let beatsPerMeasure = 4;
let currentBeatInMeasure = 0;
let isPlaying = false;
let nextNoteTime = 0.0;
let timerID;
let visualTimerID;

// 비트 상태 관리: 0: 쉼(silent), 1: 약(tick), 2: 강(accent)
let beatStates = []; 

// HTML에서 제어할 요소들을 가져오기
const bpmOutput = document.getElementById('bpm-output');
const bpmSlider = document.getElementById('bpm-slider');
const startStopBtn = document.getElementById('start-stop-btn');
const beatsPerMeasureInput = document.getElementById('beats-per-measure');
const beatIndicatorContainer = document.getElementById('beat-indicator-container');
const bpmPlusBtn = document.getElementById('bpm-plus-btn');   // (+) 버튼
const bpmMinusBtn = document.getElementById('bpm-minus-btn'); // (-) 버튼

// 초기화 함수 호출
initialize();

function initialize() {
    updateBeatStates();
    createBeatIndicators();
}

function updateBpm(newBpm) {
    // BPM 값은 40 ~ 240 사이로 제한
    bpm = Math.max(40, Math.min(240, newBpm));
    bpmOutput.textContent = bpm;
    bpmSlider.value = bpm;
}

// 3. 기존 BPM 슬라이더 이벤트 리스너를 새 함수를 사용하도록 수정
bpmSlider.addEventListener('input', (e) => {
    updateBpm(Number(e.target.value));
});

// ... updateBpm(newBpm) 함수 아래에 추가 ...

// 4. BPM 조작 버튼 이벤트 리스너 (업그레이드 버전)
let pressTimer = null;
let intervalId = null;
let isLongPress = false;

const LONG_PRESS_DURATION = 500; // 0.5초 이상 누르면 롱 프레스로 간주
const REPEAT_INTERVAL = 250;     // 0.15초마다 반복

// (+) 버튼 이벤트 리스너
bpmPlusBtn.addEventListener('mousedown', () => {
    isLongPress = false;
    pressTimer = setTimeout(() => {
        isLongPress = true;
        // 1. 롱 프레스 시작 시, 먼저 10 단위로 올림
        let newBpm = Math.ceil(bpm / 10) * 10;
        if (newBpm <= bpm) newBpm += 10;
        updateBpm(newBpm);
        // 2. 그 후, 계속해서 10씩 올리는 인터벌 시작
        intervalId = setInterval(() => {
            updateBpm(bpm + 10);
        }, REPEAT_INTERVAL);
    }, LONG_PRESS_DURATION);
});

// (-) 버튼 이벤트 리스너
bpmMinusBtn.addEventListener('mousedown', () => {
    isLongPress = false;
    pressTimer = setTimeout(() => {
        isLongPress = true;
        // 1. 롱 프레스 시작 시, 먼저 10 단위로 내림
        let newBpm = Math.floor(bpm / 10) * 10;
        if (newBpm >= bpm) newBpm -= 10;
        updateBpm(newBpm);
        // 2. 그 후, 계속해서 10씩 내리는 인터벌 시작
        intervalId = setInterval(() => {
            updateBpm(bpm - 10);
        }, REPEAT_INTERVAL);
    }, LONG_PRESS_DURATION);
});

// 마우스에서 손을 떼거나, 버튼 밖으로 나갔을 때 모든 타이머를 중지하는 공통 함수
const stopBpmChange = (e) => {
    clearTimeout(pressTimer);
    clearInterval(intervalId);
    // 롱 프레스가 아니었을 경우에만 '짧은 클릭'으로 간주하여 1씩 변경
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


// ... (기존 박자 입력, 시작/정지 버튼 리스너 등) ...
// 박자 입력 필드 이벤트
beatsPerMeasureInput.addEventListener('input', (e) => {
    beatsPerMeasure = Number(e.target.value);
    initialize(); // 박자 변경 시 전체 초기화
});

// 시작/정지 버튼 클릭 이벤트
// 시작/정지 버튼 클릭 이벤트
startStopBtn.addEventListener('click', () => {
    // ▼▼▼ 이 부분 추가 ▼▼▼
    // AudioContext가 일시정지 상태이면 활성화시킵니다.
    // 이 작업은 사용자의 첫 클릭 시 한 번만 실행되면 됩니다.
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    // ▲▲▲ 여기까지 추가 ▲▲▲

    isPlaying = !isPlaying;

    if (isPlaying) {
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
// 스케줄러 함수
function scheduler() {
    while (nextNoteTime < audioContext.currentTime + 0.1) {
        scheduleNoteAndVisual(currentBeatInMeasure, nextNoteTime);
        
        const secondsPerBeat = 60.0 / bpm;
        nextNoteTime += secondsPerBeat;
        currentBeatInMeasure = (currentBeatInMeasure + 1) % beatsPerMeasure;
    }
    timerID = setTimeout(scheduler, 25.0);
}

// 사운드 및 시각 효과 예약 함수
function scheduleNoteAndVisual(beatNumber, time) {
    // 1. 사운드 예약
    const currentState = beatStates[beatNumber];
    if (currentState > 0) { // 상태가 '쉼'(0)이 아닐 때만 소리 재생
        const oscillator = audioContext.createOscillator();
        if (currentState === 2) { // '강'
            oscillator.frequency.setValueAtTime(880, time);
        } else { // '약'
            oscillator.frequency.setValueAtTime(440, time);
        }
        oscillator.type = 'sine';
        oscillator.connect(audioContext.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.1);
    }

    // 2. 시각 효과 예약
    const delay = (time - audioContext.currentTime) * 1000;
    visualTimerID = setTimeout(() => drawVisual(beatNumber), delay);
}

// 시각적 피드백을 그리는 함수
function drawVisual(beatNumber) {
    const dots = document.querySelectorAll('.beat-dot');
    dots.forEach(dot => dot.classList.remove('active'));
    if (dots[beatNumber]) {
        dots[beatNumber].classList.add('active');
    }
}

// 비트 인디케이터 생성 및 클릭 이벤트 설정 함수
function createBeatIndicators() {
    beatIndicatorContainer.innerHTML = '';
    for (let i = 0; i < beatsPerMeasure; i++) {
        const dot = document.createElement('div');
        dot.classList.add('beat-dot');
        dot.dataset.index = i; // 각 점에 인덱스 저장
        
        updateDotStyle(dot, beatStates[i]); // 상태에 맞는 스타일 적용

        dot.addEventListener('click', (e) => {
            const index = Number(e.target.dataset.index);
            // 상태 변경: 2 -> 1 -> 0 -> 2 ...
            beatStates[index] = (beatStates[index] + 2) % 3;
            updateDotStyle(e.target, beatStates[index]);
        });
        
        beatIndicatorContainer.appendChild(dot);
    }
}

// 비트 상태 배열 업데이트 함수
function updateBeatStates() {
    beatStates = [2]; // 첫 박은 '강'으로 시작
    for (let i = 1; i < beatsPerMeasure; i++) {
        beatStates.push(1); // 나머지는 '약'으로 채움
    }
}

// 점의 상태에 따라 스타일을 업데이트하는 함수
function updateDotStyle(dotElement, state) {
    dotElement.classList.remove('state-accent', 'state-tick', 'state-silent');
    switch (state) {
        case 2: // 강
            dotElement.classList.add('state-accent');
            break;
        case 1: // 약
            dotElement.classList.add('state-tick');
            break;
        case 0: // 쉼
            dotElement.classList.add('state-silent');
            break;
    }
}