/**
 * Converts an AudioBuffer to a WAV Blob.
 * @param buffer The AudioBuffer to convert.
 * @returns A Blob representing the WAV file.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  // Only handle mono for now
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);

  // RIFF chunk descriptor
  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  let offset = 0;

  // RIFF identifier
  writeString(view, offset, 'RIFF'); offset += 4;
  // RIFF chunk length
  view.setUint32(offset, 36 + buffer.length * numOfChan * 2, true); offset += 4;
  // RIFF type
  writeString(view, offset, 'WAVE'); offset += 4;

  // Format chunk identifier
  writeString(view, offset, 'fmt '); offset += 4;
  // Format chunk length
  view.setUint32(offset, 16, true); offset += 4;
  // Sample format (raw)
  view.setUint16(offset, 1, true); offset += 2;
  // Number of channels
  view.setUint16(offset, numOfChan, true); offset += 2;
  // Sample rate
  view.setUint32(offset, buffer.sampleRate, true); offset += 4;
  // Byte rate (SampleRate * NumberOfChannels * BitsPerSample/8)
  view.setUint32(offset, buffer.sampleRate * numOfChan * 2, true); offset += 4;
  // Block align (NumberOfChannels * BitsPerSample/8)
  view.setUint16(offset, numOfChan * 2, true); offset += 2;
  // Bits per sample
  view.setUint16(offset, 16, true); offset += 2;

  // Data chunk identifier
  writeString(view, offset, 'data'); offset += 4;
  // Data chunk length
  view.setUint32(offset, buffer.length * numOfChan * 2, true); offset += 4;

  // Write interleaved PCM samples
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numOfChan; channel++) {
      let sample = buffer.getChannelData(channel)[i];
      // Clamp samples to -1..1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
} 