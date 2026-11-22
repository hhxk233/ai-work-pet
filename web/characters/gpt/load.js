/* Loads the GPT character: manifest -> rig -> PetEngine.Pet. Returns {pet, director}. */
(function (g) {
  g.loadGPT = async function (canvas, base) {
    base = base || 'characters/gpt/';
    g.GPT_TEX = await (await fetch(base + 'tex/manifest.json')).json();
    g.GPT_POSES = await (await fetch(base + 'tex/poses/poses.json')).json();
    const rig = g.GPTRig.build();
    const pet = new g.PetEngine.Pet(canvas, rig); await pet.load(base + 'tex/');
    const M = g.GPTMotions;
    return { pet, director: new g.PetEngine.Director({ clips: M.CLIPS, poses: g.GPT_POSES, seed: 23, idle: M.idle, walk: M.walk, tune: { legLift: 16, legSwing: 5, walkSpeed: 96, stepRate: 1.45 } }) };
  };
})(window);
