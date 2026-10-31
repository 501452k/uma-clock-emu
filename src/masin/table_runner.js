'use strict';
const {runPairedComparison} = require('./paired_runner');

function parseSkillIds(text) {
  const parts = String(text).split(/[\s,;，]+/).filter(Boolean);
  if (!parts.length) throw Error('스킬 ID를 한 개 이상 입력하세요.');
  if (parts.length > 30) throw Error('한 번에 최대 30개 스킬까지 비교할 수 있습니다.');
  const ids = parts.map(x => {
    if (!/^\d+$/.test(x) || !Number.isSafeInteger(Number(x))) throw Error('잘못된 스킬 ID: '+x);
    return Number(x);
  });
  if (new Set(ids).size !== ids.length) throw Error('중복 스킬 ID가 있습니다.');
  return ids;
}

function compareSkillTable(vm, idText, options={}) {
  const ids = Array.isArray(idText) ? parseSkillIds(idText.join(',')) : parseSkillIds(idText);
  const secondsPerBashin=options.secondsPerBashin===undefined?0.1:Number(options.secondsPerBashin);
  if (!Number.isFinite(secondsPerBashin) || secondsPerBashin<=0) throw Error('마신 환산계수는 양수여야 합니다.');
  const iterations=options.iterations===undefined?10:options.iterations;
  if (!Number.isInteger(iterations)||iterations<1||iterations>100) throw Error('반복 횟수는 1~100이어야 합니다.');
  // The engine's skill menu already filters on course, style, and unsupported effects.
  const available=vm.availableSkills;
  if (!available || typeof available!=='object') throw Error('스킬 선택 목록을 읽을 수 없습니다.');
  const validIds=new Set();
  for (const [type, groups] of Object.entries(available)) {
    if (type==='evo') continue; // No scenario/evolution skills in mashin table.
    if (!groups || typeof groups!=='object') continue;
    for (const group of Object.values(groups)) {
      if (Array.isArray(group)) group.forEach(skill=>validIds.add(skill.id));
    }
  }
  for (const id of ids) if (!validIds.has(id)) throw Error('현재 코스·각질에서 선택 불가능하거나 제외된 스킬: '+id);
  const baseSeed=options.baseSeed===undefined?'masin-table-v1':String(options.baseSeed);
  const rows=ids.map(id=> {
    const result=runPairedComparison(vm,id,{iterations,baseSeed});
    const meanDeltaSeconds=result.mean_baseline_seconds-result.mean_skill_seconds;
    return {
      skill_id:id,skill_name:result.skill_name,
      baseline_seconds:result.mean_baseline_seconds,skill_seconds:result.mean_skill_seconds,
      delta_seconds:meanDeltaSeconds,
      mashin:meanDeltaSeconds/secondsPerBashin,
      stddev_mashin:result.stddev_masin==null?null:result.stddev_masin*(0.1/secondsPerBashin),
      iterations
    };
  });
  return {schema:'masin-table-v1', engine:'uma-clock-emu legacy',physics_verified_against_game:false,
    seconds_per_bashin:secondsPerBashin,assumption:'1 bashin = '+secondsPerBashin+' seconds (user-adjustable; not game-validated)',
    base_seed:baseSeed,iterations,rows};
}

function toCsv(report) {
  const quote=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const header=['skill_id','skill_name','baseline_seconds','skill_seconds','delta_seconds','mashin','stddev_mashin','iterations'];
  return [header.join(','),...report.rows.map(row=>header.map(k=>quote(row[k])).join(','))].join('\r\n')+'\r\n';
}
module.exports={parseSkillIds,compareSkillTable,toCsv};
