<template>
  <section class="masin-panel">
    <h2>마신표 계산</h2>
    <p class="notice">현재 코스·각질에서 계산 가능한 스킬만 비교합니다. 상대 주자 디버프·시야·위치 이동 및 미지원 진화 스킬은 제외됩니다.</p>
    <el-form :inline="true" @submit.native.prevent>
      <el-form-item label="스킬 ID (쉼표 구분, 최대 30개)">
        <el-input v-model="skillIds" placeholder="예: 201082, 200431" style="width:290px" />
      </el-form-item>
      <el-form-item label="반복 횟수"><el-input-number v-model="iterations" :min="1" :max="100" :step="5" /></el-form-item>
      <el-form-item label="1마신당 초 (가정)"><el-input-number v-model="secondsPerBashin" :min="0.01" :max="1" :step="0.01" :precision="2" /></el-form-item>
      <el-form-item><el-button type="primary" :loading="busy" @click="calculate">마신표 계산</el-button></el-form-item>
      <el-form-item><el-button :disabled="!report || busy" @click="saveCsv">CSV 저장</el-button></el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <div v-if="report">
      <p>{{ report.rows.length }}개 스킬 · 스킬당 {{ report.iterations }}회 비교 · 1마신={{ report.seconds_per_bashin }}초 가정</p>
      <table class="masin-table">
        <thead><tr><th>스킬</th><th>ID</th><th>무스킬 평균(초)</th><th>스킬 평균(초)</th><th>시간 단축(초)</th><th>마신 차이</th><th>마신 표준편차</th></tr></thead>
        <tbody><tr v-for="item in report.rows" :key="item.skill_id">
          <td>{{ item.skill_name }}</td><td>{{ item.skill_id }}</td>
          <td>{{ fmt(item.baseline_seconds) }}</td><td>{{ fmt(item.skill_seconds) }}</td>
          <td>{{ fmt(item.delta_seconds) }}</td><td><strong>{{ fmt(item.mashin) }}</strong></td>
          <td>{{ fmt(item.stddev_mashin) }}</td>
        </tr></tbody>
      </table>
      <p class="notice">동일 시드 비교. 물리 엔진과 마신 환산계수의 게임 실측 검증은 완료되지 않았습니다.</p>
    </div>
  </section>
</template>
<script>
import { compareSkillTable, toCsv } from './table_runner';
export default {
  name: 'MasinPanel',
  props: { simulator: {type:Object,required:true} },
  data(){return {skillIds:'201082',iterations:10,secondsPerBashin:0.1,busy:false,error:'',report:null};},
  methods: {
    fmt(value){return Number.isFinite(value)?value.toFixed(4):'—';},
    calculate(){
      if(this.busy)return;
      this.error='';this.busy=true;this.report=null;
      this.$nextTick(()=>{
        try{this.report=compareSkillTable(this.simulator,this.skillIds,{iterations:this.iterations,secondsPerBashin:this.secondsPerBashin});}
        catch(ex){this.error=String(ex.message||ex);}
        finally{this.busy=false;}
      });
    },
    saveCsv(){
      if(!this.report)return;
      const blob=new Blob(['\uFEFF'+toCsv(this.report)],{type:'text/csv;charset=utf-8;'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='masin_table.csv';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }
};
</script>
<style scoped>
.masin-panel{margin:16px 0;padding:16px;border:1px solid #d8dce5;border-radius:8px;overflow-x:auto}
.masin-table{border-collapse:collapse;width:100%;white-space:nowrap;text-align:right}
.masin-table td,.masin-table th{border:1px solid #d8dce5;padding:8px}
.masin-table td:first-child,.masin-table th:first-child{text-align:left}
.notice{font-size:12px;color:#85601d}
</style>
