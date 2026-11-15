"""Original music-box loop for the demo video (synthesised here, no samples). 100 s, 44.1 kHz stereo."""
import numpy as np, wave
SR=44100; BPM=92; beat=60/BPM; DUR=100.0; N=int(SR*DUR); L=np.zeros(N); R=np.zeros(N)
def hz(m): return 440*2**((m-69)/12)
def pluck(f,d,amp,bright=1.0):
    t=np.arange(int(SR*d))/SR; env=np.exp(-t*3.2)*(1-np.exp(-t*400))
    return amp*env*(np.sin(2*np.pi*f*t)+0.35*bright*np.sin(2*np.pi*2*f*t)*np.exp(-t*5)+0.12*bright*np.sin(2*np.pi*4.02*f*t)*np.exp(-t*9))
def pad(f,d,amp):
    t=np.arange(int(SR*d))/SR; env=np.minimum(1,t/0.8)*np.minimum(1,(d-t)/0.9)
    return amp*env*(np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*f*1.003*t)+0.25*np.sin(2*np.pi*2*f*t))
def add(sig,t0,pan=0.5):
    i=int(t0*SR); n=min(len(sig),N-i)
    if n>0: L[i:i+n]+=sig[:n]*(1-pan)*1.3; R[i:i+n]+=sig[:n]*pan*1.3
# C  Am  F  G  |  C  Em  F  G   (2 bars = 8 beats each)
prog=[(60,[60,64,67]),(57,[57,60,64]),(53,[53,57,60]),(55,[55,59,62]),(60,[60,64,67]),(52,[52,55,59]),(53,[53,57,60]),(55,[55,59,62])]
mel =[[76,None,79,None,84,None,79,76],[72,None,76,None,81,None,76,72],[77,None,81,None,84,None,81,77],[74,None,79,None,83,None,79,74],
      [84,None,79,76,79,None,None,None],[83,None,79,76,79,None,None,None],[81,None,77,72,77,None,None,None],[79,None,74,71,74,None,79,None]]
t=0.0; bar=0
while t<DUR-1:
    root,ch=prog[bar%8]; seg=4*beat*2
    add(pad(hz(root-12),seg+0.6,0.045),t,0.5); [add(pad(hz(n),seg+0.6,0.022),t,0.35+0.1*k) for k,n in enumerate(ch)]
    arp=[ch[0],ch[1],ch[2],ch[1]+12,ch[2],ch[1],ch[2],ch[1]+12]*2
    for k,n in enumerate(arp): add(pluck(hz(n),1.2,0.085 if k%4 else 0.11,0.8),t+k*beat/2,0.3 if k%2 else 0.7)
    if bar>=2:                                    # melody enters after the first two chords
        for k,n in enumerate(mel[bar%8]):
            if n: add(pluck(hz(n),1.6,0.13,1.2),t+k*beat,0.5)
    t+=seg; bar+=1
for ch_ in (L,R):                                  # short room: three feedback taps
    for d,g in ((0.127,0.28),(0.211,0.2),(0.331,0.13)):
        k=int(d*SR); ch_[k:]+=ch_[:-k]*g
fade=np.ones(N); fi=int(1.5*SR); fo=int(4*SR); fade[:fi]=np.linspace(0,1,fi)**2; fade[-fo:]=np.linspace(1,0,fo)**1.5
st=np.stack([L,R],1)*fade[:,None]; st=st/np.abs(st).max()*0.62
w=wave.open('bgm.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype('<i2').tobytes()); w.close(); print('bgm ok',N/SR)
