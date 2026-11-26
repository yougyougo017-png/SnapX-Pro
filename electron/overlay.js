(() => {
  const $ = (selector) => document.querySelector(selector);
  const shotEl = $('#shot');
  const shadeEl = $('#shade');
  const selectionEl = $('#selection');
  const dimsEl = $('#dims');
  const crosshairEl = $('#crosshair');
  const crosshairLabel = $('#crosshairLabel');
  const lensEl = $('#lens');
  const lassoLayer = $('#lassoLayer');
  const lassoPath = $('#lassoPath');
  const maskPath = $('#maskPath');
  const captureBtn = $('#captureBtn');
  const cancelBtn = $('#cancelBtn');
  const modeTitle = $('#modeTitle');
  const monitorLabel = $('#monitorLabel');
  const hintText = $('#hintText');
  const toastEl = $('#toast');

  const state = {
    mode: 'rect',
    imageWidth: 0,
    imageHeight: 0,
    start: null,
    dragging: false,
    rect: null,
    lassoPoints: [],
    lassoBounds: null,
    ready: false,
    mouseX: 0,
    mouseY: 0
  };

  let toastTimer = null;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }

  function viewportScale() {
    return {
      x: state.imageWidth / Math.max(1, window.innerWidth),
      y: state.imageHeight / Math.max(1, window.innerHeight)
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pointerPosition(event) {
    return {
      x: clamp(event.clientX, 0, window.innerWidth),
      y: clamp(event.clientY, 0, window.innerHeight)
    };
  }

  function updateCrosshair(x, y) {
    crosshairEl.querySelector('.line.v').style.left = `${x}px`;
    crosshairEl.querySelector('.line.h').style.top = `${y}px`;
    const scale = viewportScale();
    crosshairLabel.textContent = `${Math.round(x * scale.x)}, ${Math.round(y * scale.y)}`;
    crosshairLabel.style.left = `${x}px`;
    crosshairLabel.style.top = `${y}px`;
    if (x > window.innerWidth - 100) crosshairLabel.style.transform = 'translate(calc(-100% - 14px), 14px)';
    else crosshairLabel.style.transform = 'translate(14px, 14px)';
  }

  function updateLens(x, y) {
    if (state.dragging || state.ready) {
      lensEl.classList.remove('visible');
      return;
    }
    const zoom = 8;
    const lensSize = 158;
    const margin = 28;
    let lensX = x + margin;
    let lensY = y + margin;
    if (lensX + lensSize > window.innerWidth - 12) lensX = x - lensSize - margin;
    if (lensY + lensSize > window.innerHeight - 12) lensY = y - lensSize - margin;
    lensEl.style.left = `${clamp(lensX, 12, window.innerWidth - lensSize - 12)}px`;
    lensEl.style.top = `${clamp(lensY, 12, window.innerHeight - lensSize - 12)}px`;
    lensEl.style.backgroundSize = `${window.innerWidth * zoom}px ${window.innerHeight * zoom}px`;
    lensEl.style.backgroundPosition = `${-(x * zoom - lensSize / 2)}px ${-(y * zoom - lensSize / 2)}px`;
    lensEl.classList.add('visible');
  }

  function updateRectFromPoints(start, end, constrain) {
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    if (constrain) {
      const size = Math.max(Math.abs(dx), Math.abs(dy));
      dx = Math.sign(dx || 1) * size;
      dy = Math.sign(dy || 1) * size;
    }
    let left = start.x;
    let top = start.y;
    let width = dx;
    let height = dy;
    if (width < 0) {
      left = start.x + width;
      width = Math.abs(width);
    }
    if (height < 0) {
      top = start.y + height;
      height = Math.abs(height);
    }
    left = clamp(left, 0, window.innerWidth - 1);
    top = clamp(top, 0, window.innerHeight - 1);
    width = clamp(width, 1, window.innerWidth - left);
    height = clamp(height, 1, window.innerHeight - top);
    return { x: left, y: top, width, height };
  }

  function drawRect(rect) {
    state.rect = rect;
    selectionEl.classList.remove('hidden');
    selectionEl.style.left = `${rect.x}px`;
    selectionEl.style.top = `${rect.y}px`;
    selectionEl.style.width = `${rect.width}px`;
    selectionEl.style.height = `${rect.height}px`;
    const scale = viewportScale();
    const w = Math.round(rect.width * scale.x);
    const h = Math.round(rect.height * scale.y);
    dimsEl.textContent = `${w} × ${h}`;
    dimsEl.classList.toggle('flip', rect.y < 46);
  }

  function resetSelection() {
    state.rect = null;
    state.lassoPoints = [];
    state.lassoBounds = null;
    state.ready = false;
    selectionEl.classList.add('hidden');
    lassoLayer.classList.add('hidden');
    shadeEl.classList.remove('off');
    captureBtn.disabled = true;
    crosshairEl.classList.remove('hidden');
    document.body.classList.remove('dragging');
    hintText.textContent = state.mode === 'lasso'
      ? 'Draw around any shape to capture it'
      : 'Drag anywhere to capture a region';
  }

  function beginRect(event) {
    state.dragging = true;
    state.start = pointerPosition(event);
    state.ready = false;
    captureBtn.disabled = true;
    shadeEl.classList.add('off');
    selectionEl.classList.remove('hidden');
    lassoLayer.classList.add('hidden');
    document.body.classList.add('dragging');
    crosshairEl.classList.add('hidden');
    lensEl.classList.remove('visible');
    drawRect({ x: state.start.x, y: state.start.y, width: 1, height: 1 });
  }

  function beginLasso(event) {
    state.dragging = true;
    state.ready = false;
    state.start = pointerPosition(event);
    state.lassoPoints = [state.start];
    state.lassoBounds = null;
    state.rect = null;
    captureBtn.disabled = true;
    shadeEl.classList.add('off');
    selectionEl.classList.add('hidden');
    lassoLayer.classList.remove('hidden');
    document.body.classList.add('dragging');
    crosshairEl.classList.add('hidden');
    lensEl.classList.remove('visible');
    updateLassoPath();
  }

  function updateLassoPath() {
    if (!state.lassoPoints.length) return;
    const d = state.lassoPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    lassoPath.setAttribute('d', `${d}${state.dragging ? '' : ' Z'}`);
    maskPath.setAttribute('d', `${d} Z`);
  }

  function finishRect() {
    state.dragging = false;
    document.body.classList.remove('dragging');
    if (!state.rect || state.rect.width < 4 || state.rect.height < 4) {
      resetSelection();
      toast('Drag a little further to select an area');
      return;
    }
    state.ready = true;
    captureBtn.disabled = false;
    crosshairEl.classList.add('hidden');
    lensEl.classList.remove('visible');
    const scale = viewportScale();
    hintText.textContent = `${Math.round(state.rect.width * scale.x)} × ${Math.round(state.rect.height * scale.y)} px selected`;
  }

  function finishLasso() {
    state.dragging = false;
    document.body.classList.remove('dragging');
    const points = state.lassoPoints;
    if (points.length < 4) {
      resetSelection();
      toast('Draw a larger shape to capture');
      return;
    }
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const bounds = {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
    if (bounds.width < 5 || bounds.height < 5) {
      resetSelection();
      toast('Draw a larger shape to capture');
      return;
    }
    state.lassoBounds = bounds;
    state.ready = true;
    updateLassoPath();
    captureBtn.disabled = false;
    crosshairEl.classList.add('hidden');
    lensEl.classList.remove('visible');
    const scale = viewportScale();
    hintText.textContent = `${Math.round(bounds.width * scale.x)} × ${Math.round(bounds.height * scale.y)} px lasso selected`;
  }

  function finalizeCapture() {
    if (!state.ready) return;
    const image = shotEl;
    if (!image.complete || !image.naturalWidth) {
      toast('The screenshot is still loading');
      return;
    }
    const scaleX = image.naturalWidth / window.innerWidth;
    const scaleY = image.naturalHeight / window.innerHeight;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    let source;

    if (state.mode === 'lasso' && state.lassoBounds) {
      source = state.lassoBounds;
    } else {
      source = state.rect;
    }
    if (!source) return;

    const sx = Math.max(0, Math.floor(source.x * scaleX));
    const sy = Math.max(0, Math.floor(source.y * scaleY));
    const sw = Math.max(1, Math.min(image.naturalWidth - sx, Math.round(source.width * scaleX)));
    const sh = Math.max(1, Math.min(image.naturalHeight - sy, Math.round(source.height * scaleY)));
    canvas.width = sw;
    canvas.height = sh;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    if (state.mode === 'lasso' && state.lassoPoints.length > 2) {
      context.save();
      context.beginPath();
      state.lassoPoints.forEach((point, index) => {
        const px = point.x * scaleX - sx;
        const py = point.y * scaleY - sy;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.closePath();
      context.clip();
      context.drawImage(image, -sx, -sy, image.naturalWidth, image.naturalHeight);
      context.restore();
    } else {
      context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    }

    const dataUrl = canvas.toDataURL('image/png');
    document.body.classList.add('capturing');
    captureBtn.disabled = true;
    cancelBtn.disabled = true;
    toast('Capturing…');
    setTimeout(() => {
      window.snapxOverlay.confirm({ dataUrl, width: sw, height: sh });
    }, 130);
  }

  function cancel() {
    if (state.dragging) {
      resetSelection();
      return;
    }
    window.snapxOverlay.cancel();
  }

  function nudgeSelection(dx, dy) {
    if (!state.ready) return;
    if (state.mode === 'lasso') {
      state.lassoPoints = state.lassoPoints.map((point) => ({
        x: clamp(point.x + dx, 0, window.innerWidth),
        y: clamp(point.y + dy, 0, window.innerHeight)
      }));
      state.lassoBounds = {
        x: Math.min(...state.lassoPoints.map((point) => point.x)),
        y: Math.min(...state.lassoPoints.map((point) => point.y)),
        width: 0,
        height: 0
      };
      const xs = state.lassoPoints.map((point) => point.x);
      const ys = state.lassoPoints.map((point) => point.y);
      state.lassoBounds.width = Math.max(...xs) - Math.min(...xs);
      state.lassoBounds.height = Math.max(...ys) - Math.min(...ys);
      updateLassoPath();
      return;
    }
    if (!state.rect) return;
    const scale = viewportScale();
    drawRect({
      x: clamp(state.rect.x + dx, 0, window.innerWidth - state.rect.width),
      y: clamp(state.rect.y + dy, 0, window.innerHeight - state.rect.height),
      width: state.rect.width,
      height: state.rect.height
    });
    hintText.textContent = `${Math.round(state.rect.width * scale.x)} × ${Math.round(state.rect.height * scale.y)} px selected`;
  }

  window.snapxOverlay.onInit((payload) => {
    state.mode = payload.mode === 'lasso' ? 'lasso' : 'rect';
    state.imageWidth = payload.width;
    state.imageHeight = payload.height;
    modeTitle.textContent = state.mode === 'lasso' ? 'Lasso capture' : 'Region capture';
    monitorLabel.textContent = payload.displayLabel || 'Display';
    document.body.classList.toggle('lasso-mode', state.mode === 'lasso');
    if (state.mode === 'lasso') {
      hintText.textContent = 'Draw around any shape to capture it';
      document.querySelector('.hud-hint').innerHTML = '<kbd>ESC</kbd> to cancel <span></span><kbd>ENTER</kbd> to capture';
    }
    shotEl.src = payload.screenshot;
    lensEl.style.backgroundImage = `url("${payload.screenshot}")`;
    shotEl.onload = () => {
      state.imageWidth = shotEl.naturalWidth;
      state.imageHeight = shotEl.naturalHeight;
    };
    resetSelection();
  });

  document.addEventListener('pointermove', (event) => {
    const point = pointerPosition(event);
    state.mouseX = point.x;
    state.mouseY = point.y;
    updateCrosshair(point.x, point.y);
    updateLens(point.x, point.y);

    if (!state.dragging) return;
    if (state.mode === 'lasso') {
      const last = state.lassoPoints[state.lassoPoints.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 2) {
        state.lassoPoints.push(point);
        updateLassoPath();
      }
    } else {
      const rect = updateRectFromPoints(state.start, point, event.shiftKey);
      drawRect(rect);
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.hud, .actions, .btn')) return;
    if (state.ready) {
      resetSelection();
    }
    if (state.mode === 'lasso') beginLasso(event);
    else beginRect(event);
    event.preventDefault();
  });

  document.addEventListener('pointerup', (event) => {
    if (event.button !== 0 || !state.dragging) return;
    if (state.mode === 'lasso') finishLasso();
    else finishRect();
  });

  document.addEventListener('pointerleave', () => {
    lensEl.classList.remove('visible');
    crosshairEl.classList.add('hidden');
  });

  document.addEventListener('pointerenter', () => {
    if (!state.ready) crosshairEl.classList.remove('hidden');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (state.ready) finalizeCapture();
      return;
    }
    if (state.ready && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const amount = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') nudgeSelection(-amount, 0);
      if (event.key === 'ArrowRight') nudgeSelection(amount, 0);
      if (event.key === 'ArrowUp') nudgeSelection(0, -amount);
      if (event.key === 'ArrowDown') nudgeSelection(0, amount);
    }
  });

  document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    cancel();
  });

  cancelBtn.addEventListener('click', cancel);
  captureBtn.addEventListener('click', finalizeCapture);

  document.addEventListener('pointerdown', (event) => {
    if (event.button === 0 && event.target.closest('.hud, .actions')) {
      event.stopPropagation();
    }
  }, true);
})();
