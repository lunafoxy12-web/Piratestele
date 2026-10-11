// Web Audio Queue Tune & Hold Music Synthesizer
// Provides soothing, royalty-free musical presets and audio player that work 100% in all browsers

export interface QueueTunePreset {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultGreeting: string;
}

export const QUEUE_TUNE_PRESETS: QueueTunePreset[] = [
  {
    id: 'classical',
    name: 'Gentle Mozart Chime',
    description: 'Graceful harmonic chord progression with soft acoustic chime bells',
    category: 'Classical & Relaxing',
    defaultGreeting: 'All representative agents are currently assisting other callers. Please hold, your call is in queue and will be answered shortly.',
  },
  {
    id: 'lounge',
    name: 'Ambient Velvet Lounge',
    description: 'Warm soothing harmonic pad with gentle acoustic resonance',
    category: 'Corporate & Modern',
    defaultGreeting: 'Thank you for holding. We value your business. The next available agent of this team will connect with you momentarily.',
  },
  {
    id: 'acoustic',
    name: 'Acoustic Guitar Breeze',
    description: 'Warm fingerpicking melody chords with natural acoustic tone',
    category: 'Acoustic & Warm',
    defaultGreeting: 'Please remain on the line. You are in queue and our representative will be with you right away.',
  },
  {
    id: 'chime',
    name: 'Celestial Meditation Bell',
    description: 'Peaceful singing bowl and gentle harmonic bell cycles',
    category: 'Zen & Calming',
    defaultGreeting: 'Your call is priority to us. Please hold while we transfer you to an available agent.',
  },
  {
    id: 'modern_synth',
    name: 'Modern Lo-Fi Groove',
    description: 'Uplifting contemporary lo-fi chill chord progression with soft warmth',
    category: 'Upbeat & Tech',
    defaultGreeting: 'All agents are currently on another line. Please hold on, you are next in line.',
  },
  {
    id: 'custom',
    name: 'Custom Audio Stream / URL',
    description: 'Use a custom MP3, WAV or carrier audio stream URL set by manager',
    category: 'Custom Audio',
    defaultGreeting: 'Please hold for the next available representative.',
  },
];

