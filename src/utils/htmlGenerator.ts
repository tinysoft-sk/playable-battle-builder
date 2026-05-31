import type { BattleConfig, NetworkTarget, AssetData } from '../types/battle';

function uri(a: AssetData | null | undefined): string {
  return a?.dataUri ?? '';
}

function hintFor(config: BattleConfig, trigger: string): string {
  const fc = config.scenario.failConditions.find(f => f.trigger === trigger);
  return fc ? fc.hintLines.join('<br>') : '';
}

export function generateHTML(config: BattleConfig, network: NetworkTarget): string {
  const hasAudio = network !== 'facebook';

  const p0 = config.playerUnits[0];

  const retaliationsData = config.scenario.retaliations.map(r => ({
    killerId: r.killedUnitId,
    retaliatorId: r.retaliatorUnitId,
    damage: r.damage,
    speech: r.speechText,
    followUp: r.followUpSpeech,
  }));

  const hintMoveToFlying    = hintFor(config, 'move_to_flying');
  const hintKillRangedFirst = hintFor(config, 'kill_ranged_first');
  const hintWrongSpellFly   = hintFor(config, 'wrong_spell_on_flying');
  const hintWastedSpell     = hintFor(config, 'wasted_spell');

  const storeIos     = config.store.iosUrl;
  const storeAndroid = config.store.androidUrl;
  const ctaFailCount = config.store.ctaFailCount;
  const hDefeatColor = config.popups.defeat.hintTextColor;

  const sbClosedUri   = uri(config.uiAssets?.spellbookClosed);
  const sbOpenUri     = uri(config.uiAssets?.spellbookOpen);
  const meleeIconUri  = uri((config.uiAssets as any)?.meleeIcon);
  const rangedIconUri = uri((config.uiAssets as any)?.rangedIcon);
  const flyingIconUri = uri((config.uiAssets as any)?.flyingIcon);
  const gridOffsetLand = (config as any).gridOffset?.landscape ?? 0;
  const gridOffsetPort = (config as any).gridOffset?.portrait ?? 0;
  const hintLandY    = (config as any).hintLayout?.landscapeY    ?? 265;
  const hintPortY    = (config as any).hintLayout?.portraitY     ?? 265;
  const hintLandFS   = (config as any).hintLayout?.landscapeFontSize ?? 13.5;
  const hintPortFS   = (config as any).hintLayout?.portraitFontSize  ?? 13.5;
  const sbLandX    = (config as any).speechLayout?.landscapeX      ?? 160;
  const sbLandY    = (config as any).speechLayout?.landscapeY      ?? 14;
  const sbLandFS   = (config as any).speechLayout?.landscapeFontSize ?? 13;
  const sbPortX    = (config as any).speechLayout?.portraitX       ?? 14;
  const sbPortY    = (config as any).speechLayout?.portraitY       ?? 14;
  const sbPortFS   = (config as any).speechLayout?.portraitFontSize ?? 13;
  const appIconUri  = uri(config.appIcon);
  const appIconHTML = appIconUri
    ? `<img class="popup-app-icon" src="${appIconUri}" alt="">`
    : '';

  const sfx = config.audio.sfxMap;
  const heroLeftFlip  = config.heroLeft.flipped  ? '' : 'scaleX(-1)';
  const heroRightFlip = config.heroRight.flipped ? '' : 'scaleX(-1)';

  // ── build JS injection values ─────────────────────────────────────
  const p0AtkW = p0.assets.attack ? Math.round(p0.displayWidth * 1.3) : p0.displayWidth;

  const allPlayersData = config.playerUnits.map(p => ({
    id: p.id,
    col: p.gridCol, row: p.gridRow, hp: p.hp, type: p.type,
    w: p.displayWidth,
    aw: p.assets.attack ? Math.round(p.displayWidth * 1.3) : p.displayWidth,
    moveRange: (p as any).moveRange ?? 2,
    baseDmg: p.baseDamage, dmgMult: p.damageMultiplier,
    idleImg: uri(p.assets.idle), atkImg: uri(p.assets.attack),
  }));

  const spellbookEnabled = (config as any).spellbookEnabled !== false;

  // enemies array for JS injection (includes defense for damage formula)
  const enemiesData = config.enemyUnits.map(e => ({
    id: e.id,
    col: e.gridCol,
    row: e.gridRow,
    hp: e.hp,
    type: e.type,
    resistTo: e.resistTo,
    defense: e.defense,
    moveRange: (e as any).moveRange ?? 2,
    w: e.displayWidth,
    aw: e.assets.attack ? Math.round(e.displayWidth * 1.3) : e.displayWidth,
    idleImg: uri(e.assets.idle),
    atkImg: uri(e.assets.attack),
  }));

  // alternating mode injection values
  const altCfg = config.scenario.alternating ?? { firstTurn: 'player', playerTurns: [], enemyTurns: [], attackReactions: [] };
  const altEnemyTurns = altCfg.enemyTurns.map(t => ({ id: t.id, unitId: t.attackerUnitId, action: t.action ?? 'attack', dmg: t.damage, speech: t.speechText, moveCol: t.moveTargetCol ?? 0, moveRow: t.moveTargetRow ?? 0 }));
  const altReactions  = altCfg.attackReactions.map(r => ({ unitId: r.enemyUnitId, ret: r.retaliates, dmg: r.retaliationDamage, speech: r.retaliationSpeech }));
  const altPlayerTurnsArr = (altCfg.playerTurns && altCfg.playerTurns.length)
    ? altCfg.playerTurns
    : [{ id: 'pt1', unitId: config.playerUnits[0]?.id ?? '' }];
  const pltIds = altPlayerTurnsArr.map(t => t.unitId).filter(Boolean);
  if (!pltIds.length && config.playerUnits.length) pltIds.push(config.playerUnits[0].id);

  // player units positions for init
  const playerInitJS = config.playerUnits.map((p, i) =>
    `if(playerEls[${i}])placeUnit(playerEls[${i}],${p.gridCol},${p.gridRow});`
  ).join('');

  // DOM arrays
  const enemyElsInit      = config.enemyUnits.map((_, i) => `$('unit-enemy-${i}')`).join(',');
  const enemyHpElsInit    = config.enemyUnits.map((_, i) => `$('enemy-${i}-hp')`).join(',');
  const enemyFlyerElsInit = config.enemyUnits.map((e, i) => e.assets.attack ? `$('enemy-flyer-${i}')` : 'null').join(',');
  const playerElsInit     = config.playerUnits.map((_, i) => `$('unit-player-${i}')`).join(',');

  // HTML sections
  const playerUnitsHTML = config.playerUnits.map((p, i) => `
  <div id="unit-player-${i}" class="unit">
    <img src="${uri(p.assets.idle)}" width="${p.displayWidth}" alt="${p.name}">
    <div class="hp-badge"><span id="player-${i}-hp">${p.hp}</span></div>
  </div>`).join('');

  const enemyUnitsHTML = config.enemyUnits.map((e, i) => `
  <div id="unit-enemy-${i}" class="unit">
    <img src="${uri(e.assets.idle)}" width="${e.displayWidth}" style="transform:scaleX(-1)" alt="${e.name}">
    <div class="hp-badge"><span id="enemy-${i}-hp">${e.hp}</span></div>
  </div>`).join('');

  const enemyFlyersHTML = config.enemyUnits
    .map((e, i) => e.assets.attack
      ? `  <img id="enemy-flyer-${i}" class="enemy-flyer" src="${uri(e.assets.attack)}" style="width:${Math.round(e.displayWidth * 1.3)}px;display:none;position:absolute;pointer-events:none;z-index:40;transform:scaleX(-1);" alt="">`
      : '')
    .filter(Boolean).join('\n');

  const spellsHTML = config.spells.map((sp, i) => `
      <div class="spell-btn" id="sp-spell${i}" data-spell="spell${i}">
        <img class="spell-img" src="${uri(sp.asset)}" alt="${sp.name}">
        <span class="spell-label">${sp.name}</span>
      </div>`).join('');

  const enemyUnitClicksJS = '';

  const atkIconsHTML = config.enemyUnits.map((_, i) =>
    `<div id="atk-icon-${i}" class="atk-icon"><img style="width:48px;height:48px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.8));" src="" alt=""></div>`
  ).join('\n  ');
  const atkIconElsInit = config.enemyUnits.map((_, i) => `$('atk-icon-${i}')`).join(',');

  const spSP_vars = config.spells.map((_, i) => `spSP${i}=$('sp-spell${i}')`).join(',');
  const spSP_reset = config.spells.map((_, i) => `if(spSP${i})spSP${i}.classList.remove('selected');`).join('');
  const spSP_addUsed = config.spells.map((_, idx) =>
    `if(sel==='spell${idx}'&&spSP${idx})spSP${idx}.classList.add('used');`).join('');
  const spSP_toggleSel = config.spells.map((_, i) =>
    `if(spSP${i})spSP${i}.classList.toggle('selected',id==='spell${i}');`).join('');
  const spSP_resetAll = config.spells.map((_, i) =>
    `if(spSP${i})spSP${i}.classList.remove('used','selected');`).join('');
  const spSP_events = config.spells.map((_, i) =>
    `if(spSP${i})spSP${i}.addEventListener('click',e=>{e.stopPropagation();selectSpell('spell${i}');});`).join('\n');
  const spellImgsJS = config.spells.map(sp => `'${uri(sp.asset)}'`).join(',');
  const spellElsJS  = config.spells.map(sp => `'${sp.element}'`).join(',');
  const spellShotSfx = config.spells.map((_, i) =>
    i === 0 ? 'SFX.spell0_shot' : i === 1 ? 'SFX.spell1_shot' : 'null').join(',');
  const spellHitSfx  = config.spells.map((_, i) =>
    i === 0 ? 'SFX.spell0_hit'  : i === 1 ? 'SFX.spell1_hit'  : 'null').join(',');

  // ── per-network ───────────────────────────────────────────────────
  const headExtra = {
    facebook:   `  <script>var FbPlayableAd=FbPlayableAd||{};FbPlayableAd.onCTAClick=FbPlayableAd.onCTAClick||function(){};</script>`,
    google:     `  <meta name="ad.size" content="width=1000,height=563">\n  <meta name="ad.orientation" content="landscape">\n  <script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>`,
    unity:      '',
    mintegral:  '',
  }[network];

  const audioVars = hasAudio ? `
  const SFX={
    sb_open:'${uri(sfx['spellbook_open'])}',sb_spell:'${uri(sfx['spell_select'])}',
    walk:'${uri(sfx['walk'])}',grid:'${uri(sfx['grid_select'])}',
    spell0_shot:'${uri(sfx['spell1_shoot'])}',spell0_hit:'${uri(sfx['spell1_hit'])}',
    spell1_shot:'${uri(sfx['spell2_shoot'])}',spell1_hit:'${uri(sfx['spell2_hit'])}',
    player_atk:'${uri(sfx['player_attack'])}',player_die:'${uri(sfx['player_death'])}',
    enemy0_atk:'${uri(sfx['flying_attack'])}',enemy0_die:'${uri(sfx['flying_death'])}',
    enemy1_atk:'${uri(sfx['ranged_attack'])}',enemy1_die:'${uri(sfx['ranged_death'])}',
    fail:'${uri(sfx['fail'])}',music:'${uri(config.audio.music)}',
  };` : '\n  const SFX={};';

  const audioEngine = hasAudio ? `
  let actx;const audioCache={};
  function getAudioCtx(){if(!actx){try{actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}return actx;}
  function playSound(dataUri,vol){
    vol=vol===undefined?1:vol;if(!dataUri)return;
    const ctx=getAudioCtx();if(!ctx)return;
    function doPlay(){
      if(audioCache[dataUri]){const src=ctx.createBufferSource(),g=ctx.createGain();g.gain.value=vol;src.buffer=audioCache[dataUri];src.connect(g).connect(ctx.destination);src.start();return;}
      const b64=dataUri.split(',')[1];if(!b64)return;
      const bin=atob(b64);const ab=new ArrayBuffer(bin.length);const u8=new Uint8Array(ab);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
      ctx.decodeAudioData(ab).then(buf=>{audioCache[dataUri]=buf;doPlay();}).catch(()=>{});
    }
    if(ctx.state==='suspended')ctx.resume().then(doPlay);else doPlay();
  }
  document.addEventListener('click',()=>{const c=getAudioCtx();if(c&&c.state==='suspended')c.resume();},{once:true});
  let musicStarted=false;
  function startMusic(){
    if(musicStarted||!SFX.music)return;musicStarted=true;
    const ctx=getAudioCtx();if(!ctx)return;
    const b64=SFX.music.split(',')[1];if(!b64)return;
    const bin=atob(b64);const ab=new ArrayBuffer(bin.length);const u8=new Uint8Array(ab);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
    ctx.decodeAudioData(ab).then(buf=>{
      const g=ctx.createGain();g.gain.value=0.3;
      const n=ctx.createBufferSource();n.buffer=buf;n.loop=true;n.connect(g).connect(ctx.destination);
      if(ctx.state==='suspended')ctx.resume().then(()=>n.start());else n.start();
    }).catch(()=>{});
  }` :
  `\n  function playSound(){}\n  function startMusic(){}`;

  const ctaFn = {
    facebook:  `function goStore(){if(typeof FbPlayableAd!=='undefined')FbPlayableAd.onCTAClick();}`,
    google:    `function goStore(){if(typeof ExitApi!=='undefined'){try{ExitApi.exit();}catch(e){}}else window.open('${storeAndroid}','_blank');}`,
    unity:     `function goStore(){const url=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'${storeIos}':'${storeAndroid}';if(typeof mraid!=='undefined'){try{mraid.open(url);}catch(e){}}else window.open(url,'_blank');}`,
    mintegral: `function goStore(){if(typeof window.install==='function')window.install();if(typeof window.gameEnd==='function')window.gameEnd();}`,
  }[network];

  const mraidBootstrap = network === 'unity' ? `
  (function(){var started=false;function tryStart(){if(started)return;started=true;initGame();}
  if(typeof mraid!=='undefined'){mraid.addEventListener('viewableChange',function(v){if(v)tryStart();else{if(actx)actx.suspend();}});mraid.addEventListener('exposureChange',function(o){if(o&&o.exposedPercentage>0)tryStart();});var s=mraid.getState();if(s==='loading'){mraid.addEventListener('ready',function(){if(mraid.isViewable())tryStart();});}else{if(mraid.isViewable())tryStart();}}else{window.mraid={open:function(u){window.open(u,'_blank');}};setTimeout(tryStart,0);}
  })();` : '';

  const mintegralBootstrap = network === 'mintegral' ? `
  window.gameStart=function(){if(typeof actx!=='undefined'&&actx&&actx.state==='suspended')actx.resume();};
  window.gameClose=function(){if(typeof actx!=='undefined'&&actx)actx.suspend();};
  window.addEventListener('load',function(){initGame();if(typeof actx!=='undefined'&&actx)actx.suspend();if(typeof window.gameReady==='function')window.gameReady();});` : '';

  const visLock = `
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){if(typeof actx!=='undefined'&&actx)actx.suspend();}
    else{${network==='mintegral'?'/* wait for gameStart() */':network==='unity'?"if(typeof actx!=='undefined'&&actx&&typeof mraid!=='undefined'&&mraid.isViewable())actx.resume();":"if(typeof actx!=='undefined'&&actx)actx.resume();"}}
  });`;

  const rpFooter = network === 'google' ? `
  <div style="position:fixed;bottom:4px;left:0;right:0;text-align:center;font-size:10px;color:rgba(255,255,255,.6);pointer-events:none;z-index:9999;">
    18+ | Play Responsibly | gamblingtherapy.org
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Battle</title>
${headExtra}
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;user-select:none;}
html,body{width:100%;height:100%;overflow:hidden;background:#000;touch-action:none;position:fixed;top:0;left:0;right:0;bottom:0;}
#viewport{position:fixed;${network==='google'?'width:1000px;height:563px;':''}transform-origin:top left;overflow:hidden;}
#bg{position:absolute;inset:0;background:url('${uri(config.backgrounds.landscape)}') center/cover no-repeat;}
.portrait #bg{background-image:url('${uri(config.backgrounds.portrait)}');}
#hero-left{position:absolute;left:${config.heroLeft.posX}px;top:${config.heroLeft.posY}px;width:128px;pointer-events:none;z-index:5;${heroLeftFlip ? `transform:${heroLeftFlip};` : ''}}
#hero-right{position:absolute;right:${config.heroRight.posX}px;top:${config.heroRight.posY}px;width:128px;pointer-events:none;z-index:5;${heroRightFlip ? `transform:${heroRightFlip};` : ''}}
.portrait #hero-left,.portrait #hero-right{display:none;}
#speech-bubble{position:absolute;top:${sbLandY}px;left:${sbLandX}px;width:310px;background:rgba(255,255,255,.95);border-radius:14px;padding:10px 14px;font-family:Arial,sans-serif;font-size:${sbLandFS}px;color:#222;line-height:1.5;box-shadow:0 4px 16px rgba(0,0,0,.45);display:none;z-index:30;pointer-events:none;}
.portrait #speech-bubble{left:${sbPortX}px;top:${sbPortY}px;font-size:${sbPortFS}px;width:535px;}
#speech-bubble::before{content:'';position:absolute;left:-12px;top:18px;border:7px solid transparent;border-right-color:rgba(255,255,255,.95);}
#grid{position:absolute;left:0;top:0;}
.hex{position:absolute;width:var(--hw,120px);height:var(--hh,80px);background:url('${uri(config.gridTiles.walkable)}') center/100% 100% no-repeat;opacity:.5;cursor:pointer;transition:opacity .12s,filter .12s;}
.hex:hover{opacity:.75;}
.hex.selected{background-image:url('${uri(config.gridTiles.active)}');background-size:cover;opacity:1;}
.hex.reachable{opacity:.9;filter:brightness(1.5) saturate(1.4);}
.hex.targetable{opacity:1;filter:brightness(1.6) hue-rotate(80deg) saturate(3);animation:targetPulse .7s ease-in-out infinite alternate;}
.hex.enemy-hex{background-image:url('${uri(config.gridTiles.active)}');background-size:cover;filter:hue-rotate(200deg) saturate(2.5) brightness(1.3);opacity:.85;}
@keyframes targetPulse{from{filter:brightness(1.4) hue-rotate(80deg) saturate(3);}to{filter:brightness(2) hue-rotate(120deg) saturate(4);}}
.unit{position:absolute;transform:translate(-50%,-88%);pointer-events:none;z-index:10;transition:left .42s cubic-bezier(.4,0,.2,1),top .42s cubic-bezier(.4,0,.2,1);}
.unit img{display:block;pointer-events:auto;}
.unit img[src=""]{min-width:60px;min-height:80px;background:rgba(150,150,200,.18);border:2px dashed rgba(150,150,200,.5);border-radius:8px;}
.unit.dead{opacity:0;transform:translate(-50%,-88%) scale(.3) rotate(-15deg);transition:all .55s ease;}
.unit.shake{animation:shakeUnit .35s ease;}
@keyframes shakeUnit{0%,100%{transform:translate(-50%,-88%)}20%{transform:translate(-42%,-88%)}60%{transform:translate(-58%,-88%)}}
@keyframes hopUnit{0%,100%{transform:translate(-50%,-88%)}45%{transform:translate(-50%,-102%)}}
.unit.hop{animation:hopUnit .36s ease-out;}
.unit.active-player::after{content:'';position:absolute;left:50%;bottom:-28px;transform:translateX(-50%);width:36px;height:3px;background:#4af;border-radius:2px;box-shadow:0 0 8px rgba(64,170,255,.8);}
.hp-badge{position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);background:rgba(10,10,20,.8);color:#fff;font-family:'Arial Black',Arial,sans-serif;font-size:12px;font-weight:900;padding:2px 8px;border-radius:10px;border:1.5px solid #8cf;white-space:nowrap;pointer-events:none;z-index:20;}
.hp-badge.flash{animation:hpFlash .4s ease;}
@keyframes hpFlash{0%,100%{background:rgba(10,10,20,.8)}50%{background:rgba(200,30,30,.9);border-color:#f44;}}
.enemy-flyer{position:absolute;pointer-events:none;z-index:40;}
.float-text{position:absolute;font-family:'Arial Black',Arial,sans-serif;font-size:26px;font-weight:900;pointer-events:none;z-index:55;text-shadow:2px 2px 4px #000,0 0 8px #000;animation:floatUp 1.5s ease forwards;}
.float-text.critical{color:#00e8ff;font-size:30px;text-shadow:0 0 14px #0af,2px 2px 5px #000;}
.float-text.resist{color:#ffaa00;font-size:26px;text-shadow:0 0 12px #f60,2px 2px 4px #000;}
.float-text.damage{color:#ff5555;}
@keyframes floatUp{0%{opacity:1;transform:translateY(0) scale(1.25)}55%{opacity:1;transform:translateY(-52px) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(.8)}}
#spell-proj{position:absolute;width:60px;height:60px;background-size:contain;background-repeat:no-repeat;background-position:center;pointer-events:none;z-index:42;display:none;}
#arrow{position:absolute;width:36px;height:36px;pointer-events:none;z-index:28;display:none;}
#arrow.visible{display:block;animation:bounceArrow .75s ease-in-out infinite;}
@keyframes bounceArrow{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
#spellbook-area{position:absolute;left:14px;bottom:38px;z-index:22;display:flex;align-items:center;gap:10px;}
#spellbook-btn{width:86px;height:86px;cursor:pointer;flex-shrink:0;transition:transform .18s;}
#spellbook-btn:hover{transform:scale(1.09);}
#spellbook-btn img{width:100%;height:100%;}
#spells-panel{display:none;flex-direction:row;gap:8px;align-items:center;}
.spell-btn{width:78px;height:78px;position:relative;cursor:pointer;transition:transform .15s,filter .15s;}
.spell-btn:not(.used):hover{transform:scale(1.1);}
.spell-btn.used{opacity:.35;pointer-events:none;}
.spell-img{width:100%;height:100%;border-radius:8px;border:3px solid #4af;box-shadow:0 0 10px rgba(0,180,255,.6);display:block;}
.spell-btn.selected .spell-img{border-color:#ffe600;box-shadow:0 0 18px rgba(255,230,0,.8);}
.spell-label{position:absolute;bottom:-17px;left:50%;transform:translateX(-50%);color:#fff;font-size:11px;font-weight:700;white-space:nowrap;text-shadow:1px 1px 3px #000;}
.death-burst{position:absolute;border-radius:50%;pointer-events:none;z-index:48;animation:burstPop .65s ease forwards;}
@keyframes burstPop{0%{opacity:1;transform:translate(-50%,-50%) scale(0)}45%{opacity:.9;transform:translate(-50%,-50%) scale(1.6)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.8)}}
.overlay{position:absolute;inset:0;z-index:100;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.7);}
.overlay.show{display:flex;}
.popup-wrap{position:relative;width:360px;text-align:center;}
.popup-banner{width:100%;display:block;position:relative;z-index:2;}
.popup-board{width:100%;display:block;margin-top:-20px;position:relative;z-index:1;}
.popup-btn{display:block;margin:10px auto 0;width:210px;cursor:pointer;transition:transform .14s;position:relative;z-index:2;}
.popup-btn:hover{transform:scale(1.07);}
.popup-app-icon{width:72px;height:72px;border-radius:16px;display:block;margin:8px auto 0;position:relative;z-index:2;box-shadow:0 4px 16px rgba(0,0,0,.5);}
.atk-icon{position:absolute;pointer-events:auto;z-index:62;display:none;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .12s;}
.atk-icon:hover{transform:scale(1.18);}
#fail-hint{position:absolute;top:${hintLandY}px;left:50%;transform:translateX(-50%);width:270px;color:${hDefeatColor};font-family:Arial,sans-serif;font-size:${hintLandFS}px;line-height:1.55;text-align:center;text-shadow:1px 1px 4px #000,0 0 8px rgba(0,0,0,.8);z-index:3;}
.portrait #fail-hint{top:${hintPortY}px;font-size:${hintPortFS}px;}
</style>
</head>
<body>
<div id="viewport">
  <div id="bg"></div>
  <img id="hero-left"  src="${uri(config.heroLeft.asset)}"  alt="">
  <img id="hero-right" src="${uri(config.heroRight.asset)}" alt="">
  <div id="speech-bubble"></div>
  <div id="grid"></div>
  ${playerUnitsHTML}
  ${enemyUnitsHTML}
  ${enemyFlyersHTML}
  <div id="spell-proj"></div>
  <div id="arrow"></div>
  ${atkIconsHTML}
  <div id="spellbook-area">
    <div id="spellbook-btn"><img id="sb-icon" src="${sbClosedUri}" alt="Spellbook"></div>
    <div id="spells-panel">${spellsHTML}
    </div>
  </div>
  <div class="overlay" id="fail-screen">
    <div class="popup-wrap">
      <img class="popup-banner" src="${uri(config.popups.defeat.bannerAsset)}" alt="">
      <img class="popup-board"  src="${uri(config.popups.defeat.boardAsset)}"  alt="">
      ${appIconHTML}
      <p id="fail-hint"></p>
      <img id="retry-btn" class="popup-btn" src="${uri(config.popups.defeat.retryButtonAsset)}" alt="Try Again">
      <img id="store-btn" class="popup-btn" src="${uri(config.popups.defeat.storeButtonAsset)}" alt="Play Full Game" style="display:none">
    </div>
  </div>
  <div class="overlay" id="win-screen">
    <div class="popup-wrap">
      <img class="popup-banner" src="${uri(config.popups.victory.bannerAsset)}" alt="">
      <img class="popup-board"  src="${uri(config.popups.victory.boardAsset)}"  alt="">
      ${appIconHTML}
      <img id="win-cta" class="popup-btn" src="${uri(config.popups.victory.ctaButtonAsset)}" alt="Play Now">
    </div>
  </div>
</div>
${rpFooter}
<script>
'use strict';
${audioVars}

// ─── GRID ───
const COLS=5,ROWS=4;
const LAYOUT={
  land:{vpW:1000,vpH:563,gx0:240,gy0:${275+gridOffsetLand},hexW:120,hexH:80,colSp:120,rowSp:60,oddDx:60},
  port:{vpW:563,vpH:1000,gx0:79,gy0:${420+gridOffsetPort},hexW:90,hexH:60,colSp:90,rowSp:45,oddDx:45},
};
let cur=LAYOUT.land;
function hexCenter(col,row){return{x:cur.gx0+col*cur.colSp+(row%2===1?cur.oddDx:0),y:cur.gy0+row*cur.rowSp};}
function toCube(col,row){const x=col-(row-(row&1))/2,z=row;return{x,y:-x-z,z};}
function hexDist(c1,r1,c2,r2){const a=toCube(c1,r1),b=toCube(c2,r2);return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.z-b.z));}

// ─── CONFIG (injected) ───
const ENEMIES=${JSON.stringify(enemiesData)};
const SPELL_ELS=[${spellElsJS}];
const SPELL_IMGS=[${spellImgsJS}];
const SPELL_SHOT_SFX=[${spellShotSfx}];
const SPELL_HIT_SFX=[${spellHitSfx}];
const PLAYER_HP_INIT=${p0.hp},PLAYER_W=${p0.displayWidth},PLAYER_ATK_W=${p0AtkW};
const PLAYER_BASE_DMG=${p0.baseDamage},PLAYER_DMG_MULT=${p0.damageMultiplier};
const PLAYER_TYPE='${p0.type}';
const PLAYER_START_COL=${p0.gridCol},PLAYER_START_ROW=${p0.gridRow};
const IMG_P0_IDLE='${uri(p0.assets.idle)}',IMG_P0_ATK='${uri(p0.assets.attack)}';
const IMG_SB_CLOSED='${sbClosedUri}',IMG_SB_OPEN='${sbOpenUri}';
const RETALIATIONS=${JSON.stringify(retaliationsData)};
const CTA_FAIL_COUNT=${ctaFailCount};
const HINTS_MOVE_FLY=${JSON.stringify(hintMoveToFlying)};
const HINTS_RANGED_FIRST=${JSON.stringify(hintKillRangedFirst)};
const HINTS_WRONG_FLY=${JSON.stringify(hintWrongSpellFly)};
const HINTS_WASTED=${JSON.stringify(hintWastedSpell)};
const ATTACK_ICON_MELEE='${meleeIconUri}';
const ATTACK_ICON_RANGED='${rangedIconUri}';
const ATTACK_ICON_FLYING='${flyingIconUri}';
const SCENARIO_MODE='${config.scenario.mode}';
const ALT_FIRST='${altCfg.firstTurn}';
const ALT_ENEMY_TURNS=${JSON.stringify(altEnemyTurns)};
const ALT_REACTIONS=${JSON.stringify(altReactions)};
const ALL_PLAYERS=${JSON.stringify(allPlayersData)};
const PLT_IDS=${JSON.stringify(pltIds)};
const SPELLBOOK_ENABLED=${spellbookEnabled};

// ─── STATE ───
const spellUsedInit={};SPELL_ELS.forEach((_,i)=>spellUsedInit['spell'+i]=false);
let gs={state:'intro',turn:1,failCount:0,playerHP:PLAYER_HP_INIT,
  enemyHP:ENEMIES.map(e=>e.hp),enemyAlive:ENEMIES.map(()=>true),
  spellUsed:{...spellUsedInit},selSpell:null,sbOpen:false,
  pCol:PLAYER_START_COL,pRow:PLAYER_START_ROW,
  allPlayerHP:ALL_PLAYERS.map(p=>p.hp),
  allPlayerAlive:ALL_PLAYERS.map(()=>true),
  allPlayerPos:ALL_PLAYERS.map(p=>({col:p.col,row:p.row})),
  altPlayerTurnIdx:0};
let altTurnIdx=0;

// ─── DOM ───
const $=id=>document.getElementById(id);
const vp=$('viewport'),gridEl=$('grid'),speechBub=$('speech-bubble');
const playerEls=[${playerElsInit}];
const enemyEls=[${enemyElsInit}];
const enemyHpEls=[${enemyHpElsInit}];
const enemyFlyerEls=[${enemyFlyerElsInit}];
const spellProj=$('spell-proj'),arrowEl=$('arrow');
const sbArea=$('spellbook-area'),sbPanel=$('spells-panel'),sbBtn=$('spellbook-btn'),sbIcon=$('sb-icon');
const ${spSP_vars};
const failScr=$('fail-screen'),winScr=$('win-screen');
const playerHpEl=$('player-0-hp');
const playerHpEls=[${config.playerUnits.map((_,i)=>`$('player-${i}-hp')`).join(',')}];
const retryBtn=$('retry-btn'),storeBtn=$('store-btn');

// ─── VIEWPORT ───
function resize(){
  ${network==='google'
    ? `const s=Math.min(window.innerWidth/cur.vpW,window.innerHeight/cur.vpH);vp.style.transform='scale('+s+')';vp.style.left=((window.innerWidth-cur.vpW*s)/2)+'px';vp.style.top=((window.innerHeight-cur.vpH*s)/2)+'px';`
    : `const isPort=window.innerHeight>window.innerWidth;const next=isPort?LAYOUT.port:LAYOUT.land;const changed=next!==cur;cur=next;vp.style.width=cur.vpW+'px';vp.style.height=cur.vpH+'px';vp.classList.toggle('portrait',isPort);const s=Math.min(window.innerWidth/cur.vpW,window.innerHeight/cur.vpH);vp.style.transform='scale('+s+')';vp.style.left=((window.innerWidth-cur.vpW*s)/2)+'px';vp.style.top=((window.innerHeight-cur.vpH*s)/2)+'px';if(changed&&typeof gs!=='undefined')refreshLayout();`}
}
window.addEventListener('resize',resize);

${audioEngine}

// ─── ACTIVE PLAYER ───
function activePlayerIdx(){const id=PLT_IDS[gs.altPlayerTurnIdx%PLT_IDS.length];const i=ALL_PLAYERS.findIndex(p=>p.id===id);return i>=0?i:0;}
function updateActiveIndicator(){if(SCENARIO_MODE!=='alternating')return;playerEls.forEach((el,i)=>{if(el)el.classList.toggle('active-player',i===activePlayerIdx()&&gs.allPlayerAlive[i]);});}
let lastHoppedIdx=-1;
function hopPlayer(pi){
  const el=playerEls[pi];if(!el)return;
  el.classList.remove('hop');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.classList.add('hop');setTimeout(()=>{if(el)el.classList.remove('hop');},400);}));
}

// ─── GRID BUILD ───
const hexEls={};
function buildGrid(){gridEl.innerHTML='';for(const k in hexEls)delete hexEls[k];vp.style.setProperty('--hw',cur.hexW+'px');vp.style.setProperty('--hh',cur.hexH+'px');for(let col=0;col<COLS;col++)for(let row=0;row<ROWS;row++){if(col===COLS-1&&row%2===1)continue;const{x,y}=hexCenter(col,row);const d=document.createElement('div');d.className='hex';d.dataset.col=col;d.dataset.row=row;d.style.left=(x-cur.hexW/2)+'px';d.style.top=(y-cur.hexH/2)+'px';d.addEventListener('click',onHexClick);gridEl.appendChild(d);hexEls[col+','+row]=d;}}
function clearHex(){for(const h of Object.values(hexEls))h.className='hex';}
function findEnemyAt(c,r){return ENEMIES.findIndex((e,i)=>gs.enemyAlive[i]&&e.col===c&&e.row===r);}
function findPlayerAt(c,r){return gs.allPlayerAlive.findIndex((alive,i)=>alive&&gs.allPlayerPos[i].col===c&&gs.allPlayerPos[i].row===r);}
function occupied(c,r){return findEnemyAt(c,r)>=0||findPlayerAt(c,r)>=0;}
// Returns the hex adjacent to enemy (ec,er) that is geometrically closest to (pc,pr)
// Used for animations (flying, retaliation) — ignores occupancy
function nearestAdjacentTo(ec,er,pc,pr){
  const nb=er%2===0
    ?[[ec-1,er],[ec+1,er],[ec-1,er-1],[ec,er-1],[ec-1,er+1],[ec,er+1]]
    :[[ec-1,er],[ec+1,er],[ec,er-1],[ec+1,er-1],[ec,er+1],[ec+1,er+1]];
  let best=[Math.max(0,ec-1),er],bestD=999;
  for(const[c,r]of nb){
    if(c<0||r<0||c>=COLS||r>=ROWS)continue;
    if(c===COLS-1&&r%2===1)continue;
    const d=hexDist(pc,pr,c,r);
    if(d<bestD){bestD=d;best=[c,r];}
  }
  return best;
}
// Returns the best adjacent hex to attack enemy at (ec,er) from (pc,pr) within moveRange mr.
// Checks all neighbours, skips occupied hexes, returns null if nothing reachable.
function findAttackHex(ec,er,pc,pr,mr){
  const nb=er%2===0
    ?[[ec-1,er],[ec+1,er],[ec-1,er-1],[ec,er-1],[ec-1,er+1],[ec,er+1]]
    :[[ec-1,er],[ec+1,er],[ec,er-1],[ec+1,er-1],[ec,er+1],[ec+1,er+1]];
  let best=null,bestD=999;
  for(const[c,r]of nb){
    if(c<0||r<0||c>=COLS||r>=ROWS)continue;
    if(c===COLS-1&&r%2===1)continue;
    if(occupied(c,r))continue;
    const d=hexDist(pc,pr,c,r);
    if(d<=mr&&d<bestD){bestD=d;best=[c,r];}
  }
  return best;
}
// Returns the reachable hex within maxRange that is closest to (tc,tr)
function findBestMoveToward(ec,er,tc,tr,maxRange){
  let bestC=ec,bestR=er,bestDist=hexDist(ec,er,tc,tr);
  for(let dc=-maxRange;dc<=maxRange;dc++){for(let dr=-maxRange;dr<=maxRange;dr++){
    const nc=ec+dc,nr=er+dr;
    if(nc<0||nr<0||nc>=COLS||nr>=ROWS)continue;
    if(nc===COLS-1&&nr%2===1)continue;
    if(nc===ec&&nr===er)continue;
    if(hexDist(ec,er,nc,nr)>maxRange)continue;
    if(occupied(nc,nr))continue;
    const d=hexDist(nc,nr,tc,tr);
    if(d<bestDist){bestDist=d;bestC=nc;bestR=nr;}
  }}
  return[bestC,bestR];
}
function animateEnemyMoveAlt(eIdx,toCol,toRow,cb){
  const e=ENEMIES[eIdx];const el=enemyEls[eIdx];
  const dst=hexCenter(toCol,toRow);
  if(el){el.style.transition='left .4s ease,top .4s ease';el.style.left=dst.x+'px';el.style.top=dst.y+'px';el.style.zIndex=String(10+toRow*2);}
  e.col=toCol;e.row=toRow;
  setTimeout(()=>{if(el)el.style.transition='';if(cb)cb();},420);
}
function highlightMove(){
  clearHex();
  const pi=activePlayerIdx();const ap=gs.allPlayerPos[pi];const mr=ALL_PLAYERS[pi].moveRange;
  const k=hexEls[ap.col+','+ap.row];if(k)k.classList.add('selected');
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
    if(!hexEls[c+','+r])continue;if(c===ap.col&&r===ap.row)continue;
    const eIdx=findEnemyAt(c,r);
    if(eIdx>=0){hexEls[c+','+r].classList.add('enemy-hex');continue;}
    if(hexDist(ap.col,ap.row,c,r)<=mr)hexEls[c+','+r].classList.add('reachable');
  }
  updateActiveIndicator();
  if(pi!==lastHoppedIdx){lastHoppedIdx=pi;hopPlayer(pi);}
  showAllAttackIcons();
}
function highlightTargets(){clearHex();hideAllAttackIcons();ENEMIES.forEach((e,i)=>{if(gs.enemyAlive[i]){const h=hexEls[e.col+','+e.row];if(h)h.classList.add('targetable');}});}

// ─── PLACEMENT ───
function placeUnit(el,col,row){if(!el)return;const{x,y}=hexCenter(col,row);el.style.left=x+'px';el.style.top=y+'px';el.style.zIndex=String(10+row*2);}

// ─── HP / EFFECTS ───
function setPlayerHP(val){
  val=Math.max(0,val);gs.playerHP=val;
  const pi=activePlayerIdx();gs.allPlayerHP[pi]=val;
  if(playerHpEls[pi])playerHpEls[pi].textContent=val;
  flashBadge(playerEls[pi]);
}
function setEnemyHP(idx,val){val=Math.max(0,val);gs.enemyHP[idx]=val;if(enemyHpEls[idx])enemyHpEls[idx].textContent=val;}
function flashBadge(u){if(!u)return;const b=u.querySelector('.hp-badge');b.classList.remove('flash');requestAnimationFrame(()=>requestAnimationFrame(()=>b.classList.add('flash')));setTimeout(()=>b.classList.remove('flash'),450);}
function floatText(text,x,y,cls){const el=document.createElement('div');el.className='float-text '+(cls||'');el.textContent=text;el.style.left=(x-24)+'px';el.style.top=(y-70)+'px';vp.appendChild(el);setTimeout(()=>el.remove(),1600);}
function deathBurst(x,y,color){const el=document.createElement('div');el.className='death-burst';el.style.cssText='left:'+x+'px;top:'+y+'px;width:100px;height:100px;background:radial-gradient(circle,'+color+' 0%,transparent 70%);';vp.appendChild(el);setTimeout(()=>el.remove(),700);}

// ─── SPEECH / ARROW ───
let speechTimer=null;
function showSpeech(html,autohide){speechBub.innerHTML=html;speechBub.style.display='block';if(speechTimer)clearTimeout(speechTimer);if(autohide>0)speechTimer=setTimeout(hideSpeech,autohide);}
function hideSpeech(){speechBub.style.display='none';}
function showArrow(col,row){const{x,y}=hexCenter(col,row);arrowEl.style.left=(x-18)+'px';arrowEl.style.top=(y-110)+'px';arrowEl.classList.add('visible');}
function hideArrow(){arrowEl.classList.remove('visible');}

// ─── ATTACK ICONS (per-enemy) ───
const atkIconEls=[${atkIconElsInit}];
function showAllAttackIcons(){
  if(gs.state!=='player_turn')return;
  const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];
  const src=ap.type==='ranged'?ATTACK_ICON_RANGED:ap.type==='flying'?ATTACK_ICON_FLYING:ATTACK_ICON_MELEE;
  ENEMIES.forEach((e,i)=>{
    const el=atkIconEls[i];if(!el)return;
    if(!gs.enemyAlive[i]||!src){el.style.display='none';return;}
    const img=el.querySelector('img');if(img)img.src=src;
    const{x,y}=hexCenter(e.col,e.row);
    el.style.left=(x-24)+'px';el.style.top=(y-90)+'px';
    el.style.display='block';
  });
}
function hideAllAttackIcons(){atkIconEls.forEach(el=>{if(el)el.style.display='none';});}
function showOutOfReach(){showSpeech('Unit is out of reach!',1800);}

// ─── ANIMATIONS ───
function animateSpell(spellIdx,x1,y1,x2,y2,cb){
  const img=spellIdx>=0?(SPELL_IMGS[spellIdx]||''):'';
  spellProj.style.backgroundImage=img?'url(\\''+img+'\\')':'';
  spellProj.style.background=img?'':'radial-gradient(circle,rgba(255,220,80,.9) 0%,transparent 70%)';
  spellProj.style.transition='none';spellProj.style.left=(x1-30)+'px';spellProj.style.top=(y1-30)+'px';spellProj.style.display='block';
  if(spellIdx>=0)playSound(SPELL_SHOT_SFX[spellIdx]);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    spellProj.style.transition='left .38s ease-in,top .38s ease-in';spellProj.style.left=(x2-30)+'px';spellProj.style.top=(y2-30)+'px';
    setTimeout(()=>{spellProj.style.display='none';if(spellIdx>=0)playSound(SPELL_HIT_SFX[spellIdx]);if(cb)cb();},420);
  }));
}
function playerFlyAttack(eIdx,dmg,cb){
  const pi=activePlayerIdx();const pEl=playerEls[pi];const ap=ALL_PLAYERS[pi];
  const e=ENEMIES[eIdx];
  const orig=gs.allPlayerPos[pi];
  const [dc,dr]=nearestAdjacentTo(e.col,e.row,orig.col,orig.row);
  const dst=hexCenter(dc,dr);
  gs.allPlayerPos[pi]={col:dc,row:dr};gs.pCol=dc;gs.pRow=dr;
  const img=pEl&&pEl.querySelector('img');
  if(img&&ap.atkImg){img.src=ap.atkImg;img.width=ap.aw;}
  playSound(SFX.player_atk);
  if(pEl){pEl.style.transition='left .28s ease-in,top .28s ease-in';pEl.style.left=dst.x+'px';pEl.style.top=dst.y+'px';}
  setTimeout(()=>{
    if(pEl)pEl.style.transition='';
    if(img&&ap.idleImg){img.src=ap.idleImg;img.width=ap.w;}
    applyDamageToEnemy(eIdx,dmg,cb);
  },300);
}
function animateEnemyCharge(idx,cb){
  const e=ENEMIES[idx];const flyer=enemyFlyerEls[idx];
  if(!flyer){if(cb)cb();return;}
  const pi=activePlayerIdx();const apos=gs.allPlayerPos[pi];
  const src=hexCenter(e.col,e.row),dst=hexCenter(apos.col,apos.row);
  flyer.style.transition='none';flyer.style.left=(src.x-e.aw/2)+'px';flyer.style.top=(src.y-48)+'px';flyer.style.display='block';flyer.style.opacity='1';
  playSound(SFX.enemy0_atk);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    flyer.style.transition='left .42s ease-in,top .42s ease-in';flyer.style.left=(dst.x-e.aw/2)+'px';flyer.style.top=(dst.y-48)+'px';
    setTimeout(()=>{flyer.style.display='none';if(cb)cb();},460);
  }));
}
function killUnit(el,x,y,color,sfxKey,cb){deathBurst(x,y,color);playSound(SFX[sfxKey]||null);setTimeout(()=>{if(el)el.classList.add('dead');if(cb)setTimeout(cb,580);},250);}
function killEnemy(idx,cb){
  gs.enemyAlive[idx]=false;if(atkIconEls[idx])atkIconEls[idx].style.display='none';
  const e=ENEMIES[idx];const{x,y}=hexCenter(e.col,e.row);
  killUnit(enemyEls[idx],x,y,'#ff6600',e.type==='flying'?'enemy0_die':'enemy1_die',cb);
}
function shakeUnit(el,cb){if(!el)return;el.classList.remove('shake');requestAnimationFrame(()=>requestAnimationFrame(()=>{el.classList.add('shake');setTimeout(()=>{if(el)el.classList.remove('shake');if(cb)cb();},370);}));}
function doRetaliation(killedId,cb){
  const ret=RETALIATIONS.find(r=>r.killerId===killedId);
  if(!ret||ret.damage<=0){if(cb)cb();return;}
  const retIdx=ENEMIES.findIndex(en=>en.id===ret.retaliatorId);
  if(retIdx<0||!gs.enemyAlive[retIdx]){if(cb)cb();return;}
  const retEnemy=ENEMIES[retIdx];const retEl=enemyEls[retIdx];
  setTimeout(()=>{
    if(ret.speech)showSpeech(ret.speech,1800);
    const pi=activePlayerIdx();const apos=gs.allPlayerPos[pi];
    const pc=hexCenter(apos.col,apos.row);
    const applyHit=()=>{
      setPlayerHP(gs.allPlayerHP[pi]-ret.damage);
      floatText('-'+ret.damage,pc.x,pc.y-40,'damage');
      shakeUnit(playerEls[pi],()=>{
        if(gs.allPlayerHP[pi]<=0){playerDies(ret.followUp||'');return;}
        gs.state='player_turn';highlightMove();
        if(ret.followUp)showSpeech(ret.followUp,2200);
      });
    };
    if(retEnemy.type==='flying'){
      animateEnemyCharge(retIdx,applyHit);
    } else if(retEnemy.type==='melee'){
      const retDist=hexDist(retEnemy.col,retEnemy.row,apos.col,apos.row);
      if(retDist>(retEnemy.moveRange??2)+1){if(cb)cb();return;}
      const src=hexCenter(retEnemy.col,retEnemy.row);
      const[adjC,adjR]=nearestAdjacentTo(apos.col,apos.row,retEnemy.col,retEnemy.row);
      const dst=hexCenter(adjC,adjR);
      if(retEl){retEl.style.transition='left .35s ease-in,top .35s ease-in';retEl.style.left=dst.x+'px';retEl.style.top=dst.y+'px';}
      playSound(SFX.enemy1_atk);
      setTimeout(()=>{
        if(retEl)retEl.classList.add('shake');
        setTimeout(()=>{
          if(retEl){retEl.classList.remove('shake');retEl.style.transition='left .35s ease-in,top .35s ease-in';retEl.style.left=src.x+'px';retEl.style.top=src.y+'px';}
          applyHit();
          setTimeout(()=>{if(retEl)retEl.style.transition='';},380);
        },370);
      },360);
    } else {
      if(retEl){retEl.classList.add('shake');playSound(SFX.enemy1_atk);}
      setTimeout(()=>{if(retEl)retEl.classList.remove('shake');applyHit();},400);
    }
  },600);
}
function movePlayerTo(col,row,cb){
  const pi=activePlayerIdx();
  gs.allPlayerPos[pi]={col,row};gs.pCol=col;gs.pRow=row;
  placeUnit(playerEls[pi],col,row);playSound(SFX.walk);
  setTimeout(()=>{if(cb)cb();},460);
}
function playerSwingAttack(cb){
  const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];
  const img=playerEls[pi]&&playerEls[pi].querySelector('img');
  if(img&&ap.atkImg){img.src=ap.atkImg;img.width=ap.aw;}
  playSound(SFX.player_atk);
  setTimeout(()=>{if(img&&ap.idleImg){img.src=ap.idleImg;img.width=ap.w;}if(cb)cb();},420);
}

// ─── ENEMY ATTACK ───
function enemyAttack(idx,hint){
  const e=ENEMIES[idx];
  const getHitPos=()=>{const pi=activePlayerIdx();const ap=gs.allPlayerPos[pi];return hexCenter(ap.col,ap.row);};
  if(e.type==='flying'){
    animateEnemyCharge(idx,()=>{
      const{x,y}=getHitPos();floatText('CRITICAL HIT!',x,y-40,'critical');deathBurst(x,y,'#ff4400');playerDies(hint);
    });
  } else {
    const el=enemyEls[idx];if(el){el.classList.add('shake');playSound(SFX.enemy1_atk);}
    setTimeout(()=>{
      if(el)el.classList.remove('shake');
      const{x,y}=getHitPos();floatText('CRITICAL HIT!',x,y-40,'critical');deathBurst(x,y,'#ff4400');playerDies(hint);
    },400);
  }
}

// ─── FAIL / WIN ───
function doFail(hint){
  gs.failCount++;gs.state='fail';$('fail-hint').innerHTML=hint;
  retryBtn.style.display=gs.failCount<CTA_FAIL_COUNT?'':'none';storeBtn.style.display=gs.failCount>=CTA_FAIL_COUNT?'':'none';
  failScr.classList.add('show');playSound(SFX.fail);
}
function playerDies(hint){
  const pi=activePlayerIdx();
  setPlayerHP(0);gs.allPlayerAlive[pi]=false;
  shakeUnit(playerEls[pi],()=>{
    const pos=gs.allPlayerPos[pi];const{x,y}=hexCenter(pos.col,pos.row);
    killUnit(playerEls[pi],x,y,'#ff4400','player_die',()=>{
      if(SCENARIO_MODE==='alternating'&&gs.allPlayerAlive.some(Boolean)){
        gs.altPlayerTurnIdx++;
        let safe=0;while(safe++<ALL_PLAYERS.length&&!gs.allPlayerAlive[activePlayerIdx()])gs.altPlayerTurnIdx++;
        setTimeout(()=>{gs.state='player_turn';highlightMove();},350);
      } else {
        setTimeout(()=>doFail(hint),350);
      }
    });
  });
}
function checkWin(){
  if(!gs.enemyAlive.some(Boolean)){setTimeout(doWin,500);}
  else if(SCENARIO_MODE==='alternating'){setTimeout(runEnemyTurns,400);}
  else{gs.state='player_turn';highlightMove();}
}
function doWin(){gs.state='win';clearHex();winScr.classList.add('show');$('win-cta').addEventListener('click',goStore);}

// ─── ALTERNATING MODE ───
function calcDamage(baseDmg,mult,def){return Math.max(1,Math.floor(baseDmg*mult-def));}

function playerAttackAlt(eIdx,cb){
  const e=ENEMIES[eIdx];
  const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];
  const dmg=calcDamage(ap.baseDmg,ap.dmgMult,e.defense||0);
  const{x,y}=hexCenter(e.col,e.row);
  hideAllAttackIcons();
  if(ap.type==='ranged'){
    const apos=gs.allPlayerPos[pi];const from=hexCenter(apos.col,apos.row);
    const img=playerEls[pi]&&playerEls[pi].querySelector('img');
    if(img&&ap.atkImg){img.src=ap.atkImg;img.width=ap.aw;}
    animateSpell(-1,from.x,from.y-30,x,y-30,()=>{
      if(img&&ap.idleImg){img.src=ap.idleImg;img.width=ap.w;}
      applyDamageToEnemy(eIdx,dmg,cb);
    });
  } else if(ap.type==='flying'){
    playerFlyAttack(eIdx,dmg,cb);
  } else {
    playerSwingAttack(()=>{applyDamageToEnemy(eIdx,dmg,cb);});
  }
}

function applyDamageToEnemy(eIdx,dmg,cb){
  const e=ENEMIES[eIdx];const{x,y}=hexCenter(e.col,e.row);
  setEnemyHP(eIdx,gs.enemyHP[eIdx]-dmg);
  floatText('-'+dmg,x,y-30,'damage');
  flashBadge(enemyEls[eIdx]);
  if(gs.enemyHP[eIdx]<=0){
    killEnemy(eIdx,()=>{
      // check if reaction on kill (no - reactions are for surviving enemies only)
      checkWin();
    });
  } else {
    shakeUnit(enemyEls[eIdx],()=>{
      const reaction=ALT_REACTIONS.find(r=>r.unitId===e.id);
      const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];const apos=gs.allPlayerPos[pi];
      const atkDist=hexDist(apos.col,apos.row,e.col,e.row);
      const retAllowed=!(ap.type==='ranged'&&atkDist>1)&&!(e.type==='melee'&&atkDist>(e.moveRange??2)+1);
      if(reaction&&reaction.ret&&retAllowed){
        setTimeout(()=>{
          if(reaction.speech)showSpeech(reaction.speech,2000);
          enemySwingAttack(eIdx,()=>{
            const pi=activePlayerIdx();const apos=gs.allPlayerPos[pi];
            const pc=hexCenter(apos.col,apos.row);
            setPlayerHP(gs.allPlayerHP[pi]-reaction.dmg);
            floatText('-'+reaction.dmg,pc.x,pc.y-40,'damage');
            shakeUnit(playerEls[pi],()=>{
              if(gs.allPlayerHP[pi]<=0){playerDies('');return;}
              if(cb)cb();
            });
          });
        },300);
      } else {
        if(cb)cb();
      }
    });
  }
}

function runEnemyTurns(){
  if(!gs.enemyAlive.some(Boolean)){checkWin();return;}
  if(!ALT_ENEMY_TURNS.length){gs.state='player_turn';highlightMove();return;}
  const advancePlayer=()=>{
    gs.altPlayerTurnIdx++;
    let safe=0;while(safe++<ALL_PLAYERS.length&&!gs.allPlayerAlive[activePlayerIdx()])gs.altPlayerTurnIdx++;
    gs.state='player_turn';highlightMove();
  };
  let found=false;
  for(let tries=0;tries<ALT_ENEMY_TURNS.length*2;tries++){
    const t=ALT_ENEMY_TURNS[altTurnIdx%ALT_ENEMY_TURNS.length];
    altTurnIdx=(altTurnIdx+1)%ALT_ENEMY_TURNS.length;
    const eIdx=ENEMIES.findIndex(e=>e.id===t.unitId);
    if(eIdx>=0&&gs.enemyAlive[eIdx]){
      found=true;
      gs.state='animating';
      if(t.action==='move'){
        // designer-configured move turn
        animateEnemyMoveAlt(eIdx,t.moveCol,t.moveRow,()=>{advancePlayer();});
      } else {
        // attack turn — check range for melee enemies
        const e=ENEMIES[eIdx];
        const pi=activePlayerIdx();const apos=gs.allPlayerPos[pi];
        const dist=hexDist(e.col,e.row,apos.col,apos.row);
        if(e.type==='melee'&&dist>(e.moveRange??2)+1){
          // out of reach — move toward player instead of attacking
          const[mc,mr]=findBestMoveToward(e.col,e.row,apos.col,apos.row,e.moveRange??2);
          if(mc!==e.col||mr!==e.row){animateEnemyMoveAlt(eIdx,mc,mr,()=>{advancePlayer();});}
          else{advancePlayer();}
        } else {
          if(t.speech)showSpeech(t.speech,2000);
          enemyAttackAlt(eIdx,t.dmg,()=>{advancePlayer();});
        }
      }
      break;
    }
  }
  if(!found){
    gs.altPlayerTurnIdx++;
    let safe=0;while(safe++<ALL_PLAYERS.length&&!gs.allPlayerAlive[activePlayerIdx()])gs.altPlayerTurnIdx++;
    gs.state='player_turn';highlightMove();
  }
}

function enemySwingAttack(idx,cb){
  const e=ENEMIES[idx];const el=enemyEls[idx];
  const img=el&&el.querySelector('img');
  if(img&&e.atkImg){img.src=e.atkImg;img.width=e.aw;}
  if(el)el.classList.add('shake');playSound(SFX.enemy1_atk);
  setTimeout(()=>{if(img&&e.idleImg){img.src=e.idleImg;img.width=e.w;}if(el)el.classList.remove('shake');if(cb)cb();},420);
}

function enemyAttackAlt(idx,damage,cb){
  const e=ENEMIES[idx];
  const applyHit=()=>{
    const pi=activePlayerIdx();const apos=gs.allPlayerPos[pi];
    const pc=hexCenter(apos.col,apos.row);
    setPlayerHP(gs.allPlayerHP[pi]-damage);
    floatText('-'+damage,pc.x,pc.y-40,'damage');
    shakeUnit(playerEls[pi],()=>{if(gs.allPlayerHP[pi]<=0){playerDies('');return;}if(cb)cb();});
  };
  if(e.type==='flying'){
    animateEnemyCharge(idx,applyHit);
  } else {
    const el=enemyEls[idx];if(el){el.classList.add('shake');playSound(SFX.enemy1_atk);}
    setTimeout(()=>{if(el)el.classList.remove('shake');applyHit();},400);
  }
}

// ─── STORE ───
${ctaFn}

// ─── SPELLBOOK ───
function openSpellbook(){if(!SPELLBOOK_ENABLED)return;startMusic();gs.sbOpen=true;gs.state='spell_select';if(sbIcon&&IMG_SB_OPEN)sbIcon.src=IMG_SB_OPEN;sbPanel.style.display='flex';clearHex();playSound(SFX.sb_open);}
function closeSpellbook(){gs.sbOpen=false;if(sbIcon&&IMG_SB_CLOSED)sbIcon.src=IMG_SB_CLOSED;sbPanel.style.display='none';gs.selSpell=null;${spSP_reset}if(gs.state==='spell_select'||gs.state==='spell_target'){gs.state='player_turn';highlightMove();}}
function closeSpellbookSilent(){gs.sbOpen=false;if(sbIcon&&IMG_SB_CLOSED)sbIcon.src=IMG_SB_CLOSED;sbPanel.style.display='none';}
function selectSpell(id){const idx=parseInt(id.replace('spell',''));if(gs.spellUsed[id])return;gs.selSpell=id;${spSP_toggleSel}gs.state='spell_target';highlightTargets();playSound(SFX.sb_spell);}

// ─── CAST ───
function castSpell(targetCol,targetRow){
  const idx=findEnemyAt(targetCol,targetRow);if(idx<0)return;
  const e=ENEMIES[idx];
  const sel=gs.selSpell;const spellIdx=parseInt(sel.replace('spell',''));
  const selEl=SPELL_ELS[spellIdx]||'';
  const isResisted=e.resistTo.includes(selEl);
  gs.spellUsed[sel]=true;
  const sel2=sel;${spSP_addUsed}
  gs.selSpell=null;${spSP_reset}
  closeSpellbookSilent();gs.state='animating';clearHex();
  const from=hexCenter(gs.pCol,gs.pRow),to=hexCenter(e.col,e.row);
  animateSpell(spellIdx,from.x,from.y-40,to.x,to.y-40,()=>{
    if(!isResisted){
      floatText('Critical!',to.x,to.y-30,'critical');
      killEnemy(idx,()=>{doRetaliation(e.id,()=>{checkWin();});});
    } else {
      setEnemyHP(idx,Math.max(1,gs.enemyHP[idx]-5));floatText('Resist',to.x,to.y-30,'resist');
      const hint=e.type==='flying'?HINTS_WRONG_FLY:HINTS_WASTED;
      const attackerIdx=e.type==='flying'?idx:ENEMIES.findIndex((en,i)=>gs.enemyAlive[i]&&en.type==='flying');
      const realAttackerIdx=attackerIdx>=0?attackerIdx:ENEMIES.findIndex((_,i)=>gs.enemyAlive[i]);
      if(realAttackerIdx>=0)setTimeout(()=>enemyAttack(realAttackerIdx,hint),700);
    }
  });
}

// ─── HEX CLICK ───
function onHexClick(){
  startMusic();
  const col=parseInt(this.dataset.col),row=parseInt(this.dataset.row);
  if(gs.state==='spell_target'){castSpell(col,row);return;}
  if(gs.state==='intro'){skipIntro();return;}
  if(gs.state!=='player_turn')return;
  const eIdx=findEnemyAt(col,row);

  if(SCENARIO_MODE==='alternating'){
    if(eIdx>=0){
      gs.state='animating';clearHex();hideSpeech();hideAllAttackIcons();
      const e=ENEMIES[eIdx];
      const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];
      if(ap.type==='ranged'){
        playerAttackAlt(eIdx,()=>{checkWin();});
      } else {
        const apos=gs.allPlayerPos[pi];
        if(ap.type==='flying'){playerAttackAlt(eIdx,()=>{checkWin();});}
        else{
          const adjHex=findAttackHex(e.col,e.row,apos.col,apos.row,ap.moveRange);
          if(!adjHex){showOutOfReach();gs.state='player_turn';highlightMove();}
          else{const[dc,dr]=adjHex;movePlayerTo(dc,dr,()=>{playerAttackAlt(eIdx,()=>{checkWin();});});}
        }
      }
    } else {
      const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];const apos=gs.allPlayerPos[pi];
      const dist=hexDist(apos.col,apos.row,col,row);
      if(dist>0&&dist<=ap.moveRange&&!occupied(col,row)){gs.state='animating';clearHex();playSound(SFX.grid,.7);movePlayerTo(col,row,()=>{checkWin();});}
    }
    return;
  }

  // ─── PUZZLE MODE ───
  if(eIdx>=0){
    const e=ENEMIES[eIdx];
    const pi0=activePlayerIdx();const ap0=ALL_PLAYERS[pi0];
    if(ap0.type==='ranged'){
      gs.state='animating';clearHex();hideSpeech();hideAllAttackIcons();
      const flyingAlive=ENEMIES.some((en,i)=>gs.enemyAlive[i]&&en.type==='flying');
      const from=hexCenter(gs.pCol,gs.pRow);const to=hexCenter(e.col,e.row);
      const img=playerEls[pi0]&&playerEls[pi0].querySelector('img');
      if(img&&ap0.atkImg){img.src=ap0.atkImg;img.width=ap0.aw;}
      animateSpell(-1,from.x,from.y-30,to.x,to.y-30,()=>{
        if(img&&ap0.idleImg){img.src=ap0.idleImg;img.width=ap0.w;}
        if(flyingAlive&&e.type!=='flying'){floatText('KILL',to.x,to.y-30,'critical');killEnemy(eIdx,()=>{const flyIdx=ENEMIES.findIndex((en,i)=>gs.enemyAlive[i]&&en.type==='flying');if(flyIdx>=0)setTimeout(()=>enemyAttack(flyIdx,HINTS_RANGED_FIRST),400);else checkWin();});}
        else{killEnemy(eIdx,()=>{doRetaliation(e.id,()=>{checkWin();});});}
      });
      return;
    }
    if(e.type==='flying'){
      gs.state='animating';clearHex();hideSpeech();hideAllAttackIcons();
      const [dfc,dfr]=nearestAdjacentTo(e.col,e.row,gs.pCol,gs.pRow);
      movePlayerTo(dfc,dfr,()=>{setTimeout(()=>enemyAttack(eIdx,HINTS_MOVE_FLY),300);});
      return;
    }
    const adjHex=findAttackHex(e.col,e.row,gs.pCol,gs.pRow,ap0.moveRange);
    if(!adjHex){showOutOfReach();return;}
    const[dc,dr]=adjHex;
    gs.state='animating';clearHex();hideSpeech();hideAllAttackIcons();
    const flyingAlive=ENEMIES.some((en,i)=>gs.enemyAlive[i]&&en.type==='flying');
    if(!flyingAlive){
      movePlayerTo(dc,dr,()=>{playerSwingAttack(()=>{killEnemy(eIdx,()=>{doRetaliation(e.id,()=>{checkWin();});});});});
    } else {
      movePlayerTo(dc,dr,()=>{playerSwingAttack(()=>{const fc=hexCenter(e.col,e.row);floatText('KILL',fc.x,fc.y-30,'critical');killEnemy(eIdx,()=>{const flyIdx=ENEMIES.findIndex((en,i)=>gs.enemyAlive[i]&&en.type==='flying');if(flyIdx>=0)setTimeout(()=>enemyAttack(flyIdx,HINTS_RANGED_FIRST),400);else checkWin();});});});
    }
    return;
  }
  const dist=hexDist(gs.pCol,gs.pRow,col,row);
  if(dist>0&&dist<=ALL_PLAYERS[activePlayerIdx()].moveRange&&!occupied(col,row)){gs.state='animating';clearHex();playSound(SFX.grid,.7);movePlayerTo(col,row,()=>{gs.state='player_turn';highlightMove();});}
}

// ─── ENEMY HIT TEST (coordinate-based, capture phase) ───
function findNearestEnemy(px,py){
  let best=-1,bestD=Infinity;
  const thresh=cur.hexW*0.85;
  ENEMIES.forEach((e,i)=>{
    if(!gs.enemyAlive[i])return;
    const{x,y}=hexCenter(e.col,e.row);
    const d=Math.sqrt((px-x)*(px-x)+(py-y)*(py-y));
    if(d<thresh&&d<bestD){bestD=d;best=i;}
  });
  return best;
}
vp.addEventListener('click',function(ev){
  if(gs.state!=='player_turn'&&gs.state!=='spell_target'&&gs.state!=='animating'&&gs.state!=='intro')return;
  const rect=vp.getBoundingClientRect();
  const sx=cur.vpW/rect.width,sy=cur.vpH/rect.height;
  const px=(ev.clientX-rect.left)*sx,py=(ev.clientY-rect.top)*sy;
  const eIdx=findNearestEnemy(px,py);
  if(eIdx<0)return;
  ev.stopPropagation();
  if(gs.state==='spell_target'){castSpell(ENEMIES[eIdx].col,ENEMIES[eIdx].row);}
  else if(gs.state==='intro'){skipIntro();}
  else{const k=ENEMIES[eIdx].col+','+ENEMIES[eIdx].row;if(hexEls[k])onHexClick.call(hexEls[k]);}
},true);

// ─── UNIT CLICKS ───
playerEls.forEach((el,i)=>{if(el)el.querySelector('img').addEventListener('click',e=>{e.stopPropagation();if(gs.state==='intro'){skipIntro();return;}if(gs.state==='player_turn'&&i===activePlayerIdx())highlightMove();});});
${enemyUnitClicksJS}
atkIconEls.forEach((el,i)=>{if(!el)return;el.addEventListener('click',function(ev){ev.stopPropagation();if(gs.state==='intro'){skipIntro();return;}const e=ENEMIES[i];if(gs.state==='spell_target'){castSpell(e.col,e.row);}else if(gs.state==='player_turn'){const k=e.col+','+e.row;if(hexEls[k])onHexClick.call(hexEls[k]);}});});
sbBtn.addEventListener('click',e=>{e.stopPropagation();if(gs.state==='intro')skipIntro();if(gs.state==='animating'||gs.state==='fail'||gs.state==='win')return;if(gs.sbOpen)closeSpellbook();else openSpellbook();});
${spSP_events}
retryBtn.addEventListener('click',()=>{failScr.classList.remove('show');resetGame();});
storeBtn.addEventListener('click',goStore);
$('win-cta').addEventListener('click',goStore);
vp.addEventListener('click',e=>{const isEnemy=enemyEls.some(el=>el&&el.contains(e.target));if(!sbArea.contains(e.target)&&!gridEl.contains(e.target)&&!isEnemy){if(gs.state==='spell_target'||gs.state==='spell_select')closeSpellbook();if(gs.state==='intro')skipIntro();}});

// ─── INTRO ───
function skipIntro(){if(gs.state!=='intro')return;startMusic();hideSpeech();hideArrow();startTurn();}
function startTurn(){
  if(SCENARIO_MODE==='alternating'&&ALT_FIRST==='enemy'){
    setTimeout(runEnemyTurns,600);
  } else {
    gs.state='player_turn';highlightMove();
  }
}
function startIntro(){gs.state='intro';showSpeech('Defeat the enemies!');showArrow(gs.pCol,gs.pRow);setTimeout(()=>{if(gs.state!=='intro')return;skipIntro();},1500);}

// ─── RESET ───
function resetGame(){
  altTurnIdx=0;lastHoppedIdx=-1;
  gs.state='player_turn';gs.turn=1;gs.failCount=0;
  gs.playerHP=PLAYER_HP_INIT;gs.enemyHP=ENEMIES.map(e=>e.hp);gs.enemyAlive=ENEMIES.map(()=>true);
  gs.spellUsed={...spellUsedInit};gs.selSpell=null;gs.sbOpen=false;
  gs.pCol=PLAYER_START_COL;gs.pRow=PLAYER_START_ROW;
  gs.allPlayerHP=ALL_PLAYERS.map(p=>p.hp);
  gs.allPlayerAlive=ALL_PLAYERS.map(()=>true);
  gs.allPlayerPos=ALL_PLAYERS.map(p=>({col:p.col,row:p.row}));
  gs.altPlayerTurnIdx=0;
  ALL_PLAYERS.forEach((p,i)=>{if(playerHpEls[i])playerHpEls[i].textContent=p.hp;});
  ENEMIES.forEach((_,i)=>{if(enemyHpEls[i])enemyHpEls[i].textContent=ENEMIES[i].hp;});
  ALL_PLAYERS.forEach((p,i)=>{if(playerEls[i]){const img=playerEls[i].querySelector('img');if(p.idleImg){img.src=p.idleImg;img.width=p.w;}}});
  [...playerEls,...enemyEls].filter(Boolean).forEach(u=>{u.classList.remove('dead','shake','active-player');u.style.opacity='';u.style.transform='';u.style.transition='none';});
  enemyFlyerEls.filter(Boolean).forEach(f=>{f.style.display='none';});
  ${spSP_resetAll}
  closeSpellbookSilent();
  if(sbArea&&!SPELLBOOK_ENABLED)sbArea.style.display='none';
  hideSpeech();hideArrow();spellProj.style.display='none';
  failScr.classList.remove('show');winScr.classList.remove('show');
  requestAnimationFrame(()=>{
    ${playerInitJS}
    ENEMIES.forEach((e,i)=>{placeUnit(enemyEls[i],e.col,e.row);});
    requestAnimationFrame(()=>{[...playerEls,...enemyEls].filter(Boolean).forEach(u=>u.style.transition='');});
    clearHex();
    if(SCENARIO_MODE==='alternating'&&ALT_FIRST==='enemy'){setTimeout(runEnemyTurns,600);}
    else{highlightMove();}
  });
}

// ─── REFRESH LAYOUT ───
function refreshLayout(){
  buildGrid();
  ${playerInitJS}
  ENEMIES.forEach((e,i)=>{if(gs.enemyAlive[i])placeUnit(enemyEls[i],e.col,e.row);});
  if(gs.state==='player_turn'||gs.state==='animating')highlightMove();
  else if(gs.state==='spell_target')highlightTargets();
  else clearHex();
  if(gs.state==='intro')showArrow(gs.pCol,gs.pRow);
}

// ─── INIT ───
function initGame(){
  resize();buildGrid();
  if(sbArea&&!SPELLBOOK_ENABLED)sbArea.style.display='none';
  ${playerInitJS}
  ENEMIES.forEach((e,i)=>{placeUnit(enemyEls[i],e.col,e.row);});
  startIntro();
}

${visLock}
${mraidBootstrap}
${mintegralBootstrap}
${network==='facebook'||network==='google' ? "window.addEventListener('load',initGame);" : ''}
</script>
</body>
</html>`;
}
