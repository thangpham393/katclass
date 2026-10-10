// Uses the same display parsers as the player against read-only live exports.
const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {questionWordBank,wordBankKey}=require('../../src/lib/question-word-bank.ts');
const {workbookIntro}=require('../../src/lib/workbook-intro.ts');
const {pinyinAllowed}=require('../../src/lib/question-pinyin.ts');
const work='tools/homework-lms/work';
const introReport=JSON.parse(fs.readFileSync(`${work}/workbook-intro-audit.json`));
const higher=JSON.parse(fs.readFileSync(`${work}/live-hsk3-plus-questions.json`));
const fills=JSON.parse(fs.readFileSync(`${work}/live-fill-questions.json`));
const banks=fills.filter(q=>questionWordBank(q));
const byLevel={};for(const q of banks)byLevel[q.level]=(byLevel[q.level]??0)+1;
const report={...introReport,display_intro_count:higher.filter(workbookIntro).length,
 hsk3_plus_without_annotations:higher.filter(q=>!pinyinAllowed(q)).length,
 source_bank_questions:banks.length,source_bank_questions_by_level:byLevel,
 source_bank_groups:new Set(banks.map(wordBankKey)).size,
 single_use_bank_groups:new Set(banks.filter(q=>!questionWordBank(q).reuse).map(wordBankKey)).size,
 source_banks_missing_blank_marker:banks.filter(q=>!q.content.prompt?.includes('___')).map(q=>q.id),
 verified_at:'2026-10-10',live_writes:0};
if(report.display_intro_count!==20||report.hsk3_plus_without_annotations!==higher.length||report.source_banks_missing_blank_marker.length)throw new Error('Layout audit failed; inspect live export');
fs.writeFileSync('tools/homework-lms/workbook-layout-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
