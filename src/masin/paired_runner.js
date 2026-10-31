/* Integration adapter for urakagi/uma-clock-emu Vue 2 MixinRaceCore instance.
 * Does NOT introduce new game physics. Uses that engine's start() and goal().
 * For a reproducible *comparison*, each race pair restarts identical PRNG seed.
 * Random-number consumption may diverge after skill activation: common-seed
 * pairing is not identical trajectories. Results must be labeled legacy-engine.
 */
'use strict';
function hash32(text) {
  let h=2166136261;
  for (let i=0;i<text.length;i++) {h ^= text.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function seededRandom(seed) {
  let state=(seed>>>0)||0x9e3779b9;
  return function () { state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296; };
}
function mean(values) {return values.reduce((a,b)=>a+b,0)/values.length;}
function stdev(values) { if(values.length<2)return null; const m=mean(values);return Math.sqrt(values.reduce((a,b)=>a+(b-m)**2,0)/(values.length-1));}
function findSupportedSkill(vm,id) {
  const list = Array.isArray(vm.skills)?vm.skills:[];
  const skill = list.find(x=>x.id===id);
  if (!skill)throw Error('Skill ID not present in legacy engine: '+id);
  if (skill.type==='unique'||skill.rarity==='unique'||skill.rarity==='evo'||skill.type==='systematic')
    throw Error('Unique/evolved/systematic skill selection is not covered by this adapter');
  if (!Array.isArray(vm.types)||!vm.types.includes(skill.type))throw Error('Unsupported engine skill type: '+skill.type);
  if (typeof vm.toRaritySection !== 'function')throw Error('Missing toRaritySection()');
  const section=vm.toRaritySection(skill.rarity);
  if (!(skill.type in vm.hasSkills)||!(section in vm.hasSkills[skill.type]))
    throw Error('Invalid legacy skill group: '+skill.type+'/'+section);
  return {skill,section};
}
function emptyAllSkills(vm) {
  // Use engine's own reset, not an inferred list of types.
  vm.resetHasSkills();
  vm.selectedUnique = null;
  vm.hasEvoSkills = [];
}
function oneRace(vm, skillSelection, seed, originalRandom) {
  emptyAllSkills(vm);
  if (skillSelection) vm.hasSkills[skillSelection.skill.type][skillSelection.section].push(skillSelection.skill.id);
  vm.emulations=[];
  vm.maxEpoch=2; // Prevent goal()->updateChart() because epoch stays zero.
  vm.$refs.executeBlock.epoch=0;
  Math.random=seededRandom(seed);
  try { vm.start(); }
  finally { Math.random=originalRandom; }
  if (!Array.isArray(vm.emulations)||vm.emulations.length!==1 || !Number.isFinite(vm.emulations[0].raceTime))
    throw Error('Engine did not produce one finite raceTime. Check track, stats and engine runtime.');
  return vm.emulations[0];
}
function runPairedComparison(vm, skillId, options={}) {
  if (!vm || typeof vm.start!=='function'||typeof vm.resetHasSkills!=='function')throw Error('Requires an initialized Vue simulator instance');
  if (!vm.$refs || !vm.$refs.executeBlock)throw Error('ExecuteBlock ref is missing');
  if (!vm.trackDetail || !Number.isFinite(Number(vm.courseLength)) || Number(vm.courseLength)<=0)
    throw Error('Select a valid course first');
  const iterations=options.iterations===undefined?30:options.iterations;
  if (!Number.isInteger(iterations)||iterations<1||iterations>1000)throw Error('iterations must be integer 1..1000');
  const baseSeed=options.baseSeed===undefined?'masin-v0.6':String(options.baseSeed);
  const chosen=findSupportedSkill(vm,Number(skillId));
  const ctl=vm.$refs.executeBlock;
  if (ctl.emulating)throw Error('Do not run comparison during normal emulation');
  const originalRandom=Math.random;
  const snapshot={
    hasSkills:JSON.parse(JSON.stringify(vm.hasSkills)), selectedUnique:vm.selectedUnique,
    hasEvoSkills:[...vm.hasEvoSkills], emulations:vm.emulations,
    maxEpoch:vm.maxEpoch, epoch:ctl.epoch, skillActivateAdjustment:ctl.skillActivateAdjustment
  };
  const results=[];
  try {
    vm.fullFillStatus();
    // Force chance check to pass only; racing randomness remains enabled.
    ctl.skillActivateAdjustment='1';
    for (let i=0;i<iterations;i++) {
      const seed=hash32(baseSeed+':'+i);
      const without=oneRace(vm,null,seed,originalRandom);
      const withSkill=oneRace(vm,chosen,seed,originalRandom);
      results.push({index:i+1,seed,baseline_seconds:without.raceTime,
        skill_seconds:withSkill.raceTime,masin:(without.raceTime-withSkill.raceTime)*10,
        baseline_max_spurt:without.maxSpurt,skill_max_spurt:withSkill.maxSpurt});
    }
  } finally {
    Math.random=originalRandom;
    vm.hasSkills=snapshot.hasSkills;vm.selectedUnique=snapshot.selectedUnique;
    vm.hasEvoSkills=snapshot.hasEvoSkills;vm.emulations=snapshot.emulations;
    vm.maxEpoch=snapshot.maxEpoch;ctl.epoch=snapshot.epoch;
    ctl.skillActivateAdjustment=snapshot.skillActivateAdjustment;
  }
  const scores=results.map(x=>x.masin);
  return {
    schema:'masin-legacy-paired-v0.6', provenance:'urakagi/uma-clock-emu legacy engine',
    physics_verified_against_game:false, effect_supported_by_new_db:false,
    skill_id:chosen.skill.id,skill_name:chosen.skill.name,iterations,base_seed:baseSeed,
    configuration:{course_length:vm.courseLength,track:JSON.parse(JSON.stringify(vm.track)),umaStatus:JSON.parse(JSON.stringify(vm.umaStatus))},
    methodology:'same PRNG seed per baseline/skill pair; RNG consumption may diverge',
    mean_baseline_seconds:mean(results.map(x=>x.baseline_seconds)),
    mean_skill_seconds:mean(results.map(x=>x.skill_seconds)),
    mean_masin:mean(scores),stddev_masin:stdev(scores),results
  };
}
function downloadJSON(result, filename='masin_legacy_paired_v0_6.json') {
  const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
module.exports={runPairedComparison,downloadJSON,seededRandom,hash32};
