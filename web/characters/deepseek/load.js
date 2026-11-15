/* Loads the DeepSeek character: manifest -> rig -> PetEngine.Pet. Returns {pet, director}. */
(function (g) {
  g.loadDeepSeek = async function (canvas, base) {
    base = base || 'characters/deepseek/';
    g.DEEPSEEK_TEX = await (await fetch(base + 'tex/manifest.json')).json();
    g.DEEPSEEK_POSES = await (await fetch(base + 'tex/poses/poses.json')).json();
    const rig = g.DeepSeekRig.build();
    const pet = new g.PetEngine.Pet(canvas, rig); await pet.load(base + 'tex/');
    return { pet, director: new g.DeepSeekMotions.Director(11) };
  };
})(window);
