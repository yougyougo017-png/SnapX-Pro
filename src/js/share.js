import {
  openModal,
  toast,
  escapeHtml,
  urlToDataUrl,
  downloadDataUrl,
  copyText,
  setBusy,
  formatBytes,
  prettySource
} from './ui.js';
import { icon } from './icons.js';

function safeFilename(title) {
  return `${String(title || 'SnapX capture').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'SnapX capture'}.png`;
}

async function resolveDataUrl(capture) {
  if (capture.dataUrl) return capture.dataUrl;
  if (capture.url || capture.src) return urlToDataUrl(capture.url || capture.src);
  throw new Error('No image data is available for this capture.');
}

export function openShare(ctx, capture) {
  if (!capture) return;
  const source = capture.dataUrl || capture.url || capture.src;
  const modal = openModal({
    title: 'Share capture',
    subtitle: 'Copy, export, or send it straight to your team.',
    size: 'md',
    className: 'share-modal',
    content: `
      <div class="share-preview">
        <img src="${escapeHtml(source)}" alt="${escapeHtml(capture.title || 'Capture')}">
        <div class="share-preview-meta">
          <b>${escapeHtml(capture.title || 'SnapX capture')}</b>
          <span>${capture.width && capture.height ? `${capture.width} × ${capture.height}` : 'Image'}${capture.bytes ? ` · ${formatBytes(capture.bytes)}` : ''} · ${escapeHtml(prettySource(capture.source))}</span>
        </div>
      </div>
      <div class="share-grid">
        <button class="share-option" data-share="copy" type="button">
          <span class="share-icon gold">${icon('copy', 18)}</span>
          <span><b>Copy image</b><small>Ready to paste anywhere</small></span>
          ${icon('chevronRight', 13)}
        </button>
        <button class="share-option" data-share="discord" type="button">
          <span class="share-icon discord">${icon('discord', 18)}</span>
          <span><b>Discord</b><small>Post to a channel webhook</small></span>
          ${icon('chevronRight', 13)}
        </button>
        <button class="share-option" data-share="imgur" type="button">
          <span class="share-icon imgur">${icon('imgur', 18)}</span>
          <span><b>Imgur</b><small>Create an instant public link</small></span>
          ${icon('chevronRight', 13)}
        </button>
        <button class="share-option" data-share="drive" type="button">
          <span class="share-icon drive">${icon('drive', 18)}</span>
          <span><b>Google Drive</b><small>Save a copy and open Drive</small></span>
          ${icon('chevronRight', 13)}
        </button>
        <button class="share-option" data-share="export" type="button">
          <span class="share-icon">${icon('download', 18)}</span>
          <span><b>Export file</b><small>Choose a folder and save</small></span>
          ${icon('chevronRight', 13)}
        </button>
        <button class="share-option" data-share="markdown" type="button">
          <span class="share-icon">${icon('code', 18)}</span>
          <span><b>Copy Markdown</b><small>For docs and issue trackers</small></span>
          ${icon('chevronRight', 13)}
        </button>
      </div>
      <div class="share-result" data-share-result hidden></div>
      <div class="share-note">${icon('lock', 12)} Uploads use credentials stored locally in your encrypted vault. Nothing is uploaded unless you choose it.</div>
    `
  });

  const resultEl = modal.modal.querySelector('[data-share-result]');
  const showResult = (html) => {
    resultEl.hidden = false;
    resultEl.innerHTML = html;
  };

  const getData = async () => {
    try {
      return await resolveDataUrl(capture);
    } catch (error) {
      toast(error.message, { type: 'error' });
      throw error;
    }
  };

  modal.modal.querySelector('[data-share="copy"]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Copying…');
    try {
      await window.snapx.clipboard.image(await getData());
      toast('Image copied to clipboard', { type: 'success' });
      showResult(`<div class="notice notice-green">${icon('circleCheck', 15)} Image copied. Paste it into any app.</div>`);
    } catch {
      /* toast handled */
    } finally {
      setBusy(button, false);
    }
  });

  modal.modal.querySelector('[data-share="discord"]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!ctx.state.settings?.secrets?.discordWebhook) {
      modal.close();
      toast('Add a Discord webhook first', { type: 'info', action: 'Open settings', onAction: () => ctx.navigate('settings', { section: 'integrations' }) });
      return;
    }
    setBusy(button, true, 'Uploading…');
    try {
      const response = await window.snapx.share.discord({ dataUrl: await getData(), message: capture.title || '' });
      showResult(`
        <div class="notice notice-green">${icon('circleCheck', 15)} Uploaded to Discord${response.url ? ' · link ready' : ''}</div>
        ${response.url ? `<div class="share-link"><input readonly value="${escapeHtml(response.url)}"><button class="btn btn-sm btn-secondary" data-copy-link type="button">Copy link</button></div>` : ''}
      `);
      if (response.url) {
        resultEl.querySelector('[data-copy-link]')?.addEventListener('click', () => copyText(response.url, 'Link copied'));
      }
      toast('Uploaded to Discord', { type: 'success' });
    } catch (error) {
      showResult(`<div class="notice notice-error">${icon('alert', 15)} ${escapeHtml(error.message)}</div>`);
    } finally {
      setBusy(button, false);
    }
  });

  modal.modal.querySelector('[data-share="imgur"]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (!ctx.state.settings?.secrets?.imgurClientId) {
      modal.close();
      toast('Add your Imgur Client ID first', { type: 'info', action: 'Open settings', onAction: () => ctx.navigate('settings', { section: 'integrations' }) });
      return;
    }
    setBusy(button, true, 'Uploading…');
    try {
      const response = await window.snapx.share.imgur({ dataUrl: await getData(), title: capture.title || 'SnapX Pro capture' });
      showResult(`
        <div class="notice notice-green">${icon('circleCheck', 15)} Uploaded to Imgur</div>
        <div class="share-link"><input readonly value="${escapeHtml(response.url)}"><button class="btn btn-sm btn-secondary" data-copy-link type="button">Copy link</button></div>
      `);
      resultEl.querySelector('[data-copy-link]')?.addEventListener('click', () => copyText(response.url, 'Link copied'));
      toast('Instant link created', { type: 'success' });
    } catch (error) {
      showResult(`<div class="notice notice-error">${icon('alert', 15)} ${escapeHtml(error.message)}</div>`);
    } finally {
      setBusy(button, false);
    }
  });

  modal.modal.querySelector('[data-share="drive"]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Preparing…');
    try {
      const dataUrl = await getData();
      downloadDataUrl(dataUrl, safeFilename(capture.title));
      showResult(`<div class="notice notice-green">${icon('circleCheck', 15)} A copy was saved to your Downloads folder. Opening Google Drive…</div>`);
      await window.snapx.app.openExternal('https://drive.google.com/drive/my-drive');
    } catch {
      /* handled */
    } finally {
      setBusy(button, false);
    }
  });

  modal.modal.querySelector('[data-share="export"]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Saving…');
    try {
      if (capture.savedItem?.id || capture.fileName) {
        const filePath = await window.snapx.gallery.export(capture.savedItem?.id || capture.id);
        if (filePath) {
          showResult(`<div class="notice notice-green">${icon('circleCheck', 15)} Exported to ${escapeHtml(filePath)}</div>`);
          toast('Capture exported', { type: 'success' });
        }
      } else {
        downloadDataUrl(await getData(), safeFilename(capture.title));
        toast('Capture downloaded', { type: 'success' });
      }
    } catch (error) {
      showResult(`<div class="notice notice-error">${icon('alert', 15)} ${escapeHtml(error.message)}</div>`);
    } finally {
      setBusy(button, false);
    }
  });

  modal.modal.querySelector('[data-share="markdown"]').addEventListener('click', async () => {
    const dataUrl = await getData().catch(() => null);
    if (!dataUrl) return;
    await copyText(`![${capture.title || 'SnapX capture'}](${capture.url || 'local image'})`, 'Markdown copied');
  });
}
