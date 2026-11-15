"""4x anime super-resolution (Real-ESRGAN anime 6B, BSD-3) for the cut sprites, then resample to the model scale.
usage: upscale.py <weights.pth> <in_dir> <out_dir> name:scale ..."""
import sys, os, numpy as np, torch, torch.nn as nn, torch.nn.functional as F, cv2
from PIL import Image
class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__(); s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1); s.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1); s.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1); s.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1); s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        a = s.l(s.conv1(x)); b = s.l(s.conv2(torch.cat((x, a), 1))); c = s.l(s.conv3(torch.cat((x, a, b), 1))); d = s.l(s.conv4(torch.cat((x, a, b, c), 1))); e = s.conv5(torch.cat((x, a, b, c, d), 1)); return e * 0.2 + x
class RRDB(nn.Module):
    def __init__(s): super().__init__(); s.rdb1 = RDB(); s.rdb2 = RDB(); s.rdb3 = RDB()
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x
class Net(nn.Module):
    def __init__(s, nb=6):
        super().__init__(); s.conv_first = nn.Conv2d(3, 64, 3, 1, 1); s.body = nn.Sequential(*[RRDB() for _ in range(nb)]); s.conv_body = nn.Conv2d(64, 64, 3, 1, 1)
        s.conv_up1 = nn.Conv2d(64, 64, 3, 1, 1); s.conv_up2 = nn.Conv2d(64, 64, 3, 1, 1); s.conv_hr = nn.Conv2d(64, 64, 3, 1, 1); s.conv_last = nn.Conv2d(64, 3, 3, 1, 1); s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        f = s.conv_first(x); f = f + s.conv_body(s.body(f)); f = s.l(s.conv_up1(F.interpolate(f, scale_factor=2, mode='nearest'))); f = s.l(s.conv_up2(F.interpolate(f, scale_factor=2, mode='nearest'))); return s.conv_last(s.l(s.conv_hr(f)))
w, src, out = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(out, exist_ok=True)
net = Net(); sd = torch.load(w, map_location='cpu'); net.load_state_dict(sd.get('params_ema', sd.get('params', sd)), strict=True); net.eval(); torch.set_num_threads(os.cpu_count() or 4)
for arg in sys.argv[4:]:
    n, fs = arg.split(':'); fs = float(fs)
    im = np.array(Image.open(os.path.join(src, n + '.png')).convert('RGBA')); rgb, a = im[..., :3], im[..., 3]
    hole = (a < 200).astype(np.uint8); rgb = cv2.inpaint(rgb, hole, 4, cv2.INPAINT_TELEA)       # extend edge colour so the net sees no paper fringe
    x = torch.from_numpy(rgb.astype(np.float32) / 255).permute(2, 0, 1)[None]
    with torch.no_grad(): y = net(F.pad(x, (8, 8, 8, 8), mode='reflect'))[0, :, 32:-32, 32:-32].clamp(0, 1).permute(1, 2, 0).numpy()
    H, W = int(round(im.shape[0] * fs)), int(round(im.shape[1] * fs))
    y = cv2.resize((y * 255).astype(np.uint8), (W, H), interpolation=cv2.INTER_AREA if fs < 4 else cv2.INTER_CUBIC)
    a2 = cv2.resize(a, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255; a2 = np.clip((a2 - 0.5) * 1.6 + 0.5, 0, 1)   # keep the edge about as tight as the lines
    Image.fromarray(np.dstack([y, (a2 * 255).astype(np.uint8)])).save(os.path.join(out, n + '.png')); print(n, (W, H), flush=True)
