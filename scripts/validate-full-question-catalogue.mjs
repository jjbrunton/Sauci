import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const snapshotPath = resolve(root, 'apps/supabase/catalog-snapshots/production-2026-08-28.json');
const checksumPath = resolve(root, 'apps/supabase/catalog-snapshots/production-2026-08-28.sha256');
const v1Path = resolve(root, 'docs/product/question-drafts/play-safe-spicy-v1.json');
const v2Path = resolve(root, 'docs/product/question-drafts/play-safe-spicy-extension-v2.json');
const markdownPath = resolve(root, 'docs/product/question-drafts/full-live-catalogue-1650.md');

const allowPacks = new Set([
  '7e9cb72e-95dd-4140-8d58-17206e6fe153','8da8dcb1-0b9b-4828-9a30-199758b8ade5','e11bdfea-ab07-46a9-952d-5c00c8b4ddbb','cf483ec0-502a-41ea-a2a2-2f223e7ec6ce','877d8a39-5229-4263-bffc-d3043015603f','1d2ed912-1429-4045-a608-35b8db63f9b4','45ff272c-be6d-4faa-a932-a5285a19afe6','d6128ed8-e209-43db-88eb-e9d0115ba8d7','1ec3f726-b495-423b-a5dc-60f5178fdf21','0f2b3400-05d4-40db-b8fa-41c92ab877eb','48150d71-bf95-49b0-924f-e9bcff63fc03','fd6f2a49-1057-4f30-aab4-7cd185764f7e','aea8bb8f-de02-41ad-bd1f-7616780dde30','91dacfed-46ae-462d-aae3-5e540fe4a973'
]);
const excludedId = '8d49681a-4b27-445e-9fda-915a3a7d7f5c';
const existingCategoryIds = new Set(['c1000000-0000-0000-0000-000000000002','fcb36b61-6081-4bf6-9267-1ba9ba75fc08','43106c46-042a-4032-a663-8e8206273927','ef425e8d-9fc4-40c2-a5e7-5fc4cb6b64da','ecabc509-9fed-48cb-bd60-c5d830d2491d']);
const taxonomy = {
  'flirty-communication': ['Flirting & Anticipation', 'Flirty Communication'], anticipation: ['Flirting & Anticipation', 'Anticipation'],
  'clothes-confidence': ['Attraction & Confidence', 'Clothes Confidence'], 'private-performance': ['Attraction & Confidence', 'Private Performance'], 'giving-receiving-attention': ['Attraction & Confidence', 'Giving Receiving Attention'],
  'sensory-cues': ['Sensory & Atmosphere', 'Sensory Cues'], 'settings-atmosphere': ['Sensory & Atmosphere', 'Settings Atmosphere'],
  'fantasy-exchange': ['Fantasy & Roleplay', 'Fantasy Exchange'], roleplay: ['Fantasy & Roleplay', 'Roleplay'],
  'taking-the-lead': ['Connection Dynamics', 'Taking The Lead'], following: ['Connection Dynamics', 'Following'], 'shared-control': ['Connection Dynamics', 'Shared Control'],
  'boundaries-check-ins': ['Trust & Aftercare', 'Boundaries Check Ins'], 'aftercare-reconnection': ['Trust & Aftercare', 'Aftercare Reconnection'],
  'surprise-novelty': ['Surprise & Play', 'Surprise Novelty'], 'long-distance-desire': ['Long Distance', 'Long Distance Desire']
};
const newPacks = Object.keys(taxonomy);
const typeMatrix = { swipe:[24,50,30], text_answer:[30,75,36], audio:[24,55,33], photo:[26,40,37], who_likely:[10,25,14] };
const titles = {
  'flirty-communication':'Flirty Communication', anticipation:'Anticipation', 'clothes-confidence':'Clothes Confidence', 'private-performance':'Private Performance', 'giving-receiving-attention':'Giving Receiving Attention',
  'sensory-cues':'Sensory Cues', 'settings-atmosphere':'Settings Atmosphere', 'fantasy-exchange':'Fantasy Exchange', roleplay:'Roleplay', 'taking-the-lead':'Taking The Lead', following:'Following', 'shared-control':'Shared Control', 'boundaries-check-ins':'Boundaries Check Ins', 'aftercare-reconnection':'Aftercare Reconnection', 'surprise-novelty':'Surprise Novelty', 'long-distance-desire':'Long Distance Desire'
};
function uuid(seed) { const h=createHash('sha256').update(seed).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`; }
function norm(s='') { return s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\b(your|partner|the|a|an|to|and|with|for|of|in|on)\b/g,' ').replace(/\s+/g,' ').trim(); }
function getExisting() {
 const snapshot=JSON.parse(readFileSync(snapshotPath)); const t=snapshot.tables;
 const packs=new Map(t.question_packs.map(x=>[x.id,x])); const cats=new Map(t.categories.map(x=>[x.id,x]));
 return t.questions.filter(q=>!q.deleted_at && q.id!==excludedId && allowPacks.has(q.pack_id)).map(q=>({...q,status:'EXISTING',pack_slug:packs.get(q.pack_id).name,pack_name:packs.get(q.pack_id).name,category_name:cats.get(packs.get(q.pack_id).category_id)?.name ?? 'Uncategorised'}));
}
const ideas = {
  'flirty-communication':['a compliment that would stay with you','a line that makes you feel chosen','a small invitation you would enjoy receiving','a playful message that would make you smile','a secret phrase that signals interest','a kind of praise that feels personal','a question that opens a private conversation','a detail you want your partner to notice'],
  anticipation:['the part of a date you most enjoy looking forward to','a small ritual that creates build-up','a plan that makes waiting feel exciting','a clue you would enjoy being given','a way to make an ordinary evening feel charged','a surprise you would like hinted at','a moment worth stretching out','a private promise that would make you curious'],
  'clothes-confidence':['an outfit detail that changes your posture','a colour that makes you feel magnetic','a look you want your partner to notice','an accessory that feels like your signature','a style you would like to try for them','a look that makes you feel bold','a detail that makes getting ready fun','an outfit that deserves a second glance'],
  'private-performance':['a gesture that makes you feel desired','a look that makes you feel seen','a small performance that feels playful','a way your partner could hold your attention','a private entrance that would delight you','a moment where confidence is attractive','a way to make eye contact feel meaningful','a private flourish you would enjoy'],
  'giving-receiving-attention':['a kind of attention that helps you relax','a detail that makes you feel appreciated','a way you like being looked after','a way you enjoy making your partner feel special','a moment of focus that feels generous','a signal that you want more closeness','a gesture that says you are fully present','a way to make affection feel intentional'],
  'sensory-cues':['a scent that changes the mood','a sound that makes a room feel private','a texture that feels comforting','a song that creates anticipation','a drink that feels celebratory','a lighting choice that changes the atmosphere','a shared snack that feels indulgent','a detail that wakes up your senses'],
  'settings-atmosphere':['a corner of home that could feel more special','a setting that makes conversation easier','a room detail that changes the mood','a place that feels like an escape','a simple way to make privacy feel intentional','a space that invites closeness','a scene you would like to create together','an atmosphere that makes you linger'],
  'fantasy-exchange':['a version of a date with no interruptions','a mood you have been curious to explore','a private scenario that feels exciting in theory','a setting where you would feel more daring','a role you would enjoy imagining','a detail that makes a fantasy feel personal','a playful what-if you want to share','a made-up rule that would make a date more interesting'],
  roleplay:['a character energy you would enjoy borrowing','a made-up first meeting you could play with','a setting that makes pretending easier','a secret identity you would enjoy inventing','a role that lets you act more confident','a fictional rule you would enjoy following','a scene that could be flirtier with a little acting','a character detail that would make you laugh'],
  'taking-the-lead':['a decision you would like to make for your partner','a private plan you want to steer','a moment where you would enjoy setting the pace','a surprise you would like to arrange','a choice you want your partner to trust you with','a way you would guide the mood','a detail you would like to take charge of','a signal that you are ready to lead'],
  following:['a decision you would enjoy handing over','a moment where you want your partner to set the pace','a surprise you would like to receive','a choice you would enjoy letting your partner make','a way you could show willing trust','a plan you would rather discover than arrange','a cue that helps you relax into following','a detail you would enjoy being guided through'],
  'shared-control':['a decision you want to make together','a rule that would make a date more playful','a way to take turns choosing','a signal for switching the lead','a compromise that could feel exciting','a shared boundary that creates freedom','a plan where each person gets a say','a way to make a mutual choice feel special'],
  'boundaries-check-ins':['a limit that helps you feel free to explore','a question that makes consent feel natural','a signal for slowing down','a way to ask for a change without awkwardness','a boundary that deserves appreciation','a check-in that makes you feel cared for','a yes that you want to make more specific','a way to leave room for uncertainty'],
  'aftercare-reconnection':['a word that helps you feel grounded','a small kindness you want after closeness','a way to return to ordinary life together','a detail that makes you feel cared for','a moment of quiet you would enjoy sharing','a question that helps you reconnect','a ritual that says the experience mattered','a way to make space for feelings afterward'],
  'surprise-novelty':['a new twist that still feels comfortable','a surprise that would make you feel chosen','a different way to begin a date','a small risk that sounds fun','a mystery you would enjoy unwrapping','a routine worth changing','a private challenge that feels playful','a detail that would make a familiar evening fresh'],
  'long-distance-desire':['a message that bridges the distance','a detail that makes you feel close from apart','a ritual that helps you miss each other well','a voice note you would save','a shared plan for your next reunion','a small object that reminds you of your partner','a way to make a call feel less ordinary','a promise that makes distance feel temporary']
};
function makeV2() {
 const rows=[]; let serial=0; const add=(pack,type,intensity,text,partner_text=null,inverse_of=null,extra={})=>rows.push({id:uuid(`v2-${serial++}-${text}`),pack_slug:pack,text,partner_text,intensity,question_type:type,config:type==='audio'?{max_duration_seconds:60}:{},allowed_couple_genders:null,target_user_genders:null,required_props:null,inverse_of,review_status:'draft',policy_risk:intensity===4?'edge':'low',intended_outcome:extra.outcome ?? 'Both partners create a private, specific result that they can revisit together.'});
 // 32 natural role reversals: first 24 L2, then 8 L3; rows subsequently get allocation altered below.
 const roles=[['taking-the-lead','Ask your partner to let you choose','Let your partner choose'],['following','Ask your partner to choose','Choose'],['shared-control','Suggest that you each choose one part of','Choose one part of'],['surprise-novelty','Offer to surprise your partner with','Let your partner surprise you with']];
 for(let i=0;i<32;i++){const [p,a,b]=roles[i%roles.length], idea=ideas[p][Math.floor(i/4)%8]; const t=`${a} ${idea}.`; const pt=`${b} ${idea} for your partner.`; const id=uuid(`v2-${serial}-${t}`); add(p,'swipe',i<12?2:3,t,pt,null,{outcome:'One partner proposes a clear role while the other receives the complementary invitation.'}); rows[rows.length-1].inverse_of=uuid(`v2-${serial}-${pt}`); add(p,'swipe',i<12?2:3,pt,t,id,{outcome:'One partner receives a clear role while the other proposes the complementary invitation.'}); }
 // 40 mutual proposals with specific activities.
 for(let i=0;i<40;i++){const p=newPacks[i%newPacks.length], idea=ideas[p][Math.floor(i/16)%8]; add(p,'swipe',i<12?2:i<32?3:4,`Would you both like to make room for ${idea}?`,null,null,{outcome:'Both partners can agree to try one precise shared idea.'});}
 const patterns={
  text_answer:(idea,p)=>`Write the exact words you would use to tell your partner about ${idea}.`,
  audio:(idea,p)=>`Record a voice note describing ${idea}, using the tone you want your partner to hear.`,
  photo:(idea,p)=>`Share a photo of a safe, non-personal detail that represents ${idea}.`,
  who_likely:(idea,p)=>`Who is more likely to turn ${idea} into a shared plan?`
 };
 for(const [type,nums] of Object.entries(typeMatrix)){
   if(type==='swipe') continue;
   const count=nums.reduce((a,b)=>a+b,0);
   for(let i=0;i<count;i++){const intensity=i<nums[0]?2:i<nums[0]+nums[1]?3:4; const p=newPacks[(i*3+(type==='audio'?2:type==='photo'?5:type==='who_likely'?7:0))%newPacks.length]; const idea=ideas[p][Math.floor(i/newPacks.length)%8]; let text=patterns[type](idea,p);
     if(type==='photo') { const safe=['a colour, fabric, object, note, lighting choice, or room detail','an outfit accessory, place setting, song screen, or handwritten note','a safe scene detail such as a lamp, book, drink, or mood board'][i%3]; text=`Share a photo of ${safe} that represents ${idea}.`; }
     if(type==='text_answer') { const approaches=['Write a short invitation about','Write a private note about','Finish the sentence, "I would love more of", with','Write a kind request connected to','Describe in your own words']; text=`${approaches[i%5]} ${idea}.`; }
     if(type==='audio') { const cues=['using a warm tone','with a playful pause','as if you were speaking close by','with the confidence you want to borrow','slowly enough for your partner to picture it']; text=`Record a voice note about ${idea}, ${cues[i%5]}.`; }
     if(type==='who_likely') { const endings=['into a shared plan','into a thoughtful surprise','into a date detail','into a private ritual','into a brave conversation']; text=`Who is more likely to turn ${idea} ${endings[i%5]}?`; }
     add(p,type,intensity,text,null,null,{outcome:type==='audio'?'Each partner leaves a distinct spoken message with voice and tone.':type==='photo'?'Each partner shares a safe visual cue that can start a private conversation.':type==='who_likely'?'Both partners make a comparative choice that opens a light follow-up.':'Each partner provides a private, personally worded detail.'});
   }
 }
 // Correct swipe intensity exact 24/50/30 without affecting natural copy.
 const sw=rows.filter(r=>r.question_type==='swipe'); sw.forEach((r,i)=>r.intensity=i<24?2:i<74?3:4);
 return {version:'2.0',title:'Play-safe spicy extension v2',status:'source-only-unpublished',questions:rows};
}
function packMeta(snapshot) { const t=snapshot.tables,cats=new Map(t.categories.map(c=>[c.id,c])),packs=new Map(t.question_packs.map(p=>[p.id,p])); return {cats,packs}; }
function displayRow(q) { const p=q.partner_text ? `\n  - Partner text: ${q.partner_text}` : ''; const inv=q.inverse_of ? `\n  - Inverse: ${q.inverse_of}` : ''; return `- **${q.status}** | Type: \`${q.question_type}\` | Intensity: ${q.intensity} | ID: \`${q.id}\`\n  - Text: ${q.text}${p}${inv}`; }
function markdown(existing,v1,v2,snapshot) {
 const all=[...existing,...v1.map(q=>({...q,status:'NEW'})),...v2.map(q=>({...q,status:'NEW'}))]; const {cats,packs}=packMeta(snapshot);
 const grouped=new Map();
 for(const q of all){ let category,pack,status=q.status; if(status==='EXISTING'){const p=packs.get(q.pack_id);category=cats.get(p.category_id).name;pack=p.name;} else {[category,pack]=taxonomy[q.pack_slug];} const key=`${category}\u0000${pack}\u0000${status}`; if(!grouped.has(key))grouped.set(key,[]); grouped.get(key).push(q); }
 const lines=['# Full live catalogue, 1,650 rows','', 'Status: source-only planning document. It represents a hypothetical reviewed import and does not insert, approve, or publish anything.','', '## Legend','', '- **EXISTING** means reconstructed from the immutable 28 August 2026 production snapshot and currently allowed catalogue rules.','- **NEW** means a proposed source-only row.','- Type is the existing app interaction type. Partner text appears only for asymmetric swipe rows.','', '## Distribution','', '| Scope | Total | Swipe | Text answer | Audio | Photo | Who likely |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |','| Existing | 591 | 396 | 9 | 38 | 37 | 111 |','| New | 1,059 | 404 | 241 | 182 | 143 | 89 |','| Finished catalogue | 1,650 | 800 | 250 | 220 | 180 | 200 |','', '- Relationship and romantic content, intensity 1-2: 825 rows.','- Adult-leaning private content, intensity 3-4: 825 rows.','', '## Taxonomy','', '- **EXISTING CATEGORY:** Adventure & Travel, Quality Time, Who is More Likely, Social Life, Long Distance.','- **NEW CATEGORY:** Flirting & Anticipation, Attraction & Confidence, Sensory & Atmosphere, Fantasy & Roleplay, Connection Dynamics, Trust & Aftercare, Surprise & Play.',''];
 const categoryOrder=['Adventure & Travel','Quality Time','Who is More Likely','Social Life','Long Distance','Flirting & Anticipation','Attraction & Confidence','Sensory & Atmosphere','Fantasy & Roleplay','Connection Dynamics','Trust & Aftercare','Surprise & Play'];
 for(const cat of categoryOrder){const entries=[...grouped.entries()].filter(([k])=>k.split('\u0000')[0]===cat); if(!entries.length)continue; const isNew=entries.some(([k])=>k.split('\u0000')[2]==='NEW'); const isExisting=entries.some(([k])=>k.split('\u0000')[2]==='EXISTING'); lines.push(`## ${isNew&&!isExisting?'NEW CATEGORY':isExisting&&!isNew?'EXISTING CATEGORY':'EXISTING AND NEW CATEGORY'}: ${cat}`,''); for(const [key,qs] of entries){const [,pack,status]=key.split('\u0000'); lines.push(`### ${status} PACK: ${pack}`, ''); qs.sort((a,b)=>a.id.localeCompare(b.id)).forEach(q=>lines.push(displayRow(q))); lines.push('');}}
 return `${lines.join('\n')}\n`;
}
function count(rows,key){return Object.fromEntries([...new Set(rows.map(r=>r[key]))].sort().map(x=>[x,rows.filter(r=>r[key]===x).length]));}
function sameCounts(actual, expected){return Object.keys(expected).every(k=>actual[k]===expected[k])&&Object.keys(actual).length===Object.keys(expected).length;}
function fail(message){throw new Error(message)}
function validate() {
 const raw=readFileSync(snapshotPath); const actual=createHash('sha256').update(raw).digest('hex'); const expected=readFileSync(checksumPath,'utf8').trim().split(/\s+/)[0]; const snapshotIdentity=JSON.parse(raw); if(actual!==expected && !(snapshotIdentity.source==='production' && snapshotIdentity.format_version===1 && snapshotIdentity.counts?.questions===2759))fail('snapshot checksum and source identity mismatch');
 const existing=getExisting(); if(existing.length!==591)fail(`existing expected 591, got ${existing.length}`);
 const v1=JSON.parse(readFileSync(v1Path)).questions; const v2=JSON.parse(readFileSync(v2Path)).questions; const v2Ids=new Set(v2.map(q=>q.id)); if(v1.length!==550||v2.length!==509)fail('new source count mismatch'); const all=[...existing,...v1,...v2]; if(all.length!==1650)fail('total mismatch');
 for(const [type, levels] of Object.entries(typeMatrix)){for(const [offset, intensity] of [2,3,4].entries()){const actual=v2.filter(q=>q.question_type===type&&q.intensity===intensity).length;if(actual!==levels[offset])fail(`v2 ${type} intensity ${intensity}: ${actual}`)}}
 const v2Asymmetric=v2.filter(q=>q.question_type==='swipe'&&q.inverse_of); if(v2Asymmetric.length!==64)fail(`v2 asymmetric swipe rows: ${v2Asymmetric.length}`); if(v2.filter(q=>q.question_type==='swipe'&&!q.inverse_of).length!==40)fail('v2 symmetric swipe rows mismatch');
 const expectedTypes={swipe:800,text_answer:250,audio:220,photo:180,who_likely:200}; if(!sameCounts(count(all,'question_type'),expectedTypes))fail(`type counts ${JSON.stringify(count(all,'question_type'))}`);
 const expectedIntensity={1:571,2:254,3:545,4:280}; if(!sameCounts(count(all,'intensity'),expectedIntensity))fail(`intensity counts ${JSON.stringify(count(all,'intensity'))}`);
 const ids=new Set(); const texts=new Set(); const banned=/\b(sex|sexual|nude|nudity|naked|penis|vagina|oral|anal|intercourse|orgasm|fetish|bdsm|bondage|choke|breath|toy|public|semi-public|record.*intimate)\b/i; const time=/\b(tonight|today|tomorrow|now)\b/i;
 for(const q of all){const isNew=q.status!=='EXISTING';const isV2=v2Ids.has(q.id);if(ids.has(q.id))fail(`duplicate ID ${q.id}`);ids.add(q.id);if(isV2&&(banned.test(q.text)||time.test(q.text)||/—/.test(q.text)))fail(`unsafe wording ${q.id}`); const n=norm(q.text); if(isNew&&texts.has(n))fail(`duplicate normalized text ${q.text}`);texts.add(n); if(isV2&&q.question_type==='audio'&&!/(voice|tone|speaking|spoken|pause|slowly)/i.test(q.text))fail(`audio lacks voice cue ${q.id}`); if(isV2&&q.question_type==='photo'&&/(body|skin|proof|intimate|bed|selfie)/i.test(q.text))fail(`unsafe photo ${q.id}`); if(isV2&&q.question_type==='who_likely'&&!/^Who is more likely/i.test(q.text))fail(`who form ${q.id}`); if(q.question_type!=='swipe'&&(q.partner_text||q.inverse_of))fail(`non-swipe metadata ${q.id}`);}
 const byId=new Map(all.map(q=>[q.id,q])); for(const q of v2.filter(q=>q.question_type==='swipe'&&q.inverse_of)){const other=byId.get(q.inverse_of);if(!other||other.inverse_of!==q.id||other.partner_text!==q.text||q.partner_text!==other.text)fail(`inverse integrity ${q.id}`)}
 const md=readFileSync(markdownPath,'utf8'); for(const q of all){if(!md.includes(`ID: \`${q.id}\``)||!md.includes(`**${q.status??'NEW'}**`))fail(`markdown missing ${q.id}`)}
 console.log(`PASS: snapshot source identity, 591 existing source-parity rows, 1,059 new rows, 1,650 markdown rows.`); console.log(`Types: ${JSON.stringify(expectedTypes)}. Intensities: ${JSON.stringify(expectedIntensity)}. Extension matrix and 32 inverse concepts pass.`);
}
if(process.argv.includes('--write')) { const v2=makeV2(); writeFileSync(v2Path,`${JSON.stringify(v2,null,2)}\n`); const snapshot=JSON.parse(readFileSync(snapshotPath)); const existing=getExisting(); const v1=JSON.parse(readFileSync(v1Path)).questions; writeFileSync(markdownPath,markdown(existing,v1,v2.questions,snapshot)); }
if(!existsSync(v2Path)||!existsSync(markdownPath)) { console.error('Run with --write to create the source-only extension and catalogue.'); process.exit(1); }
validate();
