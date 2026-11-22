"""Green-key helpers shared by the GPT layer tools."""
import numpy as np, cv2
from PIL import Image
BG = np.array([0, 177, 64], np.float32)
def key(path):
    """RGBA float image (0..255) with the green background removed and edge spill cleaned."""
    im = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    spill = g - np.maximum(r, b)
    a = 1 - np.clip((spill - 6) / 18, 0, 1); a = cv2.GaussianBlur(a, (0, 0), 0.6); a = np.clip((a - 0.15) / 0.7, 0, 1)
    aa = np.maximum(a, 0.3)[..., None]
    rgb = np.clip((im - (1 - aa) * BG) / aa, 0, 255)
    gg = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]) + 12); rgb[..., 1] = np.where(a < 0.999, gg, rgb[..., 1])
    a[(rgb[..., 1] > rgb[..., 0] + 8) & (rgb[..., 1] > rgb[..., 2] + 8)] = 0
    # Nothing on her or her props is green, cyan or blue: everything is white, lavender, skin, or warm (the cookie).
    # So green above red is always background showing through a line or an edge, and reads as a teal speck if left.
    rgb[..., 1] = np.minimum(rgb[..., 1], rgb[..., 0] + 6)     # never greener than red: keeps the tan cookie (red over green over blue), removes teal
    return np.dstack([rgb, a * 255])
def over(dst, src):
    """Composite straight-alpha src over dst (both float RGBA 0..255), in place on a copy."""
    sa = src[..., 3:4] / 255; da = dst[..., 3:4] / 255; oa = sa + da * (1 - sa)
    rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    return np.dstack([rgb, oa * 255])
def save(a, path): Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(path)
def on(a, colour=(238, 240, 248)):
    bg = np.zeros_like(a); bg[..., :3] = colour; bg[..., 3] = 255
    return Image.fromarray(np.clip(over(bg, a)[..., :3], 0, 255).astype(np.uint8))