export class QueueTunePlayer {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private intervalId: NodeJS.Timeout | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private volume = 0.5;

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }

  public play(presetId: string = 'classical', customUrl?: string): void {
    this.stop();
    this.isPlaying = true;

    // If custom audio URL provided and selected
    if (presetId === 'custom' && customUrl && customUrl.startsWith('http')) {
      try {
        this.audioElement = new Audio(customUrl);
        this.audioElement.loop = true;
        this.audioElement.volume = this.volume;
        this.audioElement.play().catch((e) => {
          console.warn('Audio URL playback blocked or failed, falling back to synth:', e);
          this.playSynthesizedPreset('classical');
        });
        return;
      } catch (err) {
        console.warn('Custom audio playback error:', err);
      }
    }

    this.playSynthesizedPreset(presetId);
  }

  private playSynthesizedPreset(presetId: string): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      let step = 0;
      const bpm = presetId === 'lounge' ? 68 : presetId === 'modern_synth' ? 84 : 76;
      const stepMs = Math.round((60000 / bpm) / 2); // Eighth note

      // Presets note tables in Hz
      const noteMap: Record<string, number> = {
        C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
        C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
        C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
      };

      const classicalMelody = [
        ['C4', 'E4', 'G4'], ['G4'], ['E4'], ['C5'],
        ['G4', 'B4', 'D5'], ['D5'], ['B4'], ['G4'],
        ['A3', 'C4', 'E4'], ['E4'], ['C5'], ['A4'],
        ['F3', 'A3', 'C4'], ['C4'], ['A4'], ['F4'],
        ['G3', 'B3', 'D4'], ['D4'], ['B4'], ['G4'],
        ['C4', 'E4', 'G4'], ['G4'], ['E4'], ['C4'],
      ];

      const loungeMelody = [
        ['F3', 'A3', 'C4', 'E4'], ['C4'], ['E4'], ['A4'],
        ['D3', 'F3', 'A3', 'C4'], ['A3'], ['C4'], ['F4'],
        ['G3', 'B3', 'D4', 'F4'], ['D4'], ['F4'], ['B4'],
        ['C3', 'E3', 'G3', 'B3'], ['G3'], ['B3'], ['E4'],
      ];

      const acousticMelody = [
        ['D3', 'A3', 'D4'], ['F4'], ['A4'], ['D5'],
        ['G3', 'B3', 'D4'], ['G4'], ['B4'], ['D5'],
        ['A3', 'C4', 'E4'], ['A4'], ['C5'], ['E5'],
        ['D3', 'A3', 'F4'], ['D4'], ['A4'], ['F4'],
      ];

      const chimeMelody = [
        ['E4', 'B4', 'E5'], ['G5'], ['B5'], ['E5'],
        ['D4', 'A4', 'D5'], ['F5'], ['A5'], ['D5'],
        ['C4', 'G4', 'C5'], ['E5'], ['G5'], ['C5'],
        ['B3', 'F4', 'B4'], ['D5'], ['F5'], ['B4'],
      ];

      const modernMelody = [
        ['C3', 'G3', 'D4', 'G4'], ['D4'], ['E4'], ['B4'],
        ['A2', 'E3', 'C4', 'E4'], ['C4'], ['D4'], ['A4'],
        ['F2', 'C3', 'A3', 'C4'], ['A3'], ['C4'], ['G4'],
        ['G2', 'D3', 'B3', 'D4'], ['B3'], ['D4'], ['F4'],
      ];

      let selectedPattern = classicalMelody;
      if (presetId === 'lounge') selectedPattern = loungeMelody;
      else if (presetId === 'acoustic') selectedPattern = acousticMelody;
      else if (presetId === 'chime') selectedPattern = chimeMelody;
      else if (presetId === 'modern_synth') selectedPattern = modernMelody;

      const playChordStep = () => {
        if (!this.isPlaying || !this.audioCtx) return;
        const currentChord = selectedPattern[step % selectedPattern.length];
        step++;

        const now = this.audioCtx.currentTime;

        // Play each note in the chord
        currentChord.forEach((noteStr, idx) => {
          const freq = noteMap[noteStr];
          if (!freq || !this.audioCtx) return;

          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          const filter = this.audioCtx.createBiquadFilter();

          // Tone shaping depending on preset
          if (presetId === 'chime') {
            osc.type = 'sine';
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq * 1.5, now);
            filter.Q.value = 4.0;
          } else if (presetId === 'acoustic') {
            osc.type = 'triangle';
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, now);
          } else if (presetId === 'modern_synth') {
            osc.type = 'sawtooth';
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(900, now);
            filter.frequency.exponentialRampToValueAtTime(350, now + 0.4);
          } else {
            // Classical / Lounge: warm gentle bell pad
            osc.type = 'sine';
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1800, now);
          }

          // Envelope
          const noteVol = (this.volume * 0.12) / Math.max(1, currentChord.length);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(noteVol, now + 0.04 + idx * 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + (presetId === 'chime' ? 1.4 : 0.8));

          osc.frequency.setValueAtTime(freq, now);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(now + idx * 0.02);
          osc.stop(now + (presetId === 'chime' ? 1.4 : 0.85));
        });
      };

      // Play first step immediately
      playChordStep();
      this.intervalId = setInterval(playChordStep, stepMs);
    } catch (err) {
      console.warn('Queue synthesizer error:', err);
    }
  }

  public stop(): void {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {}
      this.audioElement = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}

// Global preview instance for quick previews in UI
let globalPreviewPlayer: QueueTunePlayer | null = null;

export const previewQueueTune = (presetId: string, customUrl?: string, durationSeconds = 12): () => void => {
  if (globalPreviewPlayer) {
    globalPreviewPlayer.stop();
  }
  globalPreviewPlayer = new QueueTunePlayer();
  globalPreviewPlayer.setVolume(0.45);
  globalPreviewPlayer.play(presetId, customUrl);

  const timer = setTimeout(() => {
    if (globalPreviewPlayer) {
      globalPreviewPlayer.stop();
      globalPreviewPlayer = null;
    }
  }, durationSeconds * 1000);

  return () => {
    clearTimeout(timer);
    if (globalPreviewPlayer) {
      globalPreviewPlayer.stop();
      globalPreviewPlayer = null;
    }
  };
};
