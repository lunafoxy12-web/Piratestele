/**
 * Audio Resampling and WAV Conversion Utilities for Zadarma PBX
 * 
 * Zadarma Cloud PBX strictly requires 16-bit PCM, Mono (1 channel), 8000 Hz (8kHz) WAV format.
 * Anything else results in: "Wrong WAV file format, supported format: 16 bit, mono, 8kHz."
 */

export interface WavMetadata {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
}

export function parseWavHeader(buffer: Buffer): WavMetadata | null {
  if (buffer.length < 44) return null;
  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') return null;

  let offset = 12;
  let numChannels = 1;
  let sampleRate = 24000;
  let bitsPerSample = 16;
  let dataOffset = 44;
  let dataLength = buffer.length - 44;

  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ') {
      // format = buffer.readUInt16LE(offset + 8);
      numChannels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      // byteRate = buffer.readUInt32LE(offset + 16);
      // blockAlign = buffer.readUInt16LE(offset + 20);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, buffer.length - dataOffset);
      break;
    }
    offset += 8 + chunkSize;
  }

  return { numChannels, sampleRate, bitsPerSample, dataOffset, dataLength };
}

/**
 * Converts any audio buffer (WAV or raw PCM 16-bit LE, typically 24kHz from Gemini TTS)
 * into standard 16-bit Mono 8000 Hz PCM WAV accepted by Zadarma Cloud PBX.
 */
export function convertTo8kMonoWav(inputBuffer: Buffer, defaultInputSampleRate = 24000): Buffer {
  let sampleRate = defaultInputSampleRate;
  let numChannels = 1;
  let bitsPerSample = 16;
  let pcmData: Buffer;

  const wavMeta = parseWavHeader(inputBuffer);
  if (wavMeta) {
    sampleRate = wavMeta.sampleRate;
    numChannels = wavMeta.numChannels;
    bitsPerSample = wavMeta.bitsPerSample;
    pcmData = inputBuffer.subarray(wavMeta.dataOffset, wavMeta.dataOffset + wavMeta.dataLength);
  } else {
    // Treat as raw 16-bit PCM at defaultInputSampleRate
    pcmData = inputBuffer;
  }

  // Convert PCM buffer to Float32 samples (-1.0 to 1.0)
  const bytesPerSample = bitsPerSample === 16 ? 2 : bitsPerSample === 8 ? 1 : 2;
  const totalSamples = Math.floor(pcmData.length / (bytesPerSample * numChannels));
  const monoSamples = new Float32Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    let sum = 0;
    for (let c = 0; c < numChannels; c++) {
      const idx = (i * numChannels + c) * bytesPerSample;
      if (idx + bytesPerSample <= pcmData.length) {
        if (bitsPerSample === 16) {
          sum += pcmData.readInt16LE(idx) / 32768;
        } else if (bitsPerSample === 8) {
          sum += (pcmData.readUInt8(idx) - 128) / 128;
        }
      }
    }
    monoSamples[i] = sum / numChannels;
  }

  // Resample from `sampleRate` to 8000 Hz using linear interpolation
  const targetRate = 8000;
  const targetLength = Math.round((totalSamples * targetRate) / sampleRate);
  const resampled16Bit = Buffer.alloc(targetLength * 2);

  const ratio = (totalSamples - 1) / Math.max(1, targetLength - 1);
  for (let i = 0; i < targetLength; i++) {
    const origPos = i * ratio;
    const indexLow = Math.floor(origPos);
    const indexHigh = Math.min(indexLow + 1, totalSamples - 1);
    const frac = origPos - indexLow;

    const sample = (1 - frac) * monoSamples[indexLow] + frac * monoSamples[indexHigh];
    // Clamp to -1.0 .. 1.0 and scale to 16-bit signed integer
    const clamped = Math.max(-1, Math.min(1, sample));
    const int16 = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    resampled16Bit.writeInt16LE(int16, i * 2);
  }

  // Construct strict standard 44-byte RIFF WAV Header
  const wavHeader = Buffer.alloc(44);
  const subchunk2Size = resampled16Bit.length;
  const chunkSize = 36 + subchunk2Size;

  // RIFF Chunk Descriptor
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(chunkSize, 4);
  wavHeader.write('WAVE', 8);

  // "fmt " sub-chunk
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // Subchunk1Size = 16 for PCM
  wavHeader.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  wavHeader.writeUInt16LE(1, 22); // NumChannels = 1 (Mono)
  wavHeader.writeUInt32LE(8000, 24); // SampleRate = 8000 Hz
  wavHeader.writeUInt32LE(8000 * 1 * 2, 28); // ByteRate = 16000
  wavHeader.writeUInt16LE(2, 32); // BlockAlign = 2 (1 channel * 2 bytes/sample)
  wavHeader.writeUInt16LE(16, 34); // BitsPerSample = 16

  // "data" sub-chunk
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(subchunk2Size, 40);

  return Buffer.concat([wavHeader, resampled16Bit]);
}
