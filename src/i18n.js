import Vue from "vue";
import VueI18n from "vue-i18n";
import ko from "./locales/ko.json";
import skillKo from "./locales/skill-ko.json";
import gametoraSkillKo from "./locales/skill-gametora-ko.json";
import tooltipKo from "./locales/tooltip-ko.json";

// Keep existing translations; prefer the new verified Gametora Korean names.
Object.assign(ko, {
  skill: { ...skillKo, ...gametoraSkillKo },
  tooltip: tooltipKo
});

Vue.use(VueI18n);

const i18n = new VueI18n({
  locale: "ko",
  fallbackLocale: "ko",
  messages: { ko }
});

export default i18n;
