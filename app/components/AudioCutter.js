"use client"
// components/AudioCutter.js
import { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { saveAs } from 'file-saver';

export default function AudioCutter() {
  const [audioFile, setAudioFile] = useState(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [cutBlob, setCutBlob] = useState(null);
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);

  useEffect(() => {
    if (waveformRef.current && !wavesurfer.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'violet',
        progressColor: 'purple',
      });
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    wavesurfer.current.load(url);
  };

  const handleCutAudio = () => {
    if (!audioFile) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const arrayBuffer = e.target.result;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const startSample = Math.floor(startTime * audioBuffer.sampleRate);
      const endSample = Math.floor(endTime * audioBuffer.sampleRate);
      const duration = endSample - startSample;

      const numberOfChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;

      const offlineAudioContext = new OfflineAudioContext(
        numberOfChannels,
        duration,
        sampleRate
      );

      const newBuffer = offlineAudioContext.createBuffer(
        numberOfChannels,
        duration,
        sampleRate
      );

      for (let i = 0; i < numberOfChannels; i++) {
        const channelData = audioBuffer.getChannelData(i).slice(startSample, endSample);
        newBuffer.copyToChannel(channelData, i, 0);
      }

      const source = offlineAudioContext.createBufferSource();
      source.buffer = newBuffer;
      source.connect(offlineAudioContext.destination);
      source.start(0);

      const renderedBuffer = await offlineAudioContext.startRendering();

      // Convert the rendered buffer to a WAV file
      const wavBlob = bufferToWave(renderedBuffer, duration);
      setCutBlob(wavBlob);
    };
    reader.readAsArrayBuffer(audioFile);
  };

  const bufferToWave = (abuffer, len) => {
    const numOfChan = abuffer.numberOfChannels;
    const length = len * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this demo)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for (let i = 0; i < abuffer.numberOfChannels; i++) {
      channels.push(abuffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) { // interleave channels
        const sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true); // convert to PCM and write to view
        pos += 2;
      }
      offset++; // next source sample
    }

    // utility functions
    function setUint16(data) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data) {
      view.setUint32(pos, data, true);
      pos += 4;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  return (
    <div className="p-4 max-w-md mx-auto text-black">
      <h1 className="text-2xl font-bold mb-4">Audio Cutter</h1>
      <input
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="mb-4"
      />
      <div ref={waveformRef} className="mb-4"></div>
      <div className="mb-4">
        <label className="block mb-1">Start Time (seconds)</label>
        <input
          type="number"
          value={startTime}
          onChange={(e) => setStartTime(Number(e.target.value))}
          className="w-full px-2 py-1 border rounded"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1">End Time (seconds)</label>
        <input
          type="number"
          value={endTime}
          onChange={(e) => setEndTime(Number(e.target.value))}
          className="w-full px-2 py-1 border rounded"
        />
      </div>
      <button
        onClick={handleCutAudio}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mb-4"
      >
        Cut Audio
      </button>
      {cutBlob && (
        <button
          onClick={() => saveAs(cutBlob, 'cut-audio.wav')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Download Cut Audio
        </button>
      )}
    </div>
  );
}
