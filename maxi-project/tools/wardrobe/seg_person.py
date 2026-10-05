"""Одежда на человеке (фото магазина): маска верха и низа нейросетью U2Net cloth-seg (ONNX, ~170 МБ).
Модель: https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_cloth_seg.onnx → tools/wardrobe/models/ (в .gitignore).
Классы: 1 — верх, 2 — низ, 3 — платье/комбинезон."""
import os, numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get('CLOTH_SEG', os.path.join(HERE, 'models', 'u2net_cloth_seg.onnx'))
_S = None


def crop_screen(im):
    """Скриншот карточки товара с телефона: отрезать интерфейс (полосы цвета фона приложения сверху и снизу)."""
    h, w = im.shape[:2]
    bg = np.median(im[:, :8].reshape(-1, 3), 0)
    ui = (np.abs(im.astype(int) - bg).max(2) < 10).mean(1) > 0.8
    rows = np.where(~ui)[0]
    # самый длинный непрерывный кусок «не интерфейса»
    best, s = (0, h), None
    runs = np.split(rows, np.where(np.diff(rows) > 3)[0] + 1)
    r = max(runs, key=len)
    return im[r[0]:r[-1] + 1]


def cloth_masks(im):
    global _S
    import onnxruntime as ort
    if _S is None: _S = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    h, w = im.shape[:2]
    x = cv2.resize(cv2.cvtColor(im, cv2.COLOR_BGR2RGB), (768, 768), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
    x = x / max(1.0, x.max())
    x = (x - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    out = _S.run(None, {'input': x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0]
    lab = cv2.resize(np.argmax(out, 0).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
    return {k: (lab == v).astype(np.uint8) for k, v in (('upper', 1), ('lower', 2), ('full', 3))}
