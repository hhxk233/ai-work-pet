/* Loads the DeepSeek character: manifest -> rig -> PetEngine.Pet. Returns {pet, director}. */
(function (g) {
  g.loadDeepSeek = async function (canvas, base) {
    base = base || 'characters/deepseek/';
    g.DEEPSEEK_TEX = await (await fetch(base + 'tex/manifest.json')).json();
    g.DEEPSEEK_POSES = await (await fetch(base + 'tex/poses/poses.json')).json();
    const rig = g.DeepSeekRig.build();
    const pet = new g.PetEngine.Pet(canvas, rig); await pet.load(base + 'tex/');
    const M = g.DeepSeekMotions;
    return { pet, director: new g.PetEngine.Director({ clips: M.CLIPS, poses: g.DEEPSEEK_POSES, seed: 11, idle: M.idle, walk: M.walk }) };
  };
})(window);
