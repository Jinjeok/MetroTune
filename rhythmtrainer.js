class RhythmTrainer {
    constructor() {
        // DOM Elements
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.rhythmSelect = document.getElementById('rhythm-mode');
        this.bpmInput = document.getElementById('bpm-input');
        this.inputSelect = document.getElementById('input-mode');
        this.metronomeSelect = document.getElementById('metronome-mode');
        this.gameArea = document.getElementById('game-area');
        this.targetCircle = document.querySelector('.target-circle');
        this.feedbackDisplay = document.getElementById('feedback-display');
        this.startOverlay = document.getElementById('start-overlay');
        this.inputIndicator = document.getElementById('input-indicator');
        this.timerDisplay = document.getElementById('timer-display');
        
        this.scoreEls = {
            perfect: document.getElementById('score-perfect'),
            good: document.getElementById('score-good'),
            miss: document.getElementById('score-miss')
        };
        
        // New Visual Controls
        this.toggleShapeBtn = document.getElementById('toggle-shape-btn');
        this.toggleHighlightBtn = document.getElementById('toggle-highlight-btn');
        this.toggleHiddenBtn = document.getElementById('toggle-hidden-btn');
        
        this.audioContext = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.bpm = 60;
        this.rhythmMode = '8';
        this.inputMode = 'touch';
        this.metronomeMode = '4';
        
        // Visual Settings
        this.targetShape = 'circle'; // 'circle' or 'bar'
        this.highlightFirstBeat = false;
        this.isHiddenMode = false;
        
        this.notes = [];
        this.beatLines = [];
        this.score = { perfect: 0, good: 0, miss: 0 };
        
        this.lookahead = 25.0;
        this.scheduleAheadTime = 0.1;
        this.visualLookAhead = 2.0; // Seconds for note to fall
        this.fallDuration = 2.0;
        
        this.nextNoteTime = 0.0;
        this.nextBeatLineTime = 0.0;
        this.metronomeNextNoteTime = 0.0;
        this.metronomeCurrent16th = 0;
        
        // Advanced Rhythm State
        this.currentMeasurePattern = []; // For Binary Alphabet
        this.currentMeasureBeat = 0;
        this.currentMeasure16th = 0;
        this.permutationPattern = null;
        this.permutationIndex = 0;
        this.nextRhythmMode = null; // For pending mode switches
        
        // Timer
        this.elapsedTime = 0;
        this.timerInterval = null;

        this.initEventListeners();
        
        // Initial Visual State
        this.updateVisualSettings();
    }

    initEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        
        // Touch/Click Input
        const handleInput = (e) => {
            if (!this.isPlaying || this.isPaused) return;
            if (this.inputMode === 'touch') {
                e.preventDefault(); // Prevent zoom/scroll
                this.handleInputTrigger();
            }
        };
        
        this.inputIndicator.addEventListener('mousedown', handleInput);
        this.inputIndicator.addEventListener('touchstart', handleInput);
        document.addEventListener('keydown', (e) => {
            if (this.isPlaying) {
                if (e.code === 'Space' && !this.isPaused && this.inputMode === 'touch') {
                    e.preventDefault(); // Prevent scrolling
                    this.handleInputTrigger();
                } else if (e.code === 'KeyP') {
                    this.togglePause();
                } else if (e.code === 'KeyH') {
                    this.toggleHiddenMode();
                }
            }
        });

        // Settings changes
        this.bpmInput.addEventListener('change', (e) => this.bpm = parseInt(e.target.value));
        this.rhythmSelect.addEventListener('change', (e) => {
            // Queue the change for the next measure boundary
            this.nextRhythmMode = e.target.value;
            
            // Optional: Visual feedback could be added here, but for now just logic.
            // We do NOT reset anything here. The transition happens in advanceNoteTime.
        });
        this.inputSelect.addEventListener('change', (e) => this.inputMode = e.target.value);
        this.metronomeSelect.addEventListener('change', (e) => this.metronomeMode = e.target.value);
        
        // Visual Toggles
        this.toggleShapeBtn.addEventListener('click', () => {
            this.targetShape = this.targetShape === 'circle' ? 'bar' : 'circle';
            this.updateVisualSettings();
        });
        
        this.toggleHighlightBtn.addEventListener('click', () => {
            this.highlightFirstBeat = !this.highlightFirstBeat;
            this.updateVisualSettings();
        });
        
        this.toggleHiddenBtn.addEventListener('click', () => {
            this.toggleHiddenMode();
        });
    }
    
    updateVisualSettings() {
        // Target Shape
        if (this.targetShape === 'circle') {
            this.targetCircle.className = 'target-circle';
            this.toggleShapeBtn.textContent = '모양: 원';
        } else {
            this.targetCircle.className = 'target-bar';
            this.toggleShapeBtn.textContent = '모양: 막대';
        }
        
        // Highlight
        this.toggleHighlightBtn.textContent = `첫박 강조: ${this.highlightFirstBeat ? '켜짐' : '끄기'}`;
        this.toggleHighlightBtn.classList.toggle('active', this.highlightFirstBeat);
        
        // Hidden Mode
        this.toggleHiddenBtn.classList.toggle('active', this.isHiddenMode);
        if (this.isHiddenMode) {
            this.gameArea.classList.add('hidden-mode');
        } else {
            this.gameArea.classList.remove('hidden-mode');
        }
    }
    
    toggleHiddenMode() {
        this.isHiddenMode = !this.isHiddenMode;
        this.updateVisualSettings();
    }

    async initAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        // Load metronome sounds if not loaded
        if (!this.tickBuffer) {
            await this.loadMetronomeSounds();
        }
    }
    
    async loadMetronomeSounds() {
        try {
            // Using default sounds from script.js reference
            const accentUrl = 'sounds/Perc_MetronomeQuartz_hi.wav';
            const tickUrl = 'sounds/Perc_MetronomeQuartz_lo.wav';
            
            const [accent, tick] = await Promise.all([
                this.loadSound(accentUrl),
                this.loadSound(tickUrl)
            ]);
            
            this.accentBuffer = accent;
            this.tickBuffer = tick;
        } catch (e) {
            console.error("Failed to load metronome sounds", e);
        }
    }
    
    async loadSound(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await this.audioContext.decodeAudioData(arrayBuffer);
    }

    async start() {
        await this.initAudio();
        
        if (this.inputMode === 'mic') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.microphone = this.audioContext.createMediaStreamSource(stream);
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 256;
                this.microphone.connect(this.analyser);
                this.detectMicInput();
            } catch (err) {
                alert('마이크 접근이 거부되었거나 오류가 발생했습니다: ' + err.message);
                this.inputMode = 'touch';
                this.inputSelect.value = 'touch';
            }
        }

        this.isPlaying = true;
        this.isPaused = false;
        this.startOverlay.style.display = 'none';
        this.pauseBtn.style.display = 'block';
        this.pauseBtn.textContent = '일시정지 (P)';
        
        this.score = { perfect: 0, good: 0, miss: 0 };
        this.updateScoreDisplay();
        this.notes = [];
        this.beatLines = [];
        
        // Reset Timer
        this.elapsedTime = 0;
        this.updateTimerDisplay();
        this.startTimer();
        
        // Clear existing notes
        document.querySelectorAll('.note').forEach(n => n.remove());
        document.querySelectorAll('.beat-line').forEach(n => n.remove());

        // Start the music/metronome after fallDuration so the first note has time to fall
        this.startTime = this.audioContext.currentTime + this.fallDuration;
        
        this.nextNoteTime = this.startTime;
        this.nextBeatLineTime = this.startTime;
        this.metronomeNextNoteTime = this.startTime;
        this.metronomeCurrent16th = 0;
        
        this.currentMeasureBeat = 0;
        this.currentMeasure16th = 0;
        this.currentMeasurePattern = [];
        
        this.gameLoop();
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.startOverlay.style.display = 'flex';
        this.pauseBtn.style.display = 'none';
        this.stopTimer();
        cancelAnimationFrame(this.animationFrame);
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
    }
    
    togglePause() {
        if (!this.isPlaying) return;
        
        if (this.isPaused) {
            // Resume with countdown
            this.startCountdown(3, () => {
                this.isPaused = false;
                this.pauseBtn.textContent = '일시정지 (P)';
                this.audioContext.resume();
                this.startTimer();
                this.gameLoop(); // Restart loop
            });
        } else {
            // Pause
            this.isPaused = true;
            this.pauseBtn.textContent = '재개 (P)';
            this.audioContext.suspend();
            this.stopTimer();
            cancelAnimationFrame(this.animationFrame);
        }
    }

    startCountdown(seconds, callback) {
        // Create or reuse countdown overlay
        let overlay = document.getElementById('countdown-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'countdown-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.color = 'white';
            overlay.style.fontSize = '5rem';
            overlay.style.fontWeight = 'bold';
            overlay.style.zIndex = '100';
            this.gameArea.appendChild(overlay);
        }
        
        overlay.style.display = 'flex';
        overlay.textContent = seconds;
        
        const interval = setInterval(() => {
            seconds--;
            if (seconds > 0) {
                overlay.textContent = seconds;
            } else {
                clearInterval(interval);
                overlay.style.display = 'none';
                callback();
            }
        }, 1000);
    }
    
    startTimer() {
        this.stopTimer();
        this.timerInterval = setInterval(() => {
            this.elapsedTime++;
            this.updateTimerDisplay();
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    updateTimerDisplay() {
        const m = Math.floor(this.elapsedTime / 60).toString().padStart(2, '0');
        const s = (this.elapsedTime % 60).toString().padStart(2, '0');
        this.timerDisplay.textContent = `${m}:${s}`;
    }

    scheduleNotes() {
        // Schedule Game Notes (Visuals need longer lookahead)
        while (this.nextNoteTime < this.audioContext.currentTime + this.visualLookAhead) {
            this.spawnNote(this.nextNoteTime);
            this.advanceNoteTime();
        }
        
        // Schedule Beat Lines (Quarter notes)
        while (this.nextBeatLineTime < this.audioContext.currentTime + this.visualLookAhead) {
            this.spawnBeatLine(this.nextBeatLineTime);
            this.nextBeatLineTime += (60.0 / this.bpm); // Add one beat
        }
        
        // Schedule Metronome (Audio needs short lookahead)
        while (this.metronomeNextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.playMetronomeTick(this.metronomeNextNoteTime, this.metronomeCurrent16th);
            this.advanceMetronomeTime();
        }
    }

    advanceNoteTime() {
        const secondsPerBeat = 60.0 / this.bpm;
        let interval = 0;
        
        if (this.rhythmMode === '8') {
            interval = 0.5;
            this.currentMeasureBeat += interval;
            if (this.currentMeasureBeat >= 4) {
                this.handleMeasureBoundary();
                this.currentMeasureBeat = 0;
            }
        } else if (this.rhythmMode === '16') {
            interval = 0.25;
            this.currentMeasureBeat += interval;
            if (this.currentMeasureBeat >= 4) {
                this.handleMeasureBoundary();
                this.currentMeasureBeat = 0;
            }
        } else if (this.rhythmMode === 'mixed') {
            interval = Math.random() > 0.5 ? 0.5 : 0.25;
            this.currentMeasureBeat += interval;
            if (this.currentMeasureBeat >= 4) {
                this.handleMeasureBoundary();
                this.currentMeasureBeat = 0;
            }
        } else if (this.rhythmMode === 'permutations') {
            // Initialize if needed
            if (!this.permutationPattern) {
                this.pickPermutationPattern();
                this.permutationIndex = 0;
            }
            
            interval = this.permutationPattern[this.permutationIndex];
            this.permutationIndex++;
            
            // Check if pattern finished (1 beat completed)
            if (this.permutationIndex >= this.permutationPattern.length) {
                this.permutationIndex = 0;
                this.currentMeasureBeat++;
                
                // Check if measure finished (4 beats)
                if (this.currentMeasureBeat >= 4) {
                    this.handleMeasureBoundary();
                    this.currentMeasureBeat = 0;
                    // Only pick new pattern if we are still in permutations mode
                    if (this.rhythmMode === 'permutations') {
                        this.pickPermutationPattern();
                    }
                }
            }
            
        } else if (this.rhythmMode === 'binary') {
            // Binary Alphabet: 16th note grid.
            
            if (!this.currentBinaryBeatPattern || this.currentBinaryBeatPattern.length === 0) {
                this.generateBinaryPattern();
            }
            
            interval = 0.25; // Always 16th grid
            
            this.currentMeasure16th++;
            
            // Check if measure finished (16 steps = 4 beats * 4 steps)
            if (this.currentMeasure16th >= 16) {
                this.handleMeasureBoundary();
                this.currentMeasure16th = 0;
                // Only generate new pattern if we are still in binary mode
                if (this.rhythmMode === 'binary') {
                    this.generateBinaryPattern();
                }
            }
        }
        
        this.nextNoteTime += interval * secondsPerBeat;
    }

    handleMeasureBoundary() {
        if (this.nextRhythmMode) {
            this.rhythmMode = this.nextRhythmMode;
            this.nextRhythmMode = null;
            
            // Reset states for the new mode
            this.currentMeasureBeat = 0;
            this.currentMeasure16th = 0;
            this.permutationPattern = null;
            this.permutationIndex = 0;
            this.currentBinaryBeatPattern = [];
            
            // If switching TO permutations or binary, we need to init their patterns immediately
            // so the next loop has something to work with?
            // Actually, the next call to advanceNoteTime will see the new mode and init if needed.
            // But wait, advanceNoteTime is called AFTER spawnNote.
            // The next spawnNote needs to know if it should spawn (for binary).
            // spawnNote checks rhythmMode.
            // If we switch to binary, spawnNote needs currentBinaryBeatPattern.
            // So we should init it here.
            
            if (this.rhythmMode === 'permutations') {
                this.pickPermutationPattern();
            } else if (this.rhythmMode === 'binary') {
                this.generateBinaryPattern();
            }
        }
    }
    
    pickPermutationPattern() {
        const patterns = [
            [0.5, 0.5], // 8-8
            [0.25, 0.25, 0.25, 0.25], // 16-16-16-16
            [0.5, 0.25, 0.25], // 8-16-16
            [0.25, 0.25, 0.5], // 16-16-8
            [0.25, 0.5, 0.25]  // 16-8-16
        ];
        this.permutationPattern = patterns[Math.floor(Math.random() * patterns.length)];
    }
    
    generateBinaryPattern() {
        // Generate 4 steps (1 beat)
        this.currentBinaryBeatPattern = [];
        for (let i = 0; i < 4; i++) {
            this.currentBinaryBeatPattern.push(Math.random() > 0.5); // true = note, false = rest
        }
    }
    
    advanceMetronomeTime() {
        const secondsPer16th = (60.0 / this.bpm) / 4;
        this.metronomeNextNoteTime += secondsPer16th;
        this.metronomeCurrent16th++;
    }
    
    playMetronomeTick(time, beat16) {
        if (this.metronomeMode === '0') return;
        
        let shouldPlay = false;
        let isAccent = (beat16 % 16 === 0);
        let isQuarter = (beat16 % 4 === 0);
        
        if (this.metronomeMode === '4') {
            shouldPlay = isQuarter;
        } else if (this.metronomeMode === '8') {
            shouldPlay = (beat16 % 2 === 0);
        } else if (this.metronomeMode === '16') {
            shouldPlay = true;
        }
        
        if (shouldPlay) {
            const source = this.audioContext.createBufferSource();
            source.buffer = isAccent ? this.accentBuffer : this.tickBuffer;
            source.connect(this.audioContext.destination);
            source.start(time);
        }
    }

    spawnNote(time) {
        let shouldSpawn = true;
        
        // Check for Binary Mode Rests
        if (this.rhythmMode === 'binary') {
            if (this.currentBinaryBeatPattern && this.currentBinaryBeatPattern.length > 0) {
                // currentMeasure16th is the index of the NEXT note (because advanceNoteTime hasn't run for this step yet? No wait.)
                // In start(), currentMeasure16th = 0.
                // spawnNote is called.
                // Then advanceNoteTime is called.
                // So currentMeasure16th is the CURRENT index.
                
                // We want to repeat the 4-step pattern.
                // Index within pattern = currentMeasure16th % 4.
                let index = this.currentMeasure16th % 4;
                shouldSpawn = this.currentBinaryBeatPattern[index];
            } else {
                // Should have been initialized in start() or advanceNoteTime?
                // If start() didn't init, we do it here.
                this.generateBinaryPattern();
                this.currentMeasure16th = 0;
                shouldSpawn = this.currentBinaryBeatPattern[0];
            }
        }

        if (shouldSpawn) {
            const noteEl = document.createElement('div');
            noteEl.className = 'note';
            
            if (this.targetShape === 'bar') {
                noteEl.classList.add('bar-shape');
            }
            
            // Accent Logic (First Beat)
            const secondsPerBeat = 60.0 / this.bpm;
            const beatsElapsed = (time - this.startTime) / secondsPerBeat;
            const roundedBeats = Math.round(beatsElapsed * 4) / 4;
            
            if (this.highlightFirstBeat && Math.abs(roundedBeats % 4) < 0.01) {
                noteEl.classList.add('accent');
            }

            noteEl.style.left = '50%';
            this.gameArea.appendChild(noteEl);
            
            this.notes.push({
                el: noteEl,
                time: time,
                hit: false
            });
        }
    }
    
    spawnBeatLine(time) {
        const lineEl = document.createElement('div');
        lineEl.className = 'beat-line';
        this.gameArea.appendChild(lineEl);
        
        this.beatLines.push({
            el: lineEl,
            time: time
        });
    }

    gameLoop() {
        if (!this.isPlaying) return;

        this.scheduleNotes();
        this.updateNotes();
        
        if (this.inputMode === 'mic') {
            // Mic detection loop is separate
        }

        this.animationFrame = requestAnimationFrame(() => this.gameLoop());
    }

    updateNotes() {
        const currentTime = this.audioContext.currentTime;
        
        // Calculate Target Center Y based on shape
        // Circle: Bottom 30px, Height 60px -> Top 210px, Center 240px
        // Bar: Bottom 50px, Height 10px -> Top 240px, Center 245px
        const targetCenterY = this.targetShape === 'bar' ? 245 : 240;
        
        // Constant Speed Logic
        // We want the note to travel from Top (approx 0) to Target in fallDuration.
        // Let's define speed based on TargetCenterY and fallDuration.
        // Speed = TargetCenterY / fallDuration (pixels per second)
        // This assumes starting at CenterY = 0.
        const speed = targetCenterY / this.fallDuration;
        
        // Update Notes
        this.notes.forEach((note, index) => {
            if (note.hit) return;

            const timeUntilTarget = note.time - currentTime;
            
            // Calculate Current Center Y
            // Position = Target - (Speed * TimeRemaining)
            const currentCenterY = targetCenterY - (speed * timeUntilTarget);
            
            // Note Height is 40px (Circle) or 20px (Bar)
            // We need to set 'top'. Top = Center - HalfHeight.
            const halfHeight = note.el.classList.contains('bar-shape') ? 10 : 20;
            const top = currentCenterY - halfHeight;
            
            if (top < -50) { // Hide if too far up
                note.el.style.display = 'none';
            } else {
                note.el.style.display = 'block';
                note.el.style.top = `${top}px`;
            }

            // Miss detection
            if (timeUntilTarget < -0.2 && !note.hit) {
                this.showFeedback('놓침', 'miss');
                note.hit = true;
                note.el.classList.add('miss');
                this.score.miss++;
                this.updateScoreDisplay();
                setTimeout(() => note.el.remove(), 500);
            }
        });
        
        // Update Beat Lines
        this.beatLines.forEach(line => {
            const timeUntilTarget = line.time - currentTime;
            
            // Line Center Y should match Note Center Y logic
            const currentCenterY = targetCenterY - (speed * timeUntilTarget);
            
            // Line Height is 2px. HalfHeight = 1.
            const top = currentCenterY - 1;
            
            if (top < -50) {
                line.el.style.display = 'none';
            } else {
                line.el.style.display = 'block';
                line.el.style.top = `${top}px`;
            }
            
            if (timeUntilTarget < -0.5) {
                line.el.remove();
            }
        });
        
        this.notes = this.notes.filter(n => n.el.parentNode);
        this.beatLines = this.beatLines.filter(l => l.el.parentNode);
    }

    handleInputTrigger() {
        this.inputIndicator.classList.add('active');
        setTimeout(() => this.inputIndicator.classList.remove('active'), 100);
        
        const currentTime = this.audioContext.currentTime;
        
        // Find closest note
        let closestNote = null;
        let minDiff = Infinity;
        
        this.notes.forEach(note => {
            if (!note.hit) {
                const diff = Math.abs(note.time - currentTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestNote = note;
                }
            }
        });

        // Widened hit windows
        if (closestNote && minDiff < 0.3) { // 300ms window
            closestNote.hit = true;
            closestNote.el.classList.add('hit');
            
            if (minDiff < 0.07) { // 70ms for Perfect (was 50ms)
                this.showFeedback('완벽해요!', 'perfect');
                this.score.perfect++;
            } else if (minDiff < 0.2) { // 200ms for Good (was 150ms)
                this.showFeedback('좋아요', 'good');
                this.score.good++;
            } else {
                this.showFeedback('놓침', 'miss'); // Late/Early but hit
                this.score.miss++;
            }
            this.updateScoreDisplay();
            
            this.playClickSound();
        }
    }

    detectMicInput() {
        if (!this.isPlaying || this.inputMode !== 'mic') return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(dataArray);

        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const v = Math.abs(dataArray[i] - 128);
            if (v > max) max = v;
        }

        if (max > 50) {
            const now = Date.now();
            if (!this.lastMicTrigger || now - this.lastMicTrigger > 100) {
                this.handleInputTrigger();
                this.lastMicTrigger = now;
            }
        }

        if (this.isPlaying) {
            requestAnimationFrame(() => this.detectMicInput());
        }
    }

    showFeedback(text, type) {
        this.feedbackDisplay.textContent = text;
        this.feedbackDisplay.className = `feedback ${type}`;
        this.feedbackDisplay.style.opacity = '1';
        this.feedbackDisplay.style.transform = 'translate(-50%, -50%) scale(1.2)';
        
        setTimeout(() => {
            this.feedbackDisplay.style.opacity = '0';
            this.feedbackDisplay.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 300);
    }

    updateScoreDisplay() {
        this.scoreEls.perfect.textContent = this.score.perfect;
        this.scoreEls.good.textContent = this.score.good;
        this.scoreEls.miss.textContent = this.score.miss;
    }
    
    playClickSound() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.1);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const trainer = new RhythmTrainer();
});
