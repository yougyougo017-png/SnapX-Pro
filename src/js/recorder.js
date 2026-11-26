import {
  openModal,
  toast,
  escapeHtml,
  setBusy,
  formatBytes,
  confirmDialog,
  downloadDataUrl,
  acceleratorLabel
} from './ui.js';
import { icon } from './icons.js';
import { state } from './state.js';
import { GIFEncoder, quantize, applyPalette } from '../vendor/gifenc.esm.js';

function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function supportedMime() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  return candidates.find((mime) => window.MediaRecorder?.isTypeSupported(mime)) || 'video/webm';
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read recording'));
    reader.readAsDataURL(blob);
  });
}

export async function openRecorder(ctx, initialMode = 'video') {
  let displays = [];
  try {
    displays = await window.snapx.capture.displays();
  } catch {
    displays = [];
  }
  if (!displays.length) {
    toast('No displays available for recording', { type: 'error' });
    return;
  }

  let mode = initialMode === 'gif' ? 'gif' : 'video';
  let stream = null;
  let recorder = null;
  let chunks = [];
  let gifFrames = [];
  let gifTimer = null;
  let timer = null;
  let startedAt = 0;
  let recording = false;
  let finishing = false;
  let gifCanvas = null;
  let gifContext = null;
  let frameDelay = 0;
  let sourceWidth = 0;
  let sourceHeight = 0;
  let savedResult = null;

  const modal = openModal({
    title: initialMode === 'gif' ? 'Record a GIF' : 'Record your screen',
    subtitle: 'Crisp, local-first recording. Nothing leaves your device.',
    size: 'lg',
    className: 'recorder-modal',
    dismissible: true,
    content: `
      <div class="recorder-layout">
        <div class="recorder-stage">
          <video class="recorder-video" autoplay muted playsinline></video>
          <div class="recorder-placeholder" data-recorder-placeholder>
            <div class="recorder-placeholder-orb">${icon('video', 26)}</div>
            <b>Ready when you are</b>
            <span>Choose a display, then start recording.</span>
            <div class="recorder-shortcuts"><span><kbd>${acceleratorLabel(state.settings?.shortcuts?.toolbar || 'CommandOrControl+Shift+4')}</kbd> toolbar</span><span><kbd>Esc</kbd> stop</span></div>
          </div>
          <div class="recorder-live" data-recorder-live hidden>
            <span class="rec-dot"></span>
            <b data-recorder-timer>00:00.0</b>
            <span data-recorder-res>—</span>
          </div>
          <div class="recorder-frame"></div>
        </div>
        <aside class="recorder-side">
          <div class="segmented recorder-mode-switch" data-recorder-mode>
            <button type="button" data-mode="video" class="${mode === 'video' ? 'active' : ''}">${icon('video', 13)} Video</button>
            <button type="button" data-mode="gif" class="${mode === 'gif' ? 'active' : ''}">${icon('gif', 13)} GIF</button>
          </div>
          <div class="field">
            <label class="field-label">Display</label>
            <select class="select" data-recorder-display>
              ${displays.map((display) => `<option value="${display.id}" ${display.primary ? 'selected' : ''}>${escapeHtml(display.label || 'Display')} · ${display.size.width} × ${display.size.height}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label">Frame rate</label>
            <select class="select" data-recorder-fps>
              <option value="30">30 fps · Smooth</option>
              <option value="60" selected>60 fps · Ultra smooth</option>
              <option value="24">24 fps · Cinematic</option>
            </select>
          </div>
          <div class="recorder-summary">
            <div><span>Format</span><b data-recorder-format>WebM · VP9</b></div>
            <div><span>Audio</span><b>System audio off</b></div>
            <div><span>Quality</span><b>High · local</b></div>
          </div>
          <div class="recorder-actions">
            <button class="btn btn-primary btn-lg btn-block" data-recorder-start type="button">${icon('record', 16)} Start recording</button>
            <button class="btn btn-danger btn-lg btn-block" data-recorder-stop type="button" hidden>${icon('stop', 15)} Stop &amp; save</button>
            <button class="btn btn-secondary btn-block" data-recorder-cancel type="button">Cancel</button>
          </div>
          <div class="recorder-note">${icon('lock', 12)} Recordings are written directly to your Videos folder.</div>
        </aside>
      </div>
    `,
    onClose: async () => {
      if (recording) {
        stopRecording(false);
        cleanupStream();
      }
    }
  });

  const videoEl = modal.modal.querySelector('.recorder-video');
  const placeholder = modal.modal.querySelector('[data-recorder-placeholder]');
  const live = modal.modal.querySelector('[data-recorder-live]');
  const timerEl = modal.modal.querySelector('[data-recorder-timer]');
  const resEl = modal.modal.querySelector('[data-recorder-res]');
  const startBtn = modal.modal.querySelector('[data-recorder-start]');
  const stopBtn = modal.modal.querySelector('[data-recorder-stop]');
  const cancelBtn = modal.modal.querySelector('[data-recorder-cancel]');
  const formatEl = modal.modal.querySelector('[data-recorder-format]');
  const displaySelect = modal.modal.querySelector('[data-recorder-display]');
  const fpsSelect = modal.modal.querySelector('[data-recorder-fps]');
  const modeSwitch = modal.modal.querySelector('[data-recorder-mode]');

  function setMode(next) {
    if (recording) return;
    mode = next;
    modal.modal.querySelectorAll('[data-recorder-mode] button').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    formatEl.textContent = mode === 'gif' ? 'Animated GIF' : 'WebM · VP9';
    fpsSelect.parentElement.hidden = false;
    startBtn.innerHTML = `${icon(mode === 'gif' ? 'gif' : 'record', 16)} Start ${mode === 'gif' ? 'GIF' : 'recording'}`;
    modal.modal.querySelector('.modal-title').textContent = mode === 'gif' ? 'Record a GIF' : 'Record your screen';
  }

  modeSwitch.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (button) setMode(button.dataset.mode);
  });

  function cleanupStream() {
    if (gifTimer) clearInterval(gifTimer);
    gifTimer = null;
    if (timer) clearInterval(timer);
    timer = null;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    videoEl.srcObject = null;
  }

  function startTimer() {
    startedAt = performance.now();
    timer = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      timerEl.textContent = formatDuration(elapsed);
      if (mode === 'gif' && elapsed > 15000) {
        stopRecording(true);
      }
    }, 100);
  }

  async function captureGifFrame() {
    if (!gifCanvas || !videoEl.videoWidth) return;
    const elapsed = performance.now() - startedAt;
    if (elapsed > 15000) return;
    gifContext.drawImage(videoEl, 0, 0, gifCanvas.width, gifCanvas.height);
    const frame = gifContext.getImageData(0, 0, gifCanvas.width, gifCanvas.height);
    gifFrames.push(frame);
  }

  async function startRecording() {
    if (recording) return;
    const displayId = displaySelect.value;
    const fps = Math.max(10, Math.min(60, Number(fpsSelect.value) || 30));
    try {
      await window.snapx.recordings.setSource(Number(displayId));
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: fps },
        audio: false
      });
      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});
      const settings = stream.getVideoTracks()[0]?.getSettings() || {};
      sourceWidth = settings.width || videoEl.videoWidth || 1920;
      sourceHeight = settings.height || videoEl.videoHeight || 1080;
      resEl.textContent = `${sourceWidth} × ${sourceHeight}`;
      placeholder.hidden = true;
      live.hidden = false;
      recording = true;
      chunks = [];
      gifFrames = [];

      if (mode === 'video') {
        const mimeType = supportedMime();
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 9_000_000 });
        recorder.ondataavailable = (event) => {
          if (event.data?.size) chunks.push(event.data);
        };
        recorder.start(250);
        formatEl.textContent = 'WebM · VP9';
      } else {
        const maxWidth = 760;
        const ratio = Math.min(1, maxWidth / Math.max(1, sourceWidth));
        gifCanvas = document.createElement('canvas');
        gifCanvas.width = Math.max(2, Math.round(sourceWidth * ratio));
        gifCanvas.height = Math.max(2, Math.round(sourceHeight * ratio));
        gifContext = gifCanvas.getContext('2d', { willReadFrequently: true });
        frameDelay = Math.round(1000 / Math.min(10, Math.max(5, fps)));
        gifTimer = setInterval(captureGifFrame, frameDelay);
        formatEl.textContent = `GIF · ${gifCanvas.width} × ${gifCanvas.height}`;
      }

      startBtn.hidden = true;
      stopBtn.hidden = false;
      cancelBtn.hidden = true;
      displaySelect.disabled = true;
      fpsSelect.disabled = true;
      modeSwitch.classList.add('disabled');
      startTimer();
      toast(mode === 'gif' ? 'GIF recording started' : 'Screen recording started', { type: 'info' });
    } catch (error) {
      cleanupStream();
      toast(error.message || 'Could not start recording', { type: 'error', detail: 'Screen recording permission may be required.' });
    }
  }

  async function stopRecording(save = true) {
    if (!recording || finishing) return;
    finishing = true;
    recording = false;
    const elapsed = performance.now() - startedAt;
    if (timer) clearInterval(timer);
    timer = null;
    if (gifTimer) clearInterval(gifTimer);
    gifTimer = null;

    try {
      if (mode === 'gif') {
        if (!save) {
          toast('GIF recording discarded');
          return;
        }
        if (gifFrames.length < 2) {
          toast('GIF was too short', { type: 'error' });
          return;
        }
        stopBtn.disabled = true;
        stopBtn.innerHTML = `<span class="spinner"></span> Encoding GIF…`;
        await new Promise((resolve) => setTimeout(resolve, 50));
        const encoder = new GIFEncoder();
        for (let i = 0; i < gifFrames.length; i += 1) {
          const frame = gifFrames[i];
          const palette = quantize(frame.data, 128, { format: 'rgb565' });
          const index = applyPalette(frame.data, palette, 'rgb565');
          encoder.writeFrame(index, frame.width, frame.height, {
            palette,
            delay: frameDelay,
            repeat: 0,
            dispose: 1
          });
          if (i % 6 === 0) {
            stopBtn.innerHTML = `<span class="spinner"></span> Encoding ${Math.round(((i + 1) / gifFrames.length) * 100)}%`;
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        encoder.finish();
        const blob = new Blob([encoder.bytes()], { type: 'image/gif' });
        const dataUrl = await blobToDataUrl(blob);
        const response = await window.snapx.recordings.save({
          dataUrl,
          extension: 'gif',
          title: `GIF · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        });
        savedResult = response;
        await ctx.refreshGallery?.();
        showSavedResult(modal, response, dataUrl, elapsed, 'GIF');
        toast('GIF saved to library', { type: 'success', detail: formatBytes(blob.size) });
      } else {
        await new Promise((resolve) => {
          if (!recorder || recorder.state === 'inactive') {
            resolve();
            return;
          }
          recorder.onstop = resolve;
          recorder.stop();
        });
        if (!save) {
          toast('Recording discarded');
          return;
        }
        stopBtn.disabled = true;
        stopBtn.innerHTML = `<span class="spinner"></span> Saving recording…`;
        const blob = new Blob(chunks, { type: recorder?.mimeType || 'video/webm' });
        if (!blob.size) throw new Error('The recording was empty.');
        const dataUrl = await blobToDataUrl(blob);
        const response = await window.snapx.recordings.save({
          dataUrl,
          extension: 'webm',
          title: `Screen recording · ${new Date().toLocaleDateString()}`
        });
        savedResult = response;
        showSavedResult(modal, response, dataUrl, elapsed, 'video', blob.size);
        toast('Recording saved', { type: 'success', detail: response.filePath || '' });
      }
    } catch (error) {
      toast(error.message || 'Could not save recording', { type: 'error' });
      stopBtn.disabled = false;
      stopBtn.innerHTML = `${icon('stop', 15)} Stop & save`;
    } finally {
      finishing = false;
      cleanupStream();
      live.hidden = true;
      stopBtn.hidden = true;
      startBtn.hidden = false;
      startBtn.disabled = false;
      startBtn.innerHTML = `${icon(mode === 'gif' ? 'gif' : 'record', 16)} Start ${mode === 'gif' ? 'GIF' : 'recording'}`;
      displaySelect.disabled = false;
      fpsSelect.disabled = false;
      modeSwitch.classList.remove('disabled');
      if (!savedResult) {
        placeholder.hidden = false;
        cancelBtn.hidden = false;
      }
    }
  }

  function showSavedResult(modalEntry, response, dataUrl, elapsed, kind, bytes = 0) {
    const isGif = kind === 'GIF';
    const body = modalEntry.modal.querySelector('.modal-body');
    modalEntry.modal.querySelector('.modal-title').textContent = isGif ? 'GIF ready' : 'Recording saved';
    modalEntry.modal.querySelector('.modal-sub').textContent = `${formatDuration(elapsed).slice(0, 5)} · ${isGif ? 'Animated GIF' : 'WebM video'}${bytes ? ` · ${formatBytes(bytes)}` : ''}`;
    body.innerHTML = `
      <div class="recording-result">
        <div class="recording-result-preview">
          ${dataUrl ? (isGif ? `<img src="${dataUrl}" alt="GIF recording">` : `<video src="${dataUrl}" autoplay loop muted playsinline></video>`) : `<div class="video-file-icon">${icon('video', 30)}<span>WEBM</span></div>`}
          <span class="recording-result-badge">${icon(isGif ? 'gif' : 'video', 12)} ${isGif ? 'GIF' : 'Video'}</span>
        </div>
        <div class="recording-result-copy">
          <h3>${isGif ? 'Your GIF is ready to share' : 'Your recording is safe'}</h3>
          <p>${isGif ? 'The GIF was added to your SnapX library. Open it in the editor, copy it, or share it anywhere.' : 'SnapX wrote the WebM file straight to your Videos folder. No cloud upload, no waiting.'}</p>
          <div class="recording-result-meta">
            <span><b>Duration</b>${formatDuration(elapsed).slice(0, 5)}</span>
            <span><b>Storage</b>${isGif ? 'Library' : 'Videos folder'}</span>
            <span><b>Privacy</b>Local only</span>
          </div>
        </div>
      </div>
      <div class="modal-inline-actions">
        ${isGif ? `<button class="btn btn-primary" data-recorder-copy type="button">${icon('copy', 14)} Copy GIF</button>` : ''}
        <button class="btn btn-secondary" data-recorder-reveal type="button">${icon('folderOpen', 14)} ${isGif ? 'Show in library' : 'Show file'}</button>
        ${dataUrl ? `<button class="btn btn-secondary" data-recorder-download type="button">${icon('download', 14)} Download</button>` : ''}
        <button class="btn btn-ghost" data-recorder-done type="button">Done</button>
      </div>
    `;
    modalEntry.modal.querySelector('.recorder-actions')?.remove();
    modalEntry.modal.querySelector('.recorder-note')?.remove();
    modalEntry.modal.querySelector('.recorder-side')?.remove();
    modalEntry.modal.querySelector('.recorder-stage')?.remove();
    body.classList.add('recording-done');
    body.querySelector('[data-recorder-done]')?.addEventListener('click', () => modalEntry.close());
    body.querySelector('[data-recorder-reveal]')?.addEventListener('click', async () => {
      if (isGif) {
        modalEntry.close();
        ctx.navigate('gallery', { highlight: response.item?.id });
      } else if (response.filePath) {
        await window.snapx.app.showItemInFolder(response.filePath);
      }
    });
    if (isGif && dataUrl) {
      body.querySelector('[data-recorder-copy]')?.addEventListener('click', async () => {
        try {
          await window.snapx.clipboard.image(dataUrl);
          toast('GIF copied to clipboard', { type: 'success' });
        } catch {
          toast('Clipboard does not support animated GIFs', { type: 'error' });
        }
      });
    }
    if (dataUrl) {
      body.querySelector('[data-recorder-download]')?.addEventListener('click', () => {
        downloadDataUrl(dataUrl, isGif ? 'snapx-recording.gif' : 'snapx-recording.webm');
      });
    }
  }

  startBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', () => stopRecording(true));
  cancelBtn.addEventListener('click', async () => {
    if (recording) {
      const yes = await confirmDialog({ title: 'Stop recording?', message: 'The current recording will be discarded.', confirmLabel: 'Discard', danger: true });
      if (yes) {
        await stopRecording(false);
        modal.close();
      }
    } else {
      modal.close();
    }
  });

  const keyHandler = (event) => {
    if (event.key === 'Escape' && recording) {
      event.preventDefault();
      stopRecording(true);
    }
  };
  document.addEventListener('keydown', keyHandler);
  modal.onClose = () => {
    document.removeEventListener('keydown', keyHandler);
    cleanupStream();
  };
}
