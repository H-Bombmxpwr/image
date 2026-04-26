import { cropCanvasToBlob } from './client_ops.js';
import { CURRENT, IS_GIF, getCurrentBlob, replaceCurrentBlob, showToast } from './state.js';

export function wireCropper() {
  let cropper = null;
  const dialog = document.getElementById('cropDialog');

  const closeCropper = () => {
    try {
      cropper?.destroy?.();
    } catch (_) {
      // Ignore cleanup errors from Cropper.js.
    }
    cropper = null;
    dialog?.close();
  };

  document.getElementById('openCropper')?.addEventListener('click', () => {
    if (!CURRENT || !getCurrentBlob()) return;
    if (IS_GIF) {
      showToast('Cropping animated GIFs is not supported in the static cropper.', 'info');
      return;
    }

    const img = document.getElementById('cropImage');
    if (!img) return;
    img.src = CURRENT;
    dialog?.showModal();

    setTimeout(() => {
      try {
        cropper?.destroy?.();
      } catch (_) {
        // Ignore cropper reset errors.
      }
      cropper = new Cropper(img, {
        viewMode: 1,
        autoCropArea: 0.9,
        background: false,
        movable: true,
        zoomable: true,
        responsive: true,
      });
    }, 40);
  });

  document.getElementById('cropCancel')?.addEventListener('click', closeCropper);
  document.getElementById('cropCancelBtn')?.addEventListener('click', closeCropper);

  document.getElementById('cropApply')?.addEventListener('click', async () => {
    if (!cropper) return;
    try {
      const canvas = cropper.getCroppedCanvas({ imageSmoothingEnabled: true });
      const blob = await cropCanvasToBlob(canvas);
      await replaceCurrentBlob(blob, {
        recordHistory: true,
        label: 'Crop image',
      });
      closeCropper();
    } catch (_) {
      showToast('Crop failed', 'error');
    }
  });

  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeCropper();
    }
  });
}
