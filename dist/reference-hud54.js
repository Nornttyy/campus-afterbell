import {readControls,keyLabel} from './control-settings64.js?v=campus-83';
// Presentation consumes authoritative scores; names and points are never
// invented from an animation or inferred from the number of eaten objects.
export function hud54Model(s){
 const rows=(s.leaderboard||[]).filter(p=>Number.isFinite(p.points)&&p.points>=0).map(p=>({id:p.id,name:String(p.name||'同学'),points:p.points,caught:!!p.caught,isSelf:!!p.isSelf})).sort((a,b)=>b.points-a.points||a.id-b.id);
 return {rows,score:s.score,target:s.target,caught:s.caughtCount,total:s.teamSize,winner:s.status==='won'?'学生':'老师',reason:s.status==='won'?'捣蛋度已满':s.resultReason==='timeout'?'下课时间到':s.resultReason==='teacher-left'?'老师已离开':'捣蛋同学已被抓获',teacherName:s.teacher?.name||'老师'};
}
export function createReferenceHUD({document:doc=globalThis.document,root,bindings=readControls}){
 if(!doc?.createElement||!root?.append)return {update(){},finish(){},dispose(){}};
 const $=s=>doc.querySelector(s),make=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const ranking=make('aside','live-ranking');ranking.id='live-ranking';ranking.setAttribute('aria-label','实时排名');ranking.append(make('h3',null,'实时排名'));const rankList=make('ol');ranking.append(rankList);root.append(ranking);
 const held=make('div','held-input-hint');held.id='held-input-hint';held.hidden=true;root.append(held);
 const pause=$('#pause-dialog'),result=$('#result-dialog');pause.classList.add('reference-pause');result.classList.add('reference-result');
 const details=pause.querySelector('.controls-guide');if(details){details.querySelector('summary').textContent='操作说明';pause.append(details);}
 $('#resume-game').textContent='继续游戏';$('#leave-game').textContent='退出游戏';
 const settings=make('button','paper-button','设置');settings.id='pause-settings';settings.addEventListener('click',()=>{$('#settings-dialog')?.showModal();});pause.insertBefore(settings,$('#leave-game'));if(details)pause.insertBefore(details,$('#leave-game'));
 $('#student-controls').textContent='WASD 移动 · 鼠标转向\nE 拿取 / 打开 / 坐下\nQ 放回 / 关闭 / 起身\n拿笔后 E 切换转笔和写字\n长按左键使用 · 投掷物松开抛出\n对准后门按住 E 开门 / Q 关门\n按住 E 解救 · Shift 爬行\n机房方向键 / WASD 控制贪吃蛇\nM 麦克风 · ESC 暂停';
 $('#teacher-controls').textContent='WASD 移动 · 鼠标转向\n左键投粉笔 · E 抓住眩晕同学\n木桩前 E 绑住 · Q 放下\n黑板前按住 E 写字\nE 开门 / Q 关门\nM 麦克风 · ESC 暂停';
 const summary=make('div','result-summary'),scoreBox=result.querySelector('.result-number'),caughtBox=make('div','result-number');
 const caught=make('strong'),caughtLabel=make('span',null,'被捕人数');caught.id='result-caught';caughtBox.append(caught,caughtLabel);summary.append(scoreBox,caughtBox);result.insertBefore(summary,$('#result-detail'));
 const table=make('div','result-ranking');table.setAttribute('aria-label','本局成绩');result.insertBefore(table,$('#retry-game'));
 let lastRank='',lastHeld='',lastPrompt='';
 const row=(p,i,teacher=false)=>{const n=make('div',teacher?'rank-row teacher-result':'rank-row');n.dataset.self=String(p.isSelf);n.append(make('span','rank-place',teacher?'师':i+1),make('span','rank-name',p.name),make('strong','rank-points',teacher?'抓捕 '+p.points:'+'+p.points));return n;};
 function keyLine(key,label){const prefs=bindings();key=key==='E'?keyLabel(prefs.keys.interact):key==='Q'?keyLabel(prefs.keys.return):key==='鼠标'?keyLabel(prefs.keys.use):key;const line=make('span','input-line');line.append(make('kbd',key==='鼠标左键'?'mouse-key':'',key),make('span',null,label));return line;}
 return{
  update(s){
   const key=bindings().keys,move=[key.forward,key.left,key.back,key.right].map(keyLabel).join(' / '),use=keyLabel(key.use),e=keyLabel(key.interact),q=keyLabel(key.return);
   $('#student-controls').textContent=`${move} 移动 · 鼠标转向\n${e} 拿取 / 打开 / 坐下\n${q} 放回 / 关闭 / 起身\n拿笔后 ${e} 切换转笔和写字\n长按 ${use} 使用 · 投掷物松开抛出\n按住 ${e} 解救 · ${keyLabel(key.crawl)} 爬行\n机房方向键控制电脑\n${keyLabel(key.mic)} 麦克风 · ${keyLabel(key.pause)} 暂停`;
   $('#teacher-controls').textContent=`${move} 移动 · 鼠标转向\n${use} 投粉笔 · ${e} 抓住眩晕同学\n木桩前 ${e} 绑住 · ${q} 放下\n黑板前按住 ${e} 写字\n${keyLabel(key.mic)} 麦克风 · ${keyLabel(key.pause)} 暂停`;
   const model=hud54Model(s),signature=JSON.stringify(model.rows);ranking.hidden=s.stage!=='class';
   if(signature!==lastRank){lastRank=signature;rankList.replaceChildren(...model.rows.map((p,i)=>{const li=make('li');li.dataset.self=String(p.isSelf);li.append(make('span','rank-place',i+1),make('span','rank-name',p.name),make('strong','rank-points',p.points));return li;}));}
   const p=s.player,carrying=s.drawer.drawnSlot!=null,pen=carrying&&s.selected==='pen';
   const heldKey=JSON.stringify([carrying,s.selected,p.penWriting,p.caught,p.seated,s.paused,bindings().keys]);
   if(heldKey!==lastHeld){lastHeld=heldKey;held.replaceChildren();held.hidden=!carrying||p.caught||s.paused;if(!held.hidden){if(pen)held.append(keyLine('E',p.penWriting?'转笔':'写字'));else held.append(keyLine('鼠标',['smoke','flash','ink','bananaPeel'].includes(s.selected)?'松开投掷':'使用'));held.append(keyLine('Q','放回'));}}
   const prompt=$('#interaction-prompt'),text=prompt.textContent;
   {lastPrompt=text;const match=text.match(/^(.*?)([EQ]) (.*)$/);if(match){prompt.replaceChildren();if(match[1])prompt.append(make('span',null,match[1]));prompt.append(keyLine(match[2],match[3]));}}
  },
  finish(s){
   const m=hud54Model(s),title=$('#result-title');title.replaceChildren(make('span','winner-team',m.winner),make('span','winner-victory','胜利'));result.dataset.winner=m.winner==='学生'?'student':'teacher';
   $('#result-score').textContent=Math.floor(m.score)+' / '+m.target;$('#result-goal').textContent='捣蛋度';caught.textContent=m.caught+' / '+m.total;$('#result-detail').textContent=m.reason;
   table.replaceChildren(row({name:m.teacherName,points:m.caught},0,true),...m.rows.map((p,i)=>row(p,i)));
  },
  dispose(){ranking.remove();held.remove();settings.remove();}
 };
}
