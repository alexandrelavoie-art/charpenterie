/* Outil de concordance DEP 5319 / DVS 5819 — composant autonome.
   Intégration (page autonome ou bloc « HTML personnalisé » WordPress) :
     <concordance-5319></concordance-5319>
     <script src="donnees-5319.js"></script>
     <script src="concordance-5319.js"></script>
   L'outil vit dans un Shadow DOM : ses styles n'atteignent pas la page hôte et ceux du thème ne l'atteignent pas.
   Enregistrement : feuille Google partagée (URL_FEUILLE, ou l'attribut feuille, p. ex. la page d'essai DEV), sinon ce
   navigateur seulement. Une page qui donne l'attribut feuille garde ses données de navigateur à part (préfixe dep5319dev_).
   Modèle (voir PLAN-DE-TRAVAIL.md) :
   - Journal {ts, comp, ec, el, geste, nom, participant}, rejoué dans l'ordre sur les liens proposés (defaultLinks).
     Geste : proposé (un participant propose d'ajouter le lien; un seul par lien, qui vit tant qu'au moins une personne
     l'appuie d'un 👍), ajouté, adopté (ajouté ou adopté sur un lien qui a une proposition l'adoptent), non retenu,
     retiré, confirmé (retire seulement la mention « probable ») et maintenu (tranche seulement les votes contre);
   - Ctrl+Z d'un administrateur : la feuille efface la ligne de son geste ({annuler:[{ts, comp, ec, el}]});
   - votes {ts, comp, ec, el, sens: pour | contre | retrait} sur les liens de la version maître : le dernier vote de
     chaque personne compte; un vote contre donné après la dernière décision met le lien en attente;
   - messages {ts, comp, cible, el, version, type, texte} : un fil par lien (cible + el); la raison d'une proposition
     porte la version « p » + le numéro de son auteur.
   « participant » et « centre » sont des numéros de lignes des onglets Participants et Centres : le nom et le centre
   affichés sont toujours ceux de la feuille. */
(function(){
'use strict';

// URL de l'application Web Google Apps Script (voir LISEZMOI.md). Vide = mode local.
const URL_FEUILLE='https://script.google.com/macros/s/AKfycbyGwb6rlwT_fTwrh4HwZ_pYlkH-2RKd9C5fYWQRcxr6L6KdHE4TKOKTHjtI2Jajj4vq/exec';
const POLICES='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';

const CSS=`
:host{all:initial;display:block;height:100vh;height:100dvh;
  --page-bg:#e6e4df;--bg:#ffffff;--surface:#ffffff;--surface-2:#f5f4f1;
  --border:#c9c6bf;--border-soft:#dedbd4;--fg:#1a1816;--fg-muted:#6b6760;--ink:#1a1816;--accent:#1f4e8c;--accent-bg:#e4edf8;--doc-ref:#2d4f7a;--doc-prog:#8a5a1e;--hl:#fff3bf;
  --fort:#1a6335;--fort-bg:#d6f0e2;
  --probable:#7a4a08;--probable-bg:#feecc8;
  --avalider:#1a4578;--avalider-bg:#d8eaf8;
  --nav-w:200px;color-scheme:light;}
:host([data-theme="dark"]){
  --page-bg:#161616;--bg:#1f1f1f;--surface:#1f1f1f;--surface-2:#282828;
  --border:#444444;--border-soft:#333333;--fg:#f0f0f0;--fg-muted:#9a9a9a;--ink:#f0f0f0;--accent:#7fb0ee;--accent-bg:#172a44;--doc-ref:#9bbbe6;--doc-prog:#e0b070;--hl:#3d3516;
  --fort:#6dd492;--fort-bg:#0d2819;
  --probable:#edb644;--probable-bg:#271c05;
  --avalider:#68acee;--avalider-bg:#0c1d32;
  color-scheme:dark;}
:host([hidden]){display:none}
[hidden]{display:none!important}
*{box-sizing:border-box;margin:0;padding:0}
button,input,textarea{font-family:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.racine{position:relative;height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;font-weight:400;font-style:normal;letter-spacing:normal;word-spacing:normal;text-transform:none;text-align:left;text-indent:0;white-space:normal;background:var(--page-bg);color:var(--fg);padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);container-type:inline-size;}

/* Accueil : choix parmi les 19 compétences */
.landing{background:var(--page-bg);flex:1;overflow-y:auto;padding:20px 16px 28px;}
.landing-inner{max-width:1100px;margin:0 auto;text-align:center;}
.landing-outils{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
.landing h1{color:var(--fg);font-size:clamp(18px,4vw,26px);font-weight:700;margin-bottom:6px;letter-spacing:-.02em;}
.landing p{color:var(--fg-muted);font-size:13px;margin-bottom:16px;}
.lang-choices{display:inline-flex;border:1px solid var(--border);border-radius:5px;overflow:hidden;}
.lang-choice{font-size:12px;font-weight:600;padding:5px 14px;border:none;background:var(--surface);color:var(--fg-muted);cursor:pointer;}
.lang-choice.active{background:var(--accent);color:var(--bg);}
.ident-accueil{font-size:12px;border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:5px;padding:5px 12px;cursor:pointer;}
.comp-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;text-align:left;}
.comp-carte{display:flex;flex-direction:column;gap:6px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:9px 12px;gap:3px;cursor:pointer;color:var(--fg);box-shadow:0 1px 4px rgba(0,0,0,.05);text-align:left;transition:border-color .12s,box-shadow .12s;}
.comp-carte:hover{border-color:var(--accent);box-shadow:0 3px 12px rgba(0,0,0,.08);}
.comp-carte.derniere{border-color:var(--accent);box-shadow:inset 0 3px 0 var(--accent);}
.carte-code{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:500;color:var(--fg-muted);letter-spacing:.02em;}
.carte-titre{font-size:13px;font-weight:600;line-height:1.3;flex:1;}
.carte-pied{display:flex;gap:10px;align-items:center;font-size:11px;color:var(--fg-muted);}
.carte-heures{margin-left:auto;font-family:'JetBrains Mono',monospace;}
.carte-barre{height:3px;background:var(--border-soft);border-radius:2px;overflow:hidden;}
.carte-barre span{display:block;height:100%;background:var(--fort);}

.app-shell{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
.app-header{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--fg);flex-shrink:0;flex-wrap:wrap;}
.app-header button,.header-actions label{color:var(--fg);background:transparent;border-radius:4px;border:1px solid var(--border);padding:5px 10px;cursor:pointer;font-size:12px;white-space:nowrap;transition:background .12s,border-color .12s;}
.app-header button:hover,.header-actions label:hover{background:var(--surface-2);border-color:var(--fg);}
#nav-toggle{font-size:16px;padding:5px 9px;}
.header-info{flex:1 1 280px;min-width:0;}
.header-doc{color:var(--fg);font-weight:700;font-size:17px;letter-spacing:-.01em;line-height:1.3;}
.header-sous{color:var(--fg-muted);font-size:11.5px;line-height:1.3;}
.vues{display:inline-flex;border:1px solid var(--border);border-radius:5px;overflow:hidden;flex-shrink:0;}
.app-header .vues .vue-btn{border:none;border-radius:0;}
.app-header .vues .vue-btn+.vue-btn{border-left:1px solid var(--border);}
.app-header .vues .vue-btn.on{background:var(--accent);color:var(--bg);}
.header-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.header-actions label{display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none;}
.header-actions input[type=checkbox]{accent-color:var(--accent);width:14px;height:14px;}
.lang-btn{font-weight:700;font-size:11px!important;letter-spacing:.06em;min-width:36px;}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;padding:5px 8px!important;line-height:0;}
.icon-btn svg{display:block;}
.icon-btn:disabled{opacity:.35;cursor:default;}
.icon-btn:disabled:hover{background:transparent;border-color:var(--border);}
.sync{font-size:11px;color:var(--fg-muted);white-space:nowrap;}
.sync.erreur{color:var(--probable);font-weight:600;}
.banniere{flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:8px 16px;font-size:12.5px;background:var(--probable-bg);color:var(--probable);border-bottom:1px solid var(--probable);}
.banniere button{font-size:12px;font-weight:600;border:1px solid currentColor;background:transparent;color:inherit;border-radius:4px;padding:3px 10px;cursor:pointer;}

.body-row{flex:1;display:flex;min-height:0;overflow:hidden;position:relative;}
.left-nav{width:var(--nav-w);flex-shrink:0;background:var(--surface-2);overflow:hidden auto;transition:width .22s;display:flex;flex-direction:column;padding:14px 8px;gap:2px;border-right:1.5px solid var(--border-soft);}
.left-nav.collapsed{width:0;padding:0;}
.nav-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-muted);margin:10px 0 4px 4px;}
.nav-btn{display:flex;align-items:center;gap:6px;background:transparent;border:none;border-radius:4px;padding:6px 8px;cursor:pointer;font-size:12px;font-weight:500;color:var(--fg-muted);text-align:left;transition:background .12s,color .12s;white-space:nowrap;width:100%;overflow:hidden;}
.nav-btn:hover{background:var(--surface-2);color:var(--fg);}
.nav-btn.active{background:var(--accent);color:var(--bg);font-weight:600;}
.nav-txt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;}
.nav-btn.probable .nav-txt{font-style:italic;}
.nav-prog{flex-shrink:0;font-family:'JetBrains Mono',monospace;font-size:10px;opacity:.8;}
.nav-prog.complet{color:var(--fort);opacity:1;font-weight:600;}
.nav-btn.active .nav-prog{color:inherit;}
.nav-divider{height:1.5px;background:var(--border-soft);margin:6px 0;}
.nav-home{font-size:11px;color:var(--fg-muted);cursor:pointer;padding:5px 8px;transition:background .12s;background:none;border:none;text-align:left;border-radius:4px;}
.nav-home:hover{background:var(--surface-2);color:var(--fg);}

.main-area{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;}
.content-row{flex:1 1 0;display:flex;min-height:0;overflow:hidden;background:var(--page-bg);}
/* Deux "feuilles" de même largeur, comme deux PDF côte à côte : programme à gauche, référentiel à droite */
.pane{flex:1 1 0;min-width:0;overflow-y:auto;padding:20px 16px 24px;}
.sheet{background:var(--surface);border:1px solid var(--border);border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 18px rgba(0,0,0,.06);max-width:820px;margin:0 auto;padding:28px 32px 40px;min-height:100%;}
/* Mises en page selon la largeur de l'outil lui-même (pleine page ou colonne WordPress) */
@container (max-width:860px){.content-row{flex-direction:column;overflow-y:auto;}.pane{flex:none;overflow:visible;padding:12px 12px 20px;}.sheet{padding:18px 16px 28px;}}
@container (max-width:760px){
  .app-header{gap:8px;padding:8px 10px;}
  .header-doc{font-size:15px;}
  .left-nav{position:absolute;top:0;bottom:0;left:0;z-index:60;box-shadow:4px 0 16px rgba(0,0,0,.18);}
  .fil-barre{padding:4px 6px;gap:4px;}
  .fil-onglet{padding:4px 8px;}
  .el-chips-row,.ec-body{padding-left:12px;}
  .el-body.indent{padding-left:12px;}
}

/* Discussion de la compétence, sous les documents */
.fil{flex-shrink:0;display:flex;flex-direction:column;border-top:1px solid var(--border);background:var(--surface);}
.fil-barre{display:flex;align-items:center;gap:8px;padding:5px 10px;}
.fil-onglets{flex:1;display:flex;justify-content:center;gap:6px;}
.fil-onglet{font-size:12px;font-weight:600;border:1px solid var(--border);background:transparent;color:var(--fg-muted);border-radius:4px;padding:4px 12px;cursor:pointer;white-space:nowrap;}
.fil-onglet:hover{color:var(--fg);border-color:var(--fg-muted);}
.fil-onglet.active{background:var(--accent);border-color:var(--accent);color:var(--bg);}
.compte{font-family:'JetBrains Mono',monospace;font-weight:500;opacity:.8;margin-left:2px;}
.comp-nav{display:inline-flex;align-items:center;gap:6px;background:transparent;border:none;padding:4px 6px;cursor:pointer;color:var(--fg-muted);font-size:12.5px;font-weight:500;white-space:nowrap;}
.comp-nav:hover{color:var(--fg);}
.comp-nav-vide{width:52px;}
.fil-corps{height:clamp(180px,38vh,440px);display:flex;flex-direction:column;border-top:1px solid var(--border-soft);}
.fil-liste{flex:1;overflow-y:auto;padding:8px 16px;}
.vide{font-size:12.5px;color:var(--fg-muted);font-style:italic;padding:10px 0;}
.msg{padding:7px 8px;border-bottom:1px solid var(--border-soft);border-radius:3px;}
.msg.sel{background:var(--accent-bg);}
.msg.attente,.geste.attente{opacity:.55;}
.msg-tete{font-size:11px;color:var(--fg-muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.msg-tete b{color:var(--fg);font-size:12px;}
.centre{font-weight:400;color:var(--fg-muted);}
.msg-texte{font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:2px;}
.tag{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;border:1px solid var(--doc-ref);color:var(--doc-ref);background:transparent;border-radius:3px;padding:0 5px;cursor:pointer;white-space:nowrap;}
.tag:hover{background:var(--accent-bg);}

.composer{border-top:1px solid var(--border-soft);padding:8px 16px 10px;display:flex;flex-direction:column;gap:6px;}

.composer-ligne{display:flex;gap:8px;align-items:flex-end;}
.composer textarea{flex:1;resize:vertical;min-height:40px;max-height:160px;font-size:13px;line-height:1.4;padding:7px 9px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--fg);}
.composer button{font-size:12px;font-weight:600;padding:7px 14px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:var(--bg);cursor:pointer;}

.ind-section{margin-bottom:24px;}
.ind-section .ec-card:last-child,.el-card:last-child{margin-bottom:0;}
.ind-header{display:flex;align-items:baseline;gap:8px;margin-bottom:8px;padding-bottom:5px;border-bottom:1.5px solid var(--ink);cursor:pointer;user-select:none;}
.ind-label{font-size:12.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;}
.ind-pts{font-size:11px;opacity:.6;margin-left:auto;font-family:'JetBrains Mono',monospace;}
.ind-chevron{margin-top:0;align-self:center;}
.ind-section.collapsed .ind-chevron{transform:rotate(-90deg);}
.ind-section.collapsed{margin-bottom:12px;}
.ind-section.collapsed .ind-header{margin-bottom:0;}
.seuil{font-size:12px;color:var(--fg-muted);margin:-4px 0 16px;}
.comp-note{font-size:12px;color:var(--fg-muted);font-style:italic;margin:-4px 0 14px;}

.ec-card{background:var(--surface);border:1px solid var(--border);border-radius:4px;margin-bottom:6px;overflow:hidden;}
.ec-head{display:flex;align-items:flex-start;gap:8px;padding:7px 12px;cursor:pointer;user-select:none;transition:background .1s;}
.ec-head:hover{background:var(--surface-2);}
/* Selected EC: accent bar left, subtle highlight */
.ec-card.selected{border-color:var(--accent);}
.ec-card.selected>.ec-head{background:var(--accent-bg);box-shadow:inset 3px 0 0 var(--accent);}
.ec-edit{flex-shrink:0;margin-top:-2px;width:24px;height:24px;border:1px solid transparent;border-radius:4px;background:transparent;color:var(--fg-muted);font-size:13px;cursor:pointer;line-height:1;opacity:.55;transition:all .12s;}
.ec-head:hover .ec-edit,.ec-edit:focus-visible{opacity:1;}
.ec-edit:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-bg);}
.ec-edit.on{opacity:1;background:var(--accent);border-color:var(--accent);color:var(--bg);}
.ec-msgs{flex-shrink:0;margin-top:-1px;font-size:10.5px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--fg-muted);padding:1px 6px;cursor:pointer;white-space:nowrap;}
.ec-msgs:hover{border-color:var(--accent);color:var(--accent);}
.ec-code{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;white-space:nowrap;margin-top:2px;letter-spacing:.02em;min-width:44px;flex-shrink:0;}
.ec-label{flex:1;font-size:13px;font-weight:500;}
.ec-pts{font-size:11px;font-weight:700;color:var(--fg-muted);white-space:nowrap;margin-top:2px;}
.ec-chevron{font-size:10px;color:var(--fg-muted);transition:transform .18s;margin-top:3px;flex-shrink:0;}
.ec-card.expanded .ec-chevron{transform:rotate(180deg);}

.el-chips-row{display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 6px 64px;}
.el-chip,.ec-chip{display:inline-flex;align-items:center;font-size:10px;font-weight:600;font-family:'JetBrains Mono',monospace;line-height:1.4;border-radius:3px;padding:2px 6px;border:1.5px solid transparent;cursor:pointer;background:none;}
.el-chip.fort,.ec-chip.fort{background:var(--fort-bg);color:var(--fort);border-color:var(--fort);}
.el-chip.probable,.ec-chip.probable{background:var(--probable-bg);color:var(--probable);border-color:var(--probable);}
.el-chip.avalider,.ec-chip.avalider{background:var(--avalider-bg);color:var(--avalider);border-color:var(--avalider);}
.chip-ok{margin-left:4px;}

.ec-body{border-top:1px solid var(--border-soft);padding:6px 12px 8px 64px;}
.ec-body .el-chips-row{margin-top:6px;padding:6px 0 0;border-top:1px solid var(--border-soft);}
.sub-list{list-style:none;padding:0;margin:0;}
.sub-list li{font-size:12px;color:var(--fg-muted);padding:1px 0;line-height:1.4;position:relative;}
.sub-list li::before{content:"–";position:absolute;left:-12px;}
.no-subs{font-size:12px;color:var(--fg-muted);font-style:italic;}

/* Mode édition : même carte EL, + case à cocher, statut et validation */
.el-row-check{width:15px;height:15px;flex-shrink:0;border-radius:3px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;background:var(--bg);transition:background .1s,border-color .1s;}
.el-card.editable{user-select:none;}
.el-card.editable .el-row-check{cursor:pointer;}
.el-card.editable:hover{border-color:var(--fg-muted);}
.el-card-top{display:flex;align-items:flex-start;gap:8px;padding:7px 12px;position:relative;cursor:pointer;user-select:none;transition:background .1s;}
.el-card-top:hover{background:var(--surface-2);}
.el-card.editable .el-card-top{padding-left:30px;}
.el-chevron{margin-top:3px;}
.el-card.expanded .el-chevron{transform:rotate(180deg);}
.el-body{border-top:1px solid var(--border-soft);padding:6px 12px 8px;}
.el-body.indent{padding-left:64px;}
.el-card.editable .el-body{padding-left:30px;}
.el-card.editable .el-body.indent{padding-left:82px;}
.el-label{display:flex;align-items:baseline;gap:8px;font-size:13px;font-weight:500;}
.el-code{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;white-space:nowrap;letter-spacing:.02em;min-width:44px;flex-shrink:0;}
.el-text{flex:1;min-width:0;}
.el-body.collapsed{border-top:none;padding-top:0;padding-bottom:6px;}
.el-body.collapsed .ec-chips-row{margin-top:0;padding-top:0;border-top:none;}
.el-card-top .el-row-check{position:absolute;left:9px;top:10px;width:14px;height:14px;}
.el-card-main{flex:1;min-width:0;}
.el-card.editable .pc-list{margin-top:6px;}
.el-card.linked-fort{border-color:var(--fort);background:var(--fort-bg);}
.el-card.linked-probable{border-color:var(--probable);background:var(--probable-bg);}
.el-card.linked-avalider{border-color:var(--avalider);background:var(--avalider-bg);}
.el-card.linked-fort .el-row-check{background:var(--fort);border-color:var(--fort);color:#fff;}
.el-card.linked-probable .el-row-check{background:var(--probable);border-color:var(--probable);color:#fff;}
.el-card.linked-avalider .el-row-check{background:var(--avalider);border-color:var(--avalider);color:#fff;}
.val-line{display:flex;align-items:center;flex-wrap:wrap;gap:4px 10px;margin-top:5px;font-size:11px;color:var(--fg-muted);cursor:default;}
.val-ok{color:var(--fort);font-weight:600;}
.val-btn{font-size:11px;font-weight:600;border:1px solid var(--fort);color:var(--fort);background:var(--surface);border-radius:4px;padding:1px 9px;cursor:pointer;}
.val-btn:hover{background:var(--fort-bg);}
.val-lien{background:none;border:none;color:var(--fg-muted);text-decoration:underline;cursor:pointer;font-size:11px;}
.val-hint{font-style:italic;}
/* Chip de statut + menu déroulant */
.status-wrap{flex-shrink:0;margin-top:1px;}
.status-chip{font-size:11px;font-weight:600;border:1px solid var(--border);border-radius:4px;padding:3px 8px;cursor:pointer;background:var(--surface-2);color:var(--fg-muted);white-space:nowrap;transition:all .12s;}
.status-chip:hover{border-color:var(--fg-muted);color:var(--fg);}
.status-chip.fort{background:var(--fort-bg);color:var(--fort);border-color:var(--fort);}
.status-chip.probable{background:var(--probable-bg);color:var(--probable);border-color:var(--probable);}
.status-chip.avalider{background:var(--avalider-bg);color:var(--avalider);border-color:var(--avalider);}
.status-menu{position:fixed;z-index:500;min-width:170px;background:var(--surface);border:1px solid var(--border);border-radius:5px;box-shadow:0 6px 20px rgba(0,0,0,.15);padding:4px;display:flex;flex-direction:column;}
.status-opt{display:flex;align-items:center;gap:8px;font-size:12px;text-align:left;background:transparent;border:none;border-radius:4px;padding:6px 8px;cursor:pointer;color:var(--fg);}
.status-opt:hover{background:var(--surface-2);}
.status-opt.cur{font-weight:700;}
.status-opt.ok{color:var(--fort);font-weight:600;}
.status-opt.rm{color:var(--fg-muted);}
.status-sep{height:1px;background:var(--border-soft);margin:3px 4px;}
/* Programme EL cards */
.el-card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:4px;margin-bottom:6px;padding:0;transition:opacity .22s;}
.el-card.dimmed{opacity:.28;}
.pc-list{list-style:none;padding:0;margin:0;}
.pc-list li{font-size:12px;color:var(--fg-muted);padding:1px 0;line-height:1.4;position:relative;}
.pc-list li::before{content:"–";position:absolute;left:-12px;}
.ec-chips-row{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border-soft);}

/* En-tête de feuille avec fermeture de l'édition */
.sp-header{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--fg);color:var(--fg);}
.sp-actions{display:inline-flex;align-items:center;gap:8px;}
.sp-editing-badge{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:600;color:var(--accent);background:var(--accent-bg);border:1px solid var(--accent);border-radius:4px;padding:2px 6px 2px 8px;font-family:'JetBrains Mono',monospace;}
.sp-editing-badge .sp-close{font-size:13px;color:var(--accent);}
.sp-close{background:transparent;border:none;cursor:pointer;color:var(--fg-muted);font-size:16px;padding:0;line-height:1;flex-shrink:0;}
.sp-close:hover{color:var(--fg);}

/* Signature par document : référentiel = bleu ardoise, programme = ocre */
.doc-ref .sp-header{border-bottom-color:var(--doc-ref);color:var(--doc-ref);}
.doc-prog .sp-header{border-bottom-color:var(--doc-prog);color:var(--doc-prog);}
.ec-code{color:var(--doc-ref);}
.el-code{color:var(--doc-prog);}
/* Surlignage croisé au survol d'une chip */
.ec-card.hl,.el-card.hl{background:var(--hl);border-color:var(--fg-muted);}
.ec-card.hl>.ec-head,.el-card.hl>.el-card-top{background:transparent;}
.leg-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--fg-muted);}
.leg-dot{width:10px;height:10px;flex-shrink:0;}
.leg-dot.fort{background:var(--fort);}
.leg-dot.probable{background:var(--probable);}
.leg-dot.avalider{background:var(--avalider);}
.leg-ok{font-weight:700;color:var(--fort);}

.tooltip{position:fixed;z-index:999;background:var(--fg);color:var(--bg);font-size:11.5px;padding:8px 12px;max-width:280px;pointer-events:none;line-height:1.5;}
.tooltip ul{list-style:none;padding:0;margin:0;}
.tooltip ul li{padding:1px 0 1px 12px;position:relative;}
.tooltip ul li::before{content:"–";position:absolute;left:0;opacity:.6;}
.tooltip .tt-title{font-weight:700;margin-bottom:4px;opacity:.7;font-size:10px;text-transform:uppercase;letter-spacing:.06em;}

.modal-fond{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:16px;}
.modal{background:var(--surface);color:var(--fg);border:1px solid var(--border);border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:20px 22px;width:min(430px,100%);display:flex;flex-direction:column;gap:12px;}
.modal h2{font-size:16px;font-weight:700;}
/* Deux onglets en tête de la fenêtre du compte : Se connecter, Créer un compte */
.ident-onglets{display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;}
.ident-onglets button{flex:1;font-size:13.5px;font-weight:600;padding:9px 10px;border:none;background:var(--surface);color:var(--fg-muted);cursor:pointer;}
.ident-onglets button+button{border-left:1px solid var(--border);}
.ident-onglets button:hover{color:var(--fg);background:var(--surface-2);}
.ident-onglets button.active{background:var(--accent);color:var(--bg);cursor:default;}
.modal p{font-size:12.5px;color:var(--fg-muted);}
.modal label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;}
.modal input,.modal select{font-size:14px;padding:7px 9px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--fg);}
.modal-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:4px;}
.modal-actions button{white-space:nowrap;font-size:13px;padding:6px 14px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--fg);cursor:pointer;}
.modal-actions button[type=submit]{background:var(--accent);border-color:var(--accent);color:var(--bg);font-weight:600;}
.modal-actions button[type=submit]:disabled{opacity:.6;cursor:wait;}
.modal-actions button.lien{margin-right:auto;border:none;padding:6px 0;color:var(--accent);text-decoration:underline;}
.modal .ident-erreur{color:var(--probable);font-weight:600;}
.modal .ident-erreur .soutien{display:block;margin-top:3px;font-weight:400;color:var(--fg-muted);}
.modal .ident-erreur .soutien a{color:var(--accent);}

/* ---- Version 3 : versions des centres, votes, fils par lien, liste « À traiter », notifications ---- */
:host{--contre:#b3261e;--contre-bg:#fde4e1;--info:#1a4578;--info-bg:#d8eaf8;}
:host([data-theme="dark"]){--contre:#ff8a7a;--contre-bg:#3a1410;--info:#8cc0f5;--info-bg:#132a45;}
button,select{font-family:inherit;}
.racine.attente>.landing,.racine.attente>.app-shell{visibility:hidden;}

/* Écran d'ouverture : le code d'accès avant tout affichage */
.bandeau-dev{position:relative;z-index:2000;flex-shrink:0;text-align:center;font-size:11px;font-weight:700;letter-spacing:.14em;line-height:18px;background:#c2410c;color:#fff;}
.verrou-fond{position:absolute;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:var(--page-bg);}
.verrou{background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.12);padding:26px 28px;width:min(400px,100%);display:flex;flex-direction:column;gap:12px;}
.verrou h2{font-size:17px;font-weight:700;}
.verrou p{font-size:13px;color:var(--fg-muted);}
.verrou label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;}
.verrou input{font-size:14px;padding:8px 10px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--fg);}
.verrou button{font-size:13px;font-weight:600;padding:8px 14px;border-radius:4px;border:1px solid var(--accent);background:var(--accent);color:var(--bg);cursor:pointer;}
/* Choix de la langue sur l'écran du code : une bascule en pilule, la langue active pleine */
/* Page de connexion : sans compte, rien d'autre n'est visible */
.modal-fond.porte{position:absolute;z-index:850;background:var(--page-bg);}
.verrou .bascule,.modal .bascule{align-self:flex-end;display:inline-flex;gap:2px;padding:3px;border:1px solid var(--border);border-radius:999px;background:var(--bg);}
.bascule .lang-choice{font-size:12px;font-weight:600;line-height:1.4;padding:3px 12px;border:none;border-radius:999px;background:transparent;color:var(--fg-muted);cursor:pointer;}
.bascule .lang-choice:hover{color:var(--fg);}
.bascule .lang-choice.active{background:var(--accent);color:var(--bg);box-shadow:0 1px 2px rgba(0,0,0,.18);cursor:default;}
.verrou .ident-erreur{color:var(--contre);font-weight:600;}

/* En-tête : liste « À traiter », cloche */
.app-header button.on{background:var(--accent);border-color:var(--accent);color:var(--bg);}
.compteur{display:inline-block;min-width:16px;text-align:center;background:var(--contre);color:#fff;border-radius:9px;padding:0 5px;font-size:10.5px;font-weight:700;margin-left:4px;}
.cloche{position:relative;display:inline-flex;}
.notifs{position:absolute;right:0;top:calc(100% + 6px);width:min(420px,calc(100cqw - 20px));max-height:60vh;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.2);z-index:600;text-align:left;font-size:12.5px;white-space:normal;}
.notifs-tete{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border-soft);font-weight:700;}
.notif{display:flex;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border-soft);cursor:pointer;}
.notif:hover{background:var(--surface-2);}
.notif.nouv{background:var(--accent-bg);}
.notif-ic{width:18px;text-align:center;flex-shrink:0;}
.notif small{display:block;color:var(--fg-muted);font-size:11px;}

/* Pastilles d'un lien : état, votes, traces des centres */
.lien-v{display:inline-flex;align-items:center;gap:1px;margin-right:6px;}
.el-chip.lien,.ec-chip.lien{background:var(--fort-bg);color:var(--fort);border-color:var(--fort);}
.el-chip.lien.probable,.ec-chip.lien.probable{background:var(--probable-bg);color:var(--probable);border-color:var(--probable);border-style:dashed;}
.el-chip.probable,.ec-chip.probable{border-style:dashed;}
.el-chip .etiq,.ec-chip .etiq{font-family:'Inter',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-left:5px;}
.el-chip.classe,.ec-chip.classe{opacity:.7;}
.el-chip.ajoute,.ec-chip.ajoute{background:var(--surface);color:var(--fort);border:1.5px dashed var(--fort);}
.el-chip.retire,.ec-chip.retire{background:var(--surface);color:var(--contre);border:1.5px dashed var(--contre);}
.el-chip.retire .barre-code,.ec-chip.retire .barre-code{text-decoration:line-through;}
.el-chip.fantome,.ec-chip.fantome{background:var(--surface);color:var(--info);border:1.5px dashed var(--info);opacity:.85;}
.el-chip.fantome.classe,.ec-chip.fantome.classe{opacity:.6;}
/* Les pouces restent de simples icônes : gris sans vote, gris plus net avec des votes, en couleur pour mon vote */
.pouce{border:none;background:none;font-size:12px;line-height:1;padding:2px 3px;border-radius:3px;display:inline-flex;align-items:center;gap:1px;cursor:pointer;}
.pouce .pouce-ic{filter:grayscale(1);opacity:.5;}
.pouce.a .pouce-ic{opacity:.85;}
.pouce:hover .pouce-ic,.pouce.moi .pouce-ic{filter:none;opacity:1;}
.pouce small{font-size:10.5px;font-weight:700;}
.pouce.pour small{color:var(--fort);}
.pouce.contre small{color:var(--fg-muted);}
.pouce.contre small.att{color:var(--contre);}

.trace{font-size:10.5px;font-weight:700;line-height:1.4;color:var(--info);background:none;border:1px solid var(--info);border-radius:8px;padding:0 5px;margin-left:2px;cursor:pointer;white-space:nowrap;}
.mini-btn{font-size:10.5px;font-weight:600;border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:3px;padding:0 6px;margin-left:3px;cursor:pointer;}
.mini-btn.primaire{background:var(--accent);border-color:var(--accent);color:var(--bg);}
.bulle{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 12px 8px 64px;padding:6px 8px;border:1px solid var(--contre);border-radius:4px;background:var(--surface);font-size:12px;}
.bulle input{flex:1 1 260px;min-width:160px;border:1px solid var(--border);border-radius:3px;padding:4px 6px;background:var(--bg);color:var(--fg);font-size:12px;}
.bulle .aide{flex-basis:100%;font-size:11px;color:var(--fg-muted);}
.btn-p{font-size:11.5px;font-weight:600;border:1px solid var(--accent);background:var(--accent);color:var(--bg);border-radius:4px;padding:2px 10px;cursor:pointer;}
.btn-p:disabled{opacity:.5;cursor:not-allowed;}
.btn-p.danger{border-color:var(--contre);background:var(--contre);}
.btn-s{font-size:11.5px;border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:4px;padding:2px 10px;cursor:pointer;}

/* Mode édition : écarts d'un centre, décisions d'un administrateur */
.el-card.editable.ecart-ajoute{border:1.5px dashed var(--fort);}
.el-card.editable.ecart-retire{border:1.5px dashed var(--contre);}
.el-card.editable.ecart-retire .el-text{text-decoration:line-through;color:var(--fg-muted);}
.el-card.editable.brouillon{border:2px solid var(--accent);}
.el-card.editable.pris .el-row-check{opacity:.45;cursor:default;}
.puce-probable{align-self:center;display:inline-flex;align-items:center;gap:5px;font-family:'Inter',sans-serif;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;line-height:1.5;padding:0 6px;border-radius:3px;border:1px dashed var(--probable);background:var(--probable-bg);color:var(--probable);cursor:pointer;}
.puce-probable span{font-size:12px;line-height:1;font-weight:700;}
.puce-probable:hover{border-style:solid;}
.note-ecart{margin-top:6px;font-size:11.5px;color:var(--fg-muted);display:flex;flex-direction:column;gap:4px;cursor:default;}
/* Ma proposition en mode édition : la fiche reste compacte; 💬 affiche ou modifie mon commentaire */
/* Le + au bout d'une rangée de pastilles, et la boîte « Proposer un ajout » */
.plus-ajout{border:1px dashed var(--border);background:none;color:var(--fg-muted);border-radius:3px;font-size:11.5px;font-weight:700;line-height:1.3;padding:0 6px;margin-left:2px;cursor:pointer;}
.plus-ajout:hover,.plus-ajout.on{border-color:var(--fort);color:var(--fort);background:var(--fort-bg);}
.bulle.ajout{border-color:var(--fort);}
.bulle.ajout select{flex:1 1 220px;min-width:150px;border:1px solid var(--border);border-radius:3px;padding:3px 6px;background:var(--bg);color:var(--fg);font-size:12px;}
.bulle-com{border:none;background:none;cursor:pointer;font-size:12.5px;line-height:1;padding:2px 4px;border-radius:3px;opacity:.65;align-self:center;}
.bulle-com:hover,.bulle-com.on{opacity:1;background:var(--surface-2);}
.etiq-classe{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--fg-muted);align-self:center;}
.note-ecart label{display:flex;flex-direction:column;gap:2px;font-weight:600;color:var(--fg);}
.note-ecart input{font-weight:400;border:1px solid var(--border);border-radius:3px;padding:3px 6px;background:var(--bg);color:var(--fg);font-size:12px;}
.note-ecart .ligne{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.etiq-ecart{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border-radius:3px;padding:0 5px;align-self:flex-start;}
.etiq-ecart.ajoute{background:var(--fort-bg);color:var(--fort);}
.etiq-ecart.retire{background:var(--contre-bg);color:var(--contre);}
.etiq-ecart.probable{background:var(--probable-bg);color:var(--probable);}

/* Discussion : les messages en bulles, les gestes en lignes discrètes; le texte d'un geste le suit en bulle */
.fil-cols{flex:1;display:flex;min-height:0;}
.fil-droite{flex:1;min-width:0;display:flex;flex-direction:column;}
.fil-titre{padding:8px 16px 0;font-size:12.5px;font-weight:700;}
.fil-titre small{display:block;font-weight:400;color:var(--fg-muted);font-size:11.5px;}
.geste{display:flex;gap:6px;align-items:baseline;font-size:11.5px;color:var(--fg-muted);padding:6px 8px 3px;}
.geste .ic-g{width:16px;text-align:center;flex-shrink:0;font-weight:700;}
.geste.admin .ic-g{color:var(--info);}
.geste .q{white-space:nowrap;}
.msg.rattache{margin:0 0 4px 30px;padding:2px 10px;border:none;border-left:3px solid var(--contre);border-radius:0;}
.msg.rattache.ajout{border-left-color:var(--fort);}
.msg.rattache .msg-texte{margin-top:0;}
/* Ses propres messages : ✎ et 🗑 au bout de la ligne, au survol */
.msg-actions{margin-left:auto;display:inline-flex;gap:2px;opacity:0;transition:opacity .12s;}
.msg:hover .msg-actions,.msg:focus-within .msg-actions,.msg-actions.ouvert{opacity:1;}
.msg-actions button{border:none;background:none;cursor:pointer;font-size:12px;padding:1px 4px;border-radius:3px;color:var(--fg-muted);}
.msg-actions button:not(.btn-p):not(.btn-s):hover{background:var(--surface-2);color:var(--fg);}
.msg-actions .btn-p,.msg-actions .btn-s{font-size:11px;padding:1px 8px;}
.msg-actions .btn-p.danger{color:var(--bg);}
.msg-modifie{font-style:italic;}
.msg-edition{display:flex;flex-direction:column;gap:4px;margin-top:4px;}
.msg-edition textarea{resize:vertical;min-height:40px;font-size:13px;line-height:1.4;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--fg);}
.msg-edition .ligne{display:flex;gap:6px;}
/* Encadré d'un lien, par-dessus l'outil */
.voile{position:absolute;inset:0;z-index:800;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding:56px 16px 16px;}
.encadre{background:var(--surface);color:var(--fg);border:1px solid var(--border);border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.25);width:min(600px,100%);max-height:100%;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:6px;}
.encadre-tete{display:flex;gap:10px;align-items:flex-start;}
.encadre-tete h2{flex:1;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;}
.encadre-def{font-size:12px;color:var(--fg-muted);display:flex;flex-direction:column;gap:1px;}
.encadre-def b{color:var(--fg);font-weight:600;}
.encadre-etat{font-size:12px;display:flex;gap:4px 8px;flex-wrap:wrap;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-soft);margin-bottom:2px;}
.encadre-etat .att{color:var(--contre);font-weight:600;}
.encadre-etat .sep{color:var(--fg-muted);}
.arobase{color:var(--accent);font-weight:600;}
.composer{position:relative;}
.suggestions{position:absolute;left:16px;bottom:calc(100% - 4px);background:var(--surface);border:1px solid var(--border);border-radius:4px;box-shadow:0 6px 18px rgba(0,0,0,.15);font-size:12.5px;min-width:240px;z-index:50;}
.suggestions button{display:block;width:100%;text-align:left;border:none;background:none;padding:5px 10px;cursor:pointer;color:var(--fg);font-size:12.5px;}
.suggestions button:hover,.suggestions button.sel{background:var(--accent-bg);}
.suggestions small{color:var(--fg-muted);}
.role{font-size:9.5px;background:var(--info-bg);color:var(--info);border-radius:3px;padding:0 5px;font-weight:600;}

/* Liste « À traiter » */
.page-traiter{flex:1;overflow-y:auto;padding:18px 20px 30px;}
.page-traiter h2{font-size:16px;margin-bottom:4px;}
.page-traiter .intro{font-size:12.5px;color:var(--fg-muted);margin-bottom:16px;}
.section-t{margin-bottom:20px;max-width:1150px;}
.section-t h3{font-size:13px;margin-bottom:4px;}
.section-t .aide{font-size:11.5px;color:var(--fg-muted);margin-bottom:8px;}
.ligne-t{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:4px 12px;align-items:start;background:var(--surface);border:1px solid var(--border-soft);border-radius:4px;padding:8px 12px;margin-bottom:6px;font-size:12.5px;}
.ligne-t .comp-t{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--fg-muted);padding-top:2px;}
.ligne-t .detail{display:block;font-size:11.5px;color:var(--fg-muted);}
.ligne-t .actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
.tags-t{display:flex;gap:4px;flex-wrap:wrap;margin:3px 0;}
.tag-t{font-size:10.5px;font-weight:600;border-radius:3px;padding:0 6px;}
.tag-t.e{background:var(--info-bg);color:var(--info);}
.tag-t.p{background:var(--probable-bg);color:var(--probable);}
.raisons{list-style:none;margin:3px 0 0;padding:0;font-size:12px;display:flex;flex-direction:column;gap:2px;}
.raisons li{border-left:2px solid var(--contre);padding-left:7px;}
.raisons li.ajout{border-left-color:var(--fort);}
.raisons li.retrait{border-left-color:var(--info);}
@container (max-width:860px){.ligne-t{grid-template-columns:1fr;}.ligne-t .actions{justify-content:flex-start;}.bulle{margin-left:12px;}.voile{padding:12px 8px;}.msg.rattache{margin-left:16px;}}
`;

const GABARIT=`<div class="racine">
<div class="bandeau-dev" id="bandeau-dev" hidden>DEV</div>
<div class="verrou-fond" id="verrou" hidden><form class="verrou" id="verrou-form">
  <div class="bascule" role="group" aria-label="Langue / Language"><button type="button" class="lang-choice" data-lang="fr" lang="fr">Français</button><button type="button" class="lang-choice" data-lang="en" lang="en">English</button></div>
  <h2 id="verrou-titre"></h2><p id="verrou-expl"></p>
  <label id="verrou-champ"><span id="verrou-l"></span><input id="verrou-code" type="password" autocomplete="off" maxlength="60"></label>
  <p class="ident-erreur" id="verrou-erreur" role="alert" hidden></p>
  <button type="submit" id="verrou-ok"></button>
</form></div>
<div class="banniere" id="banniere" hidden><span id="banniere-txt"></span><button type="button" id="banniere-btn"></button></div>

<div id="landing" class="landing">
  <div class="landing-inner">
    <div class="landing-outils"><div class="lang-choices"><button class="lang-choice" data-lang="fr">Français</button><button class="lang-choice" data-lang="en">English</button></div><button class="ident-btn ident-accueil"></button></div>
    <h1 id="landing-title"></h1>
    <p id="landing-tag"></p>
    <div class="comp-grille" id="comp-grille"></div>
  </div>
</div>

<div id="app" class="app-shell" hidden>
  <header class="app-header">
    <button id="nav-toggle">☰</button>
    <div class="header-info">
      <div class="header-doc" id="header-doc"></div><div class="header-sous" id="header-sous" hidden></div>
    </div>
    <div class="vues" role="group"><button class="vue-btn" id="vue-prog" data-vue="prog"></button><button class="vue-btn" id="vue-ref" data-vue="ref"></button></div>
    <div class="header-actions">
      <label id="links-wrap">
        <input type="checkbox" id="crossref-cb"><span id="links-label"></span>
      </label>
      <span class="sync" id="sync"></span>
      <button id="btn-traiter" hidden></button>
      <span class="cloche" id="cloche" hidden><button id="btn-cloche"></button><div class="notifs" id="notifs" hidden></div></span>
      <button class="ident-btn"></button>
      <button class="lang-btn" id="lang-btn"></button>
      <button id="undo-btn" class="icon-btn" disabled><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 2.5 7 6 10.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 7h6.5a3.5 3.5 0 0 1 0 7H7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
      <button id="theme-btn" class="icon-btn"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg></button>
    </div>
  </header>
  <div class="body-row">
    <nav class="left-nav" id="left-nav">
      <button class="nav-home" id="nav-home"></button>
      <div class="nav-divider"></div>
      <div class="nav-label" id="nav-label-comp"></div>
      <div id="nav-comps"></div>
    </nav>
    <div class="main-area">
      <div class="content-row" id="content-row">
        <div class="pane" id="pane-prog"><div class="sheet doc-prog" id="sheet-prog"></div></div>
        <div class="pane" id="pane-ref"><div class="sheet doc-ref" id="sheet-ref"></div></div>
      </div>
      <div class="page-traiter" id="page-traiter" hidden></div>
      <div class="fil" id="fil">
        <div class="fil-barre">
          <button class="comp-nav" id="fil-prev"></button>
          <div class="fil-onglets"><button class="fil-onglet" data-onglet="discussion" id="onglet-discussion"></button><button class="fil-onglet" data-onglet="ecarts" id="onglet-ecarts" hidden></button></div>
          <button class="comp-nav" id="fil-next"></button>
        </div>
        <div class="fil-corps" id="fil-corps" hidden>
          <div class="fil-cols">

            <div class="fil-droite">
              <div class="fil-titre" id="fil-titre"></div>
              <div class="fil-liste" id="fil-liste"></div>
              <form class="composer" id="composer">

                <div class="composer-ligne"><textarea id="composer-txt" rows="2" maxlength="2000"></textarea><button type="submit" id="composer-ok"></button></div>
                <div class="suggestions" id="suggestions" hidden></div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="voile" id="encadre" hidden><div class="encadre" id="encadre-boite" role="dialog" aria-modal="true" aria-labelledby="encadre-titre" tabindex="-1"></div></div>
<div class="tooltip" id="tooltip" hidden></div>

<div class="modal-fond" id="ident" hidden>
  <form class="modal" id="ident-form">
    <div class="bascule" id="ident-langue" role="group" aria-label="Langue / Language" hidden><button type="button" class="lang-choice" data-lang="fr" lang="fr">Français</button><button type="button" class="lang-choice" data-lang="en" lang="en">English</button></div>
    <div class="ident-onglets" id="ident-onglets" role="tablist" hidden><button type="button" role="tab" data-mode-ident="connecter"></button><button type="button" role="tab" data-mode-ident="creer"></button></div>
    <h2 id="ident-titre"></h2>
    <p id="ident-expl"></p>
    <label id="ident-nom-wrap"><span id="ident-l-nom"></span><input id="ident-nom" autocomplete="name" maxlength="60" required></label>
    <label id="ident-courriel-wrap"><span id="ident-l-courriel"></span><input id="ident-courriel" type="email" autocomplete="email" maxlength="120"></label>
    <label id="ident-centre-wrap" hidden><span id="ident-l-centre"></span><select id="ident-centre"></select></label>
    <label id="ident-mdp-wrap" hidden><span id="ident-l-mdp"></span><input id="ident-mdp" type="password" autocomplete="current-password" maxlength="100"></label>
    <p class="ident-erreur" id="ident-erreur" role="alert" hidden></p>
    <div class="modal-actions"><button type="button" class="lien" id="ident-mode"></button><button type="button" class="lien" id="ident-deconnexion" hidden></button><button type="button" id="ident-annuler"></button><button type="submit" id="ident-ok"></button></div>
  </form>
</div>
</div>`;

const UI={
 fr:{retirerProbable:"Retirer la mention « probable » : le lien est gardé",ouvrirComp:"Ouvrir cette compétence",soutien:"Pour du soutien :",proposer:"Proposer",choisirElement:"— Élément —",plusTip:"Proposer un ajout",modifie:"modifié",supprimer:"Supprimer",supprimerMsg:"Supprimer mon message",modifierMsg:"Modifier mon message",mesPropsTip:"Superposer mes propositions à la version maître",mesProps:"Mes propositions",proposerRetrait:"Proposer ce retrait",proposerAjout:"Proposer cet ajout",proposeLe:"Proposée le {d}",title:'DEP 5319 — Charpenterie-menuiserie',tagline:"Outil de concordance — Référentiel d'évaluation 5319 & Programme d'études",ref:"Référentiel d'évaluation",prog:"Programme d'études",nav:'Navigation',links:'Liens',linksTip:"Afficher les liens vers l'autre document",undo:'Annuler (Ctrl+Z)',nothing:'Rien à annuler',theme:"Inverser l'affichage",comp:'Compétences',refShort:'📋 Référentiel',progShort:'🔨 Programme',vueRefTip:"Afficher ou masquer le référentiel d'évaluation",vueProgTip:"Afficher ou masquer le programme d'études",home:'⌂ Accueil',yesno:'Oui / Non',pts:'pts',noSubs:'Aucun sous-critère.',tol:'Tolérance :',seuil:'Seuil de réussite :',el:'Él.',global:'Global',situ:'Compétence traduite en situation',lang:'EN',
  typeSitu:'Situation',typeComp:'Comportement',duree:'Durée :',heures:'{n} heures',hCourt:'{n} h',
  editMaitre:'Modifier les liens de ce critère dans la version maître',editCentre:"Proposer des changements aux liens de ce critère",editClose:"Fermer l'édition",
  
  probableCourt:'probable',
  legProbable:'probable',legAttente:"en attente d'une décision",legTrace:"proposition",
  tipProbable:"Mention « probable » : les administrateurs n'ont pas encore tranché ce lien.",
  pourTip:'Je suis pour',contreTip:'Je suis contre',personne:'personne',
  nPour:'pour',nContre:'contre',nCentre:'centre',nCentres:'centres',
  raisonContre:'Raison du vote contre',
  traceRetrait:"Proposition de retrait de {n}, le {d}{s} : {r}",traceAjout:"Ajout proposé par {n}, le {d}{s} : {r}",
  
  
  etatAttente:"en attente",etatClasse:"non retenue par {n}, le {d}",
  notreCommentaire:"Mon commentaire",raisonAjout:"Raison de l'ajout",raisonRetrait:"Raison du retrait",
  retirerLien:'Retirer',annuler:'Annuler',enregistrer:'Enregistrer',
  maintenir:'Maintenir',
  adopter:'Adopter',adopterAjout:"Adopter",classer:"Ne pas retenir",classerTip:"La proposition reste visible, avec la mention « non retenue ».",
  discussion:'Discussion',discTitre:'Discussion de la compétence {c}',
  videDiscussion:'Aucun message pour l\'instant.',videEcarts:"Vous n'avez aucune proposition dans cette compétence.",
  composerPh:'Écrire un message… (@ pour mentionner, Ctrl+Entrée pour envoyer)',envoyer:'Envoyer',critere:'Critère :',element:'Élément :',
  eContre:'{n} a voté contre ce lien.',eCommentaire:"{n} a modifié son commentaire.",eCommentaireLien:"{n} a commenté ce lien.",cite:'« {t} »',eBloque:"Trop d'essais : réessayez dans 15 minutes.",
  eAjout:'{n} a ajouté le lien à la version maître.',eRetrait:'{n} a retiré le lien de la version maître.',eRemis:'{n} a remis le lien dans la version maître.',eMaintenu:'{n} a maintenu le lien.',eAdopte:"{n} a adopté la proposition de {c}.",eClasse:"{n} ne retient pas la proposition de {c}.",eEcartAjout:"{n} propose d'ajouter ce lien.",
  traiter:'À traiter',traiterTitre:'À traiter',
  traiterS1:'Liens de la version maître à trancher',
  traiterS2:"Ajouts proposés",
  traiterVide:'Rien à traiter pour le moment.',retirePar:"proposition de retrait de {c}",ajoutePar:"ajout proposé par {c}",raisons:'Raisons :',fil:'Détail',fermer:'Fermer',encMaitre:'Version maître',encHors:'Hors de la version maître',encAttente:"en attente d'une décision des administrateurs",encVide:'Aucun geste ni commentaire sur ce lien.',classeCourt:"non retenue",
  notifications:'Notifications',toutLu:'Tout marquer comme lu',aucuneNotif:'Aucune notification.',
  nMention:'{n} a mentionné votre nom dans la discussion de {comp}.',nDecisionMaintenu:'{n} a maintenu le lien {l} ({comp}), contre lequel vous avez voté.',nDecisionRetrait:'{n} a retiré le lien {l} ({comp}), contre lequel vous avez voté.',
  nAdopte:"{n} a adopté votre proposition : {l} ({comp}).",nClasse:"{n} n'a pas retenu votre proposition : {l} ({comp}).",nRemis:'Le lien {l} ({comp}) est de retour dans la version maître : votre vote compte de nouveau.',
  sIdentifier:'👤 Se connecter',deconnecter:'Se déconnecter',identTitre:'Identification',creerTitre:'Créer un compte',connecterTitre:'Se connecter',monCompte:'Mon compte',roleAdmin:'administrateur',identExpl:"Votre nom et votre centre sont visibles par les membres du groupe. Votre courriel n'est vu que par la personne responsable du projet : il sert à vous reconnaître quand vous revenez et à vous écrire au sujet du projet. Ces renseignements sont compilés dans une feuille Google à accès privé, et ils seront effacés à la fin du projet.",connecterExpl:'Entrez le nom et le courriel utilisés à la création de votre compte.',compteActif:'Compte actif :',identExplLocal:'Votre nom accompagne chaque modification et chaque message. En mode local, tout reste dans ce navigateur.',identNom:'Votre nom',identCourriel:'Votre courriel',identCentre:'Votre centre',choisirCentre:'— Choisir votre centre —',identMdp:'Mot de passe administrateur',creer:'Créer mon compte',connecter:'Se connecter',modeConnecter:"J'ai déjà un compte",modeCreer:'Créer un compte',
  eNom:'Ce courriel est déjà associé à un autre nom. Entrez le nom utilisé à la création du compte.',eInconnu:"Aucun compte n'utilise ce courriel. Vérifiez-le, ou créez un compte.",eCourriel:"Ce courriel n'est pas valide.",eCentre:'Choisissez votre centre.',eReseau:'Impossible de joindre la feuille Google. Réessayez dans un moment.',eMdpRequis:'Ce compte est un compte administrateur : entrez son mot de passe.',eMdp:'Mot de passe refusé.',
  verrouTitre:'DEP 5319 — Outil de concordance',verrouExpl:"Cet outil est réservé à la communauté de pratique. Entrez le code d'accès reçu avec votre invitation.",verrouCode:"Code d'accès",verrouOk:"Ouvrir l'outil",verrouRefuse:"Code d'accès refusé.",verrouReseau:'Impossible de joindre la feuille Google. Vérifiez votre connexion, puis réessayez.',verrouChargement:'Chargement…',reessayer:'Réessayer',
  sLocal:'Mode local',sOk:'✓ À jour',sEnvoi:'Enregistrement…',sChargement:'Chargement…',sErreur:'⚠ Non enregistré',sTitreFeuille:"Les modifications sont enregistrées dans la feuille Google partagée de l'équipe.",sTitreLocal:'Les modifications sont enregistrées dans ce navigateur seulement.',
  bReseau:'Impossible de joindre la feuille Google : la dernière modification n’a peut-être pas été enregistrée.',bCompte:'Votre compte est introuvable dans la feuille : reconnectez-vous.',bAdmin:'Mot de passe administrateur refusé : reconnectez-vous.',bCentre:"Ce geste est réservé à l'auteur de la proposition.",bRecent:"Un geste plus récent d'un autre administrateur sur ce lien empêche l'annulation."},
 en:{retirerProbable:"Remove the \"probable\" mention: the link is kept",ouvrirComp:"Open this competency",soutien:"For support:",proposer:"Propose",choisirElement:"— Element —",plusTip:"Propose an addition",modifie:"edited",supprimer:"Delete",supprimerMsg:"Delete my message",modifierMsg:"Edit my message",mesPropsTip:"Show my proposals over the master version",mesProps:"My proposals",proposerRetrait:"Propose this removal",proposerAjout:"Propose this addition",proposeLe:"Proposed {d}",title:'DVS 5819 — Carpentry',tagline:'Cross-reference tool — Specifications for Evaluation 5819 & Program of Study',ref:'Specifications for Evaluation',prog:'Program of Study',nav:'Navigation',links:'Links',linksTip:'Show links to the other document',undo:'Undo (Ctrl+Z)',nothing:'Nothing to undo',theme:'Invert display',comp:'Competencies',refShort:'📋 Specifications',progShort:'🔨 Program',vueRefTip:'Show or hide the specifications for evaluation',vueProgTip:'Show or hide the program of study',home:'⌂ Home',yesno:'Yes / No',pts:'marks',noSubs:'No sub-criteria.',tol:'Tolerance:',seuil:'Passing threshold:',el:'El.',global:'Overall',situ:'Competency translated into a situation',lang:'FR',
  typeSitu:'Situation',typeComp:'Behaviour',duree:'Duration:',heures:'{n} hours',hCourt:'{n} h',
  editMaitre:'Edit the links of this criterion in the master version',editCentre:"Propose changes to the links of this criterion",editClose:'Close editing',
  
  probableCourt:'probable',
  legProbable:'probable',legAttente:"awaiting a decision",legTrace:"proposal",
  tipProbable:'"Probable": the administrators have not yet ruled on this link.',
  pourTip:'I agree',contreTip:'I disagree',personne:'nobody',
  nPour:'for',nContre:'against',nCentre:'centre',nCentres:'centres',
  raisonContre:'Reason for voting against',
  traceRetrait:"Removal proposed by {n}, {d}{s}: {r}",traceAjout:"Addition proposed by {n}, {d}{s}: {r}",
  
  
  etatAttente:"awaiting a decision",etatClasse:"not retained by {n}, {d}",
  notreCommentaire:"My comment",raisonAjout:"Reason for adding",raisonRetrait:"Reason for removing",
  retirerLien:'Remove',annuler:'Cancel',enregistrer:'Save',
  maintenir:'Keep',
  adopter:'Adopt',adopterAjout:"Adopt",classer:"Do not retain",classerTip:"The proposal stays visible, marked \"not retained\".",
  discussion:'Discussion',discTitre:'{c} discussion',
  videDiscussion:'No messages yet.',videEcarts:"You have no proposals in this competency.",
  composerPh:'Write a message… (@ to mention, Ctrl+Enter to send)',envoyer:'Send',critere:'Criterion:',element:'Element:',
  cite:'"{t}"',eBloque:'Too many attempts: try again in 15 minutes.',eContre:'{n} voted against this link.',eCommentaire:"{n} edited their comment.",eCommentaireLien:"{n} commented on this link.",
  eAjout:'{n} added the link to the master version.',eRetrait:'{n} removed the link from the master version.',eRemis:'{n} put the link back in the master version.',eMaintenu:'{n} kept the link.',eAdopte:"{n} adopted {c}'s proposal.",eClasse:"{n} did not retain {c}'s proposal.",eEcartAjout:"{n} proposes adding this link.",
  traiter:'To review',traiterTitre:'To review',
  traiterS1:'Master-version links to decide',
  traiterS2:"Proposed additions",
  traiterVide:'Nothing to review for now.',retirePar:"removal proposed by {c}",ajoutePar:"addition proposed by {c}",raisons:'Reasons:',fil:'Details',fermer:'Close',encMaitre:'Master version',encHors:'Not in the master version',encAttente:'awaiting a decision by the administrators',encVide:'No changes or comments on this link.',classeCourt:"not retained",
  notifications:'Notifications',toutLu:'Mark all as read',aucuneNotif:'No notifications.',
  nMention:'{n} mentioned you in the {comp} discussion.',nDecisionMaintenu:'{n} kept the link {l} ({comp}), which you voted against.',nDecisionRetrait:'{n} removed the link {l} ({comp}), which you voted against.',
  nAdopte:"{n} adopted your proposal: {l} ({comp}).",nClasse:"{n} did not retain your proposal: {l} ({comp}).",nRemis:'The link {l} ({comp}) is back in the master version: your vote counts again.',
  sIdentifier:'👤 Sign in',deconnecter:'Sign out',identTitre:'Identification',creerTitre:'Create an account',connecterTitre:'Sign in',monCompte:'My account',roleAdmin:'administrator',identExpl:'Your name and centre are visible to the members of the group. Your email is seen only by the project lead: it is used to recognize you when you come back and to write to you about the project. This information is kept in a private Google Sheet and will be deleted at the end of the project.',connecterExpl:'Enter the name and email you used to create your account.',compteActif:'Active account:',identExplLocal:'Your name is attached to each change and message. In local mode, everything stays in this browser.',identNom:'Your name',identCourriel:'Your email',identCentre:'Your centre',choisirCentre:'— Choose your centre —',identMdp:'Administrator password',creer:'Create my account',connecter:'Sign in',modeConnecter:'I already have an account',modeCreer:'Create an account',
  eNom:'This email is already linked to another name. Enter the name used when the account was created.',eInconnu:'No account uses this email. Check it, or create an account.',eCourriel:'This email is not valid.',eCentre:'Choose your centre.',eReseau:'Unable to reach the Google Sheet. Try again in a moment.',eMdpRequis:'This is an administrator account: enter its password.',eMdp:'Password refused.',
  verrouTitre:'DVS 5819 — Cross-reference tool',verrouExpl:'This tool is reserved for the community of practice. Enter the access code you received with your invitation.',verrouCode:'Access code',verrouOk:'Open the tool',verrouRefuse:'Access code refused.',verrouReseau:'Unable to reach the Google Sheet. Check your connection, then try again.',verrouChargement:'Loading…',reessayer:'Retry',
  sLocal:'Local mode',sOk:'✓ Up to date',sEnvoi:'Saving…',sChargement:'Loading…',sErreur:'⚠ Not saved',sTitreFeuille:"Changes are saved to the team's shared Google Sheet.",sTitreLocal:'Changes are saved in this browser only.',
  bReseau:'Unable to reach the Google Sheet: the last change may not have been saved.',bCompte:'Your account cannot be found in the sheet: sign in again.',bAdmin:'Administrator password refused: sign in again.',bCentre:"This action is reserved for the author of the proposal.",bRecent:"A more recent change by another administrator on this link prevents the undo."}
};

// Adresse de soutien, proposée avec toute erreur de connexion au compte.
const COURRIEL_SOUTIEN='alexandre.lavoie@gmail.com';

function monter(host){
  const D=window.DEP5319_DONNEES;
  const R=host.attachShadow({mode:'open'});
  if(!D){R.innerHTML='<p style="font:14px sans-serif;padding:16px">Données introuvables : chargez donnees-5319.js avant concordance-5319.js.</p>';return;}
  // Les @font-face ne s'appliquent pas depuis un Shadow DOM : la feuille de polices va dans la page hôte.
  if(!document.querySelector('link[data-concordance-polices]')){const l=document.createElement('link');l.rel='stylesheet';l.href=POLICES;l.dataset.concordancePolices='';document.head.appendChild(l);}
  R.innerHTML=`<style>${CSS}</style>${GABARIT}`;
  const $=id=>R.getElementById(id);
  const COMP_ORDER=D.ordre,COMPETENCES=D.competences;
  const urlFeuille=host.getAttribute('feuille')||URL_FEUILLE,enLigne=!!urlFeuille;
  // Attribut feuille (page d'essai DEV) : code, compte et mot de passe gardés à part de ceux de la page de production.
  const pre=host.hasAttribute('feuille')?'dep5319dev_':'dep5319_';
  // Attribut dev : un bandeau « DEV » en haut de l'écran.
  $('bandeau-dev').hidden=!host.hasAttribute('dev');
  const lire=k=>{try{return localStorage.getItem(pre+k);}catch(e){return null;}};
  const garder=(k,v)=>{try{localStorage.setItem(pre+k,v);}catch(e){}};
  const oublier=k=>{try{localStorage.removeItem(pre+k);}catch(e){}};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let lang=lire('lang')==='en'?'en':'fr';
  let curComp=COMPETENCES[lire('comp')]?lire('comp'):COMP_ORDER[0];
  const etroit=()=>(host.clientWidth||window.innerWidth)<=760;
  let navOpen=!etroit(),crossRef=true;
  let vues={prog:true,ref:true};try{const v=JSON.parse(lire('vues'));if(v&&(v.prog||v.ref))vues={prog:!!v.prog,ref:!!v.ref};}catch(e){}
  let version='';   // '' : la version maître (les participants n'éditent pas)
  let expandedEcs=new Set(),expandedEls=new Set(),collapsedInds=new Set(),selectedEc=null;
  let filOnglet=null,filJusteOuvert=false,encadre=null;   // encadre : le lien affiché par-dessus l'outil, {c, k}
  let page='';   // '' : la compétence; 'traiter' : la liste des administrateurs
  let journal=[],messages=[],votes=[],enAttente=[],msgAttente=[],voteAttente=[],annulAttente=[],undoStack=[],cache=null;
  // Compte : numéro de participant et courriel, gardés dans ce navigateur pour signer chaque envoi à la feuille.
  // Le mot de passe d'un administrateur y est aussi gardé après sa connexion.
  let nom=lire('nom')||'',code=lire('code')||'',centre=lire('centre')||'',participant=lire('participant')||'',courriel=lire('courriel')||'',role=lire('role')||'',mdp=lire('mdp')||'';
  let centres=[],participants=[];
  let pret=!enLigne;   // les données de la feuille ont été reçues au moins une fois
  let sync='';   // '', 'chargement', 'envoi', 'erreur-compte', 'erreur-admin', 'erreur-centre', 'erreur-reseau'
  let brouillons={};   // propositions en cours : {élément: {geste}} en attente de leur raison
  let msgEdition=null,msgSuppr=null;   // mon message en cours de modification {ts, texte}, ou à supprimer (ts)
  let ajoutOuvert=null,ajoutTexte='',ajoutEl='';   // le critère dont la boîte « Proposer un ajout » est ouverte
  let voteContre=null; // lien dont on écrit la raison d'un vote contre
  let notifsOuvert=false,vueActive='landing';
  let voteContreTexte='',commentairesEnCours={};   // saisie en cours, gardée d'un rendu à l'autre
  const connecte=()=>enLigne?!!participant:!!nom;
  const estAdmin=()=>!enLigne||(role==='administrateur'&&!!mdp&&!!participant);
  const moi=()=>enLigne?participant:'local';
  // Mes propositions : « p » + mon numéro. Les administrateurs modifient la version maître directement.
  const maVersion=()=>enLigne&&participant&&role!=='administrateur'?'p'+participant:'';

  const T=x=>x==null?'':(typeof x==='string'?x:(x[lang]||x.fr||''));
  const U=(k,p)=>{let s=UI[lang][k];if(p)Object.keys(p).forEach(n=>{s=s.split('{'+n+'}').join(p[n]);});return s;};
  const dateHeure=x=>x?new Date(x).toLocaleString(lang==='fr'?'fr-CA':'en-CA',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  const dateCourte=x=>x?new Date(x).toLocaleDateString(lang==='fr'?'fr-CA':'en-CA',{day:'numeric',month:'short'}):'';
  // Auteur d'un geste ou d'un message : le nom et le centre de son compte tels que la feuille les donne aujourd'hui,
  // à défaut ceux enregistrés avec le geste.
  const nomCentre=id=>{const c=id&&centres.find(x=>x.id===id);return c?c.nom:'';};
  const auteur=x=>(x.participant&&participants.find(p=>p.id===x.participant))||x;
  const quiTexte=x=>{const a=auteur(x),nc=nomCentre(a.centre);return nc?`${a.nom} (${nc})`:a.nom;};
  const qui=x=>{const a=auteur(x),nc=nomCentre(a.centre);return `<span><b>${esc(a.nom)}</b>${a.role==='administrateur'?` <span class="role">admin</span>`:''}${nc?` <span class="centre">· ${esc(nc)}</span>`:''}</span>`;};
  const K=(ec,el)=>ec+'|'+el;
  const deK=k=>k.split('|');
  // Code court d'un critère : « CE-03 » en français, « EC-03 » en anglais (l'identifiant reste C3-EC-03).
  const ecCourt=id=>id.replace(/^C\d+-EC-/,lang==='fr'?'CE-':'EC-');
  const shortBadge=id=>/^C\d+-G$/.test(id)?U('global'):id.replace(/^C\d+-E/,U('el'));
  const lienTxt=k=>{const [ec,el]=deK(k);return `${ecCourt(ec)} ↔ ${shortBadge(el)}`;};
  const comp=()=>COMPETENCES[curComp];
  const elById=(id,c=curComp)=>COMPETENCES[c].els.find(e=>e.id===id);
  const ecById=(id,c=curComp)=>COMPETENCES[c].ec.find(e=>e.id===id);
  const libEl=(id,c)=>{const e=elById(id,c);if(!e)return '';const m=T(e.label).match(/^.+?\s+—\s+(.+)$/);return m?m[1]:T(e.label);};

  function applyUI(){
    host.lang=lang;
    $('landing-title').textContent=U('title');$('landing-tag').textContent=U('tagline');
    $('nav-toggle').title=U('nav');$('links-label').textContent=' '+U('links');$('links-wrap').title=U('linksTip');
    $('theme-btn').title=U('theme');$('nav-label-comp').textContent=U('comp');$('nav-home').textContent=U('home');
    $('vue-prog').textContent=U('progShort');$('vue-prog').title=U('vueProgTip');$('vue-ref').textContent=U('refShort');$('vue-ref').title=U('vueRefTip');
    
    majIdent();
    $('ident-l-nom').textContent=U('identNom');$('ident-l-courriel').textContent=U('identCourriel');$('ident-l-centre').textContent=U('identCentre');$('ident-l-mdp').textContent=U('identMdp');
    $('ident-annuler').textContent=U('annuler');
    $('composer-txt').placeholder=U('composerPh');$('composer-ok').textContent=U('envoyer');
    $('lang-btn').textContent=U('lang');$('lang-btn').title=lang==='fr'?'Switch to English':'Passer en français';
    R.querySelectorAll('.lang-choice').forEach(b=>{b.classList.toggle('active',b.dataset.lang===lang);b.setAttribute('aria-pressed',b.dataset.lang===lang);});
    $('verrou-titre').textContent=U('verrouTitre');$('verrou-expl').textContent=U('verrouExpl');$('verrou-l').textContent=U('verrouCode');$('verrou-ok').textContent=U('verrouOk');
    updateUndoBtn();
  }
  function setLang(l){lang=l;garder('lang',l);applyUI();if(!$('ident').hidden)modeIdentite(modeIdent);render();}

  // ---- Données partagées (feuille Google) ou locales (ce navigateur) ----
  function reponse(r){if(!r.ok)throw new Error('reseau');return r.json().then(x=>{if(!x||!x.ok)throw new Error(x&&x.erreur||'reseau');return {journal:x.journal||[],messages:x.messages||[],votes:x.votes||[],centres:x.centres||[],participants:x.participants||[],compte:x.compte};});}
  const local=k=>JSON.parse(lire(k)||'[]');
  const poster=b=>fetch(urlFeuille,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({code,...b})}).then(reponse);
  const backend=enLigne?{
    charger:()=>fetch(urlFeuille+(urlFeuille.includes('?')?'&':'?')+'code='+encodeURIComponent(code)+'&t='+Date.now()).then(reponse),
    ajouter:p=>poster({participant,courriel,motDePasse:mdp,...p}),
    compte:c=>poster({compte:c})
  }:{
    charger:()=>Promise.resolve().then(()=>({journal:local('journal'),messages:local('messages'),votes:local('votes')})),
    ajouter:p=>Promise.resolve().then(()=>{
      const ts=new Date().toISOString(),sig={nom,centre:'',participant:'local'};
      // Ctrl+Z : la ligne du geste est effacée, comme dans la feuille.
      if(p.annuler)garder('journal',JSON.stringify(local('journal').filter(x=>!p.annuler.some(a=>a.ts===x.ts&&a.comp===x.comp&&a.ec===x.ec&&a.el===x.el))));
      if(p.lignes)garder('journal',JSON.stringify(local('journal').concat(p.lignes.map(l=>({ts,comp:l.comp,ec:l.ec,el:l.el,geste:l.geste,...sig})))));
      const ms=(p.messages||[]).map(m=>({ts,comp:m.comp,cible:m.cible||'',el:m.el||'',version:m.version||'',type:m.type||'',texte:m.texte,ref:m.ref||'',...sig}));
      (p.lignes||[]).forEach(l=>{if(l.geste==='proposé')ms.push({ts,comp:l.comp,cible:l.ec,el:l.el,version:'p'+sig.participant,type:'ecart',texte:l.raison,ref:'',...sig});});
      (p.votes||[]).forEach(v=>{if(v.sens==='contre')ms.push({ts,comp:v.comp,cible:v.ec,el:v.el,version:'',type:'contre',texte:v.raison,...sig});});
      if(ms.length)garder('messages',JSON.stringify(local('messages').concat(ms)));
      if(p.votes)garder('votes',JSON.stringify(local('votes').concat(p.votes.map(v=>({ts,comp:v.comp,ec:v.ec,el:v.el,sens:v.sens,...sig})))));
      return {journal:local('journal'),messages:local('messages'),votes:local('votes')};
    })
  };
  // Une requête à la fois : une réponse plus ancienne ne peut pas écraser une plus récente.
  let file=Promise.resolve();
  const enFile=f=>(file=file.then(f));
  function erreur(e){
    const m=e.message;
    if(m==='compte'){participant='';role='';mdp='';['participant','role','mdp'].forEach(oublier);return 'erreur-compte';}
    if(m==='admin'||m==='bloque'){mdp='';oublier('mdp');return 'erreur-admin';}
    if(m==='proposition')return 'erreur-centre';
    if(m==='recent')return 'erreur-recent';
    if(m==='code'){const motif=code?'verrouRefuse':'verrouCode';code='';oublier('code');afficherVerrou(motif);return '';}
    return 'erreur-reseau';
  }
  function appliquer(d){
    const avant=JSON.stringify([journal,messages,votes,centres,participants]);
    journal=d.journal;messages=d.messages;votes=d.votes||[];
    if(d.centres)centres=d.centres;
    if(d.participants)participants=d.participants;
    // Le centre, le nom et le rôle de la personne connectée suivent la feuille : une correction s'applique aussitôt.
    const moiF=enLigne&&participant&&participants.find(p=>p.id===participant);
    if(moiF){
      if(moiF.centre!==centre){centre=moiF.centre;garder('centre',centre);}
      if(moiF.nom!==nom){nom=moiF.nom;garder('nom',nom);}
      if(moiF.role!=='administrateur'&&role){role='';mdp='';oublier('role');oublier('mdp');}
    }
    const change=JSON.stringify([journal,messages,votes,centres,participants])!==avant;
    if(change)cache=null;
    if(d.centres&&!$('ident').hidden)remplirCentres();
    return change;
  }

  function charger(silencieux){
    if(!silencieux&&pret){sync='chargement';render();}
    return enFile(()=>backend.charger().then(d=>{
      const change=appliquer(d);
      if(sync!=='envoi')sync='';
      if(!pret){pret=true;afficherContenu();return true;}
      return change||!silencieux;
    },e=>{
      const s=erreur(e);
      if(s)sync=s;
      if(!pret&&s==='erreur-reseau'){afficherVerrou('verrouReseau');return false;}
      return pret;
    }).then(r=>{if(r)render();}));
  }

  // ---- Ouverture : le code d'accès avant tout affichage ----
  function afficherVerrou(motif){
    const champ=motif!=='verrouChargement'&&motif!=='verrouReseau';
    R.querySelector('.racine').classList.add('attente');
    $('verrou').hidden=false;
    $('verrou-champ').hidden=!champ;
    $('verrou-ok').hidden=motif==='verrouChargement';
    $('verrou-ok').textContent=U(motif==='verrouReseau'?'reessayer':'verrouOk');
    $('verrou-erreur').hidden=!(motif==='verrouRefuse'||motif==='verrouReseau'||motif==='verrouChargement');
    $('verrou-erreur').textContent=motif==='verrouCode'?'':U(motif);
    $('verrou-erreur').style.color=motif==='verrouChargement'?'var(--fg-muted)':'';
    if(champ){$('verrou-code').value='';setTimeout(()=>$('verrou-code').focus(),0);}
    if(motif==='verrouRefuse'||motif==='verrouCode')pret=false;
  }
  function afficherContenu(){
    $('verrou').hidden=true;R.querySelector('.racine').classList.remove('attente');
    $('landing').hidden=vueActive!=='landing';$('app').hidden=vueActive!=='app';
  }
  $('verrou-form').addEventListener('submit',ev=>{
    ev.preventDefault();
    if(!$('verrou-champ').hidden){const c=$('verrou-code').value.trim();if(!c)return;code=c;garder('code',c);}
    afficherVerrou('verrouChargement');charger();
  });

  // ---- Envois : gestes sur les liens, votes, messages (affichés aussitôt, confirmés par la feuille) ----
  // annuler : Ctrl+Z, une requête à part qui fait effacer des lignes du Journal ({ts, comp, ec, el}); elles
  // disparaissent aussitôt de l'affichage, et reviennent si la feuille refuse.
  const cleGeste=x=>x.ts+'#'+x.comp+'#'+K(x.ec,x.el);
  function envoyer({lignes=[],messages:ms=[],votes:vs=[],annuler=[]},u){
    const ts=new Date().toISOString(),sig={nom,centre,participant:moi()};
    const L=lignes.map(l=>({ts,comp:l.comp,ec:l.ec,el:l.el,geste:l.geste,...sig}));
    const M=ms.map(m=>({ts,comp:m.comp,cible:m.cible||'',el:m.el||'',version:m.version||'',type:m.type||'',texte:m.texte,ref:m.ref||'',...sig}));
    lignes.forEach(l=>{if(l.geste==='proposé')M.push({ts,comp:l.comp,cible:l.ec,el:l.el,version:'p'+moi(),type:'ecart',texte:l.raison,...sig});});
    vs.forEach(v=>{if(v.sens==='contre')M.push({ts,comp:v.comp,cible:v.ec,el:v.el,version:'',type:'contre',texte:v.raison,...sig});});
    const V=vs.map(v=>({ts,comp:v.comp,ec:v.ec,el:v.el,sens:v.sens,...sig})),A=annuler.map(cleGeste);
    enAttente=enAttente.concat(L);msgAttente=msgAttente.concat(M);voteAttente=voteAttente.concat(V);annulAttente=annulAttente.concat(A);cache=null;sync='envoi';render();
    return enFile(()=>backend.ajouter(annuler.length?{annuler}:{lignes,messages:ms,votes:vs}).then(d=>{appliquer(d);sync='';return true;},e=>{
      sync=erreur(e);
      if(u){const i=undoStack.indexOf(u);if(i>=0)undoStack.splice(i,1);}
      return false;
    }).then(ok=>{enAttente=enAttente.filter(x=>!L.includes(x));msgAttente=msgAttente.filter(x=>!M.includes(x));voteAttente=voteAttente.filter(x=>!V.includes(x));annulAttente=annulAttente.filter(x=>!A.includes(x));cache=null;render();return ok;}));
  }
  function identifie(suite){if(connecte())return true;ouvrirIdentite(suite);return false;}
  const presentDans=(st,v,k)=>!!st.maitre[k];
  // Gestes des administrateurs : [{comp?, ec, el, geste}]. Chacun s'empile pour Ctrl+Z, qui fait effacer sa ligne du
  // Journal, retrouvée par son horodatage.
  function gesteAdmin(lignes){
    if(!estAdmin())return;
    const pleines=lignes.map(l=>({comp:curComp,...l})),u={lignes:pleines,refs:null};
    undoStack.push(u);if(undoStack.length>100)undoStack.shift();
    envoyer({lignes:pleines},u).then(ok=>{
      if(!ok)return;
      // L'horodatage donné par la feuille : la ligne la plus récente de ce geste, écrite par moi.
      u.refs=pleines.map(l=>{for(let i=journal.length-1;i>=0;i--){const x=journal[i];if(x.participant===moi()&&x.comp===l.comp&&x.ec===l.ec&&x.el===l.el&&x.geste===l.geste)return {comp:l.comp,ec:l.ec,el:l.el,ts:x.ts};}return null;}).filter(Boolean);
      updateUndoBtn();
    });
  }
  function modifierLiens(lignes){gesteAdmin(lignes);}
  function undo(){
    if(!estAdmin())return;
    const u=undoStack[undoStack.length-1];if(!u||!u.refs||u.enCours){updateUndoBtn();return;}
    u.enCours=true;
    const c=u.refs[0]&&u.refs[0].comp;
    if(c&&c!==curComp&&page!=='traiter'){curComp=c;garder('comp',c);expandedEcs.clear();expandedEls.clear();collapsedInds.clear();selectedEc=null;}
    if(!u.refs.length){undoStack.pop();render();return;}
    // Refus parce qu'un autre administrateur a agi depuis : le geste ne pourra plus s'annuler, il quitte la pile.
    envoyer({annuler:u.refs},null).then(ok=>{
      u.enCours=false;if(ok||sync==='erreur-recent'){const i=undoStack.indexOf(u);if(i>=0)undoStack.splice(i,1);}updateUndoBtn();
    });
  }
  function updateUndoBtn(){const b=$('undo-btn');b.hidden=!estAdmin();b.disabled=!(undoStack.length&&undoStack[undoStack.length-1].refs&&!undoStack[undoStack.length-1].enCours);b.title=undoStack.length?`${U('undo')} — ${undoStack.length}`:U('nothing');}
  function voter(k,sens,raison){
    if(!identifie(()=>voter(k,sens,raison)))return;
    const [ec,el]=deK(k);
    envoyer({votes:[{comp:curComp,ec,el,sens,raison}]});
  }
  // Proposer un ajout : la ligne de la proposition, sa raison (dans la discussion) et le 👍 de son auteur.
  function proposerAjout(ec,el,raison){
    if(!identifie(()=>proposerAjout(ec,el,raison)))return;
    const v=maVersion();if(!v)return;
    envoyer({lignes:[{comp:curComp,ec,el,geste:'proposé',raison}],votes:[{comp:curComp,ec,el,sens:'pour'}]}).then(ok=>{if(!ok&&!ajoutOuvert){ajoutOuvert=ec;ajoutEl=el;ajoutTexte=decoderMentions(raison);render();}});
  }
  // Décisions des administrateurs (aussi depuis la liste « À traiter », pour une autre compétence). Une seule
  // proposition par lien : adopté et non retenu visent celle du lien.
  function maintenir(c,k){const [ec,el]=deK(k);gesteAdmin([{comp:c,ec,el,geste:'maintenu'}]);}
  function confirmer(c,k){const [ec,el]=deK(k);gesteAdmin([{comp:c,ec,el,geste:'confirmé'}]);}
  function retirerMaitre(c,k){const [ec,el]=deK(k);gesteAdmin([{comp:c,ec,el,geste:'retiré'}]);}
  function adopter(c,k){const [ec,el]=deK(k);gesteAdmin([{comp:c,ec,el,geste:'adopté'}]);}
  function classer(c,k){const [ec,el]=deK(k);gesteAdmin([{comp:c,ec,el,geste:'non retenu'}]);}

  // ---- État d'une compétence ----
  // Version maître : les liens proposés, puis les gestes du Journal, dans l'ordre. Ajouts proposés (ecarts, par version
  // « p » + numéro de leur auteur) : un seul par lien; une proposition vit tant qu'au moins une personne l'appuie d'un
  // 👍 et que la version maître ne contient pas le lien. Ajouté ou adopté sur un lien qui a une proposition l'adopte.
  // Confirmé retire seulement la mention « probable »; maintenu tranche seulement les votes contre. Les lignes que
  // Ctrl+Z fait effacer (annulAttente) ne comptent déjà plus.
  function etatComp(c){
    if(!cache)cache={};
    if(cache[c])return cache[c];
    const C=COMPETENCES[c],ecs=new Set(C.ec.map(e=>e.id)),els=new Set(C.els.map(e=>e.id));
    const maitre={},probable=new Set(),decision={},retireAvant=new Set(),ecarts={},evts=[],annulees=[];
    Object.entries(C.defaultLinks||{}).forEach(([ec,m])=>Object.entries(m).forEach(([el,s])=>{const k=K(ec,el);maitre[k]=true;if(s!=='fort')probable.add(k);}));
    const valide=x=>x.comp===c&&ecs.has(x.ec)&&els.has(x.el);
    const lignes=journal.concat(enAttente).filter(x=>valide(x)&&!annulAttente.includes(cleGeste(x)));
    const proposition=k=>{for(const cv of Object.keys(ecarts))if(ecarts[cv][k])return cv;return '';};
    // Appui d'un lien juste avant t : le dernier vote de chaque personne avant t, dont au moins un 👍.
    const votesC=votes.concat(voteAttente).filter(x=>valide(x)&&!(enLigne&&participants.length&&!participants.some(p=>p.id===x.participant)));
    const appuye=(k,t,depuis)=>{const d={};votesC.forEach(x=>{if(x.ts<t&&x.ts>=depuis&&K(x.ec,x.el)===k)d[x.participant]=x.sens;});return Object.values(d).includes('pour');};
    // Une proposition qui disparaît faute d'appui quitte la discussion, avec sa raison et la décision de ne pas la retenir.
    const eteindre=(cv,k,t)=>{const p=ecarts[cv][k];p.evt.masque=true;if(p.evtClasse)p.evtClasse.masque=true;annulees.push({v:cv,k,de:p.x.ts,a:t});delete ecarts[cv][k];};
    lignes.forEach(x=>{
      const k=K(x.ec,x.el),g=x.geste,attente=enAttente.includes(x);
      if(g==='confirmé'){probable.delete(k);return;}
      if(g==='maintenu'){decision[k]=x.ts;evts.push({x,k,type:'maintenu',version:'',attente});return;}
      if(g==='ajouté'||g==='adopté'||g==='retiré'){
        const avant=!!maitre[k],apres=g!=='retiré';
        decision[k]=x.ts;probable.delete(k);
        if(avant===apres)return;
        maitre[k]=apres;
        const remis=apres&&retireAvant.has(k);
        if(!apres)retireAvant.add(k);
        const effet=apres?(remis?'remis':'ajout'):'retrait',cv=apres&&proposition(k);
        evts.push({x,k,type:cv?'adopte':effet,effet,version:'',source:cv||'',attente});
        if(cv){delete ecarts[cv][k];evts.push({x,k,type:'adopte',version:cv,attente});}
        return;
      }
      if(g==='non retenu'){const cv=proposition(k),P=cv&&ecarts[cv];if(!P||P[k].etat!=='attente')return;const ev={x,k,type:'classe',version:cv,attente};P[k]=Object.assign({},P[k],{etat:'classe',classe:x,evtClasse:ev});evts.push(ev);return;}
      // Une proposition compte tant que la version maître ne contient pas le lien.
      if(g!=='proposé'||maitre[k])return;
      const v='p'+x.participant,avant=proposition(k);
      // Une proposition encore appuyée reste; la deuxième personne l'appuie de son 👍, et sa raison reste dans la discussion.
      if(avant){if(appuye(k,x.ts,ecarts[avant][k].x.ts))return;eteindre(avant,k,x.ts);}
      const E=ecarts[v]=ecarts[v]||{};
      const ev={x,k,type:'ecart-ajout',version:v,attente};
      E[k]={type:'ajoute',x,etat:'attente',evt:ev};
      evts.push(ev);
    });
    // Votes : le dernier de chaque personne sur chaque lien; un compte supprimé ne compte plus.
    const parPersonne={};
    votes.concat(voteAttente).forEach(x=>{
      if(!valide(x))return;
      if(enLigne&&participants.length&&!participants.some(p=>p.id===x.participant))return;
      parPersonne[K(x.ec,x.el)+'#'+x.participant]=x;
    });
    const vt={};
    const debutProp={};Object.keys(ecarts).forEach(cv=>Object.keys(ecarts[cv]).forEach(k=>{debutProp[k]=ecarts[cv][k].x.ts;}));
    Object.values(parPersonne).forEach(x=>{if(x.sens!=='pour'&&x.sens!=='contre')return;const k=K(x.ec,x.el);if(!maitre[k]&&debutProp[k]&&x.ts<debutProp[k])return;(vt[k]=vt[k]||{pour:[],contre:[]})[x.sens].push(x);});
    const attente=new Set();
    Object.entries(vt).forEach(([k,o])=>{if(maitre[k]&&o.contre.some(x=>!decision[k]||x.ts>decision[k]))attente.add(k);});
    Object.keys(ecarts).forEach(cv=>Object.keys(ecarts[cv]).forEach(k=>{if(!appuye(k,'~',ecarts[cv][k].x.ts))eteindre(cv,k,'~');}));
    const msgs=messages.concat(msgAttente).filter(m=>m.comp===c&&m.texte);
    // La raison d'un vote contre reste dans la discussion tant que ce vote compte : la personne qui le retire ou le
    // change la retire aussi, et une nouvelle raison remplace la précédente. La feuille, elle, garde tout.
    const masques=new Set(),derniere={};
    msgs.forEach(m=>{if(m.type!=='contre'||!m.el)return;const kp=K(m.cible,m.el)+'#'+m.participant;if(derniere[kp])masques.add(derniere[kp]);derniere[kp]=m;});
    Object.entries(derniere).forEach(([kp,m])=>{const v=parPersonne[kp];if(v&&v.sens!=='contre')masques.add(m);});
    msgs.forEach(m=>{if(m.type==='ecart'&&annulees.some(a=>a.v===m.version&&a.k===K(m.cible,m.el)&&m.ts>=a.de&&m.ts<a.a))masques.add(m);});
    // Mes messages modifiés ou supprimés : la dernière modification de l'auteur remplace le texte; une suppression le
    // retire. Les lignes « modif » et « supprime » elles-mêmes ne s'affichent pas.
    const texteDe=new Map(),modifies=new Set(),modifieLe=new Map();
    msgs.forEach(m=>{
      if(m.type!=='modif'&&m.type!=='supprime')return;
      masques.add(m);
      const o=msgs.find(x=>x.type===''&&x.ts===m.ref&&x.participant===m.participant);if(!o)return;
      if(m.type==='supprime')masques.add(o);else{texteDe.set(o,m.texte);modifies.add(o);modifieLe.set(o,m.ts);}
    });
    return cache[c]={maitre,probable,decision,ecarts,evts,votes:vt,attente,msgs,masques,texteDe,modifies,modifieLe,mesVotes:parPersonne};
  }
  const votesDe=(st,k)=>st.votes[k]||{pour:[],contre:[]};
  const monVote=(st,k)=>{const x=st.mesVotes[k+'#'+moi()];return x&&x.sens!=='retrait'?x.sens:'';};
  const ecartsSur=(st,k,type)=>Object.keys(st.ecarts).filter(v=>st.ecarts[v][k]&&(!type||st.ecarts[v][k].type===type)).map(v=>({v,e:st.ecarts[v][k]}));
  const msgsLien=(st,k)=>{const [ec,el]=deK(k);return st.msgs.filter(m=>m.cible===ec&&m.el===el);};
  // Commentaire d'une proposition : le dernier message « ecart » de son auteur sur ce lien.
  const commentaire=(st,v,k)=>{const l=msgsLien(st,k).filter(m=>m.type==='ecart'&&m.version===v);return l.length?l[l.length-1].texte:'';};
  function decompte(st,k){
    const vv=votesDe(st,k),n=new Set(vv.pour.concat(vv.contre).map(x=>(auteur(x).centre)||x.centre).filter(Boolean)).size;
    return `${vv.pour.length} ${U('nPour')}, ${vv.contre.length} ${U('nContre')} · ${n} ${U(n>1?'nCentres':'nCentre')}`;
  }
  const noms=l=>l.length?l.map(x=>quiTexte(x)).join(', '):U('personne');
  // Nom de l'auteur d'une proposition (« p12 »).
  const versionNom=v=>{if(!/^p\d+$/.test(v||''))return v||'';const id=v.slice(1),p=participants.find(x=>x.id===id)||journal.find(x=>x.participant===id);return p?p.nom:v;};
  // Éditer la version maître : les administrateurs seulement.
  const peutEditer=()=>estAdmin();

  // ---- Identification : un compte dans la feuille (nom, courriel, centre); un mot de passe pour les administrateurs ----
  let apresIdentite=null,modeIdent='creer',besoinMdp=false;
  // porte : la page de connexion. Avec la feuille Google, un compte est exigé avant d'afficher quoi que ce soit.
  let porte=false;
  function ouvrirPorte(){
    porte=true;R.querySelector('.racine').classList.add('attente');$('ident').classList.add('porte');
    ouvrirIdentite(null,true);
  }
  function majIdent(){
    const moiX={nom,centre,participant};
    R.querySelectorAll('.ident-btn').forEach(b=>{b.textContent=connecte()?'👤 '+auteur(moiX).nom:U('sIdentifier');b.title=connecte()?quiTexte(moiX):'';});
  }
  function remplirCentres(){
    const s=$('ident-centre'),choix=s.value||centre;
    const tri=centres.slice().sort((a,b)=>a.nom.localeCompare(b.nom,lang,{sensitivity:'base'}));
    s.innerHTML=`<option value="">${esc(U('choisirCentre'))}</option>`+tri.map(c=>`<option value="${esc(c.id)}">${esc(c.nom)}</option>`).join('');
    s.value=tri.some(c=>c.id===choix)?choix:'';
    const visible=enLigne&&modeIdent==='creer'&&centres.length>0;
    $('ident-centre-wrap').hidden=!visible;s.required=visible;
  }
  // Trois modes : créer un compte, se connecter, ou « profil » quand on est déjà connecté (le compte, Se déconnecter, Fermer).
  function modeIdentite(m){
    modeIdent=m;
    const creer=m==='creer',profil=m==='profil';
    $('ident-titre').textContent=U(!enLigne?'identTitre':profil?'monCompte':creer?'creerTitre':'connecterTitre');
    $('ident-expl').textContent=!enLigne?U('identExplLocal'):profil?quiTexte({nom,centre,participant})+(role==='administrateur'?' · '+U('roleAdmin'):''):(participant?`${U('compteActif')} ${quiTexte({nom,centre,participant})}. `:'')+U(creer?'identExpl':'connecterExpl');
    $('ident-nom-wrap').hidden=profil;$('ident-nom').required=!profil;
    $('ident-courriel-wrap').hidden=!enLigne||profil;$('ident-courriel').required=enLigne&&!profil;
    $('ident-mdp-wrap').hidden=profil||!(enLigne&&(besoinMdp||role==='administrateur'));
    // En ligne, hors « Mon compte » : deux onglets, Se connecter et Créer un compte, à la place du titre.
    const onglets=enLigne&&!profil;
    $('ident-onglets').hidden=!onglets;$('ident-titre').hidden=onglets;$('ident-mode').hidden=true;
    R.querySelectorAll('[data-mode-ident]').forEach(b=>{const on=b.dataset.modeIdent===m;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);b.textContent=U(b.dataset.modeIdent==='creer'?'modeCreer':'connecter');});
    $('ident-deconnexion').hidden=!(enLigne&&participant);$('ident-deconnexion').textContent=U('deconnecter');
    $('ident-ok').hidden=profil;$('ident-ok').textContent=U(!enLigne?'enregistrer':creer?'creer':'connecter');
    $('ident-annuler').textContent=U(profil?'fermer':'annuler');$('ident-annuler').hidden=porte;$('ident-langue').hidden=!porte;
    $('ident-erreur').hidden=true;
    remplirCentres();
    if(profil)$('ident-centre-wrap').hidden=true;
  }
  // forcer : se connecter de nouveau même si un compte est en mémoire (compte introuvable, mot de passe refusé).
  function ouvrirIdentite(suite,forcer){
    apresIdentite=suite||null;besoinMdp=false;
    $('ident-nom').value=nom;$('ident-courriel').value=courriel;$('ident-mdp').value='';$('ident-centre').value='';
    const profil=enLigne&&participant&&!forcer&&!suite&&!(role==='administrateur'&&!mdp);
    modeIdentite(profil?'profil':enLigne&&(participant||courriel)?'connecter':'creer');
    $('ident-ok').disabled=false;
    $('ident').hidden=false;(profil?$('ident-annuler'):$('ident-nom')).focus();
  }
  function identiteFaite(){
    const suite=apresIdentite;
    if(porte){porte=false;$('ident').classList.remove('porte');R.querySelector('.racine').classList.remove('attente');}
    $('ident').hidden=true;apresIdentite=null;applyUI();render();
    if(suite)suite();
  }
  // Courriel déjà inscrit avec le même nom : la feuille reconnecte la personne, même depuis « Créer un compte ».
  $('ident-form').addEventListener('submit',ev=>{
    ev.preventDefault();
    const n=$('ident-nom').value.trim();if(!n)return;
    if(!enLigne){nom=n;garder('nom',n);identiteFaite();return;}
    const cou=$('ident-courriel').value.trim().toLowerCase(),ce=$('ident-centre').value,mp=$('ident-mdp').value;
    $('ident-ok').disabled=true;$('ident-erreur').hidden=true;
    enFile(()=>backend.compte({nom:n,courriel:cou,centre:ce,connecter:modeIdent==='connecter',motDePasse:mp}).then(d=>{
      appliquer(d);
      if(d.compte.id!==participant)undoStack=[];
      ({nom,centre,id:participant}=d.compte);role=d.compte.role||'';courriel=cou;mdp=role==='administrateur'?mp:'';
      garder('nom',nom);garder('centre',centre);garder('participant',participant);garder('courriel',courriel);
      if(role){garder('role',role);garder('mdp',mdp);}else{oublier('role');oublier('mdp');}
      sync='';identiteFaite();
    },e=>{
      if(e.message==='motdepasse-requis'||e.message==='motdepasse'){besoinMdp=true;$('ident-mdp-wrap').hidden=false;$('ident-mdp').focus();}
      if(e.message==='code'){afficherVerrou('verrouRefuse');$('ident').hidden=true;return;}
      const cle={nom:'eNom',inconnu:'eInconnu',courriel:'eCourriel',centre:'eCentre','motdepasse-requis':'eMdpRequis',motdepasse:'eMdp',bloque:'eBloque'}[e.message]||'eReseau';
      $('ident-erreur').innerHTML=esc(U(cle))+(cle==='eMdpRequis'?'':`<span class="soutien">${esc(U('soutien'))} <a href="mailto:${COURRIEL_SOUTIEN}">${COURRIEL_SOUTIEN}</a></span>`);
      $('ident-erreur').hidden=false;
    }).then(()=>{$('ident-ok').disabled=false;}));
  });
  $('ident-mode').addEventListener('click',()=>modeIdentite(modeIdent==='creer'?'connecter':'creer'));
  R.querySelectorAll('[data-mode-ident]').forEach(b=>b.addEventListener('click',()=>{if(modeIdent===b.dataset.modeIdent)return;modeIdentite(b.dataset.modeIdent);$('ident-nom').focus();}));
  // Se déconnecter : le compte est oublié par ce navigateur (le code d'accès, lui, reste).
  $('ident-deconnexion').addEventListener('click',()=>{
    nom='';centre='';participant='';courriel='';role='';mdp='';
    ['nom','centre','participant','courriel','role','mdp','notifs_lu'].forEach(oublier);
    undoStack=[];brouillons={};voteContre=null;voteContreTexte='';commentairesEnCours={};selectedEc=null;notifsOuvert=false;page='';msgEdition=null;msgSuppr=null;ajoutOuvert=null;ajoutTexte='';ajoutEl='';
    $('ident').hidden=true;apresIdentite=null;cache=null;applyUI();render();   // render ouvre la page de connexion
  });
  $('ident-annuler').addEventListener('click',()=>{if(porte)return;$('ident').hidden=true;apresIdentite=null;});
  R.querySelectorAll('.ident-btn').forEach(b=>b.addEventListener('click',()=>ouvrirIdentite()));
  $('banniere-btn').addEventListener('click',()=>{if(sync==='erreur-reseau')charger();else ouvrirIdentite(null,true);});
  function majSync(){
    const s=$('sync');
    s.textContent=!enLigne?U('sLocal'):sync==='envoi'?U('sEnvoi'):sync==='chargement'?U('sChargement'):sync.startsWith('erreur')?U('sErreur'):U('sOk');
    s.title=U(enLigne?'sTitreFeuille':'sTitreLocal');s.hidden=enLigne&&!sync;
    s.classList.toggle('erreur',sync.startsWith('erreur'));
    const msg={'erreur-compte':'bCompte','erreur-admin':'bAdmin','erreur-centre':'bCentre','erreur-recent':'bRecent','erreur-reseau':'bReseau'}[sync]||'';
    $('banniere').hidden=!msg;
    if(msg){$('banniere-txt').textContent=U(msg);$('banniere-btn').textContent=U(sync==='erreur-reseau'?'reessayer':'sIdentifier');$('banniere-btn').hidden=sync==='erreur-centre'||sync==='erreur-recent';}
  }

  // ---- Infobulle : texte d'un élément ou d'un critère, avec les remarques sur le lien ----
  const ttEl=$('tooltip');
  function showTT(ev,item,notes){
    if(!item)return;
    const pcs=item.pcs||item.subs&&item.subs.map(s=>({t:s}))||[];
    ttEl.innerHTML=`<div class="tt-title">${T(item.label)}</div>${pcs.length?`<ul>${pcs.map(p=>`<li>${T(p.t!==undefined?p.t:p)}</li>`).join('')}</ul>`:''}${(notes||[]).map(n=>`<div style="margin-top:6px">${esc(n)}</div>`).join('')}`;
    ttEl.hidden=false;posTT(ev);
  }
  function posTT(ev){
    const w=ttEl.offsetWidth||280,h=ttEl.offsetHeight||80;
    let x=ev.clientX+14,y=ev.clientY+14;
    if(x+w>window.innerWidth-8)x=ev.clientX-w-14;
    if(y+h>window.innerHeight-8)y=ev.clientY-h-14;
    ttEl.style.left=x+'px';ttEl.style.top=y+'px';
  }
  function hideTT(){ttEl.hidden=true;}
  document.addEventListener('mousemove',ev=>{if(!ttEl.hidden)posTT(ev);});

  // ---- Accueil ----
  function renderAccueil(){
    $('comp-grille').innerHTML=COMP_ORDER.map(k=>{
      const C=COMPETENCES[k],s=T(C.subtitle),m=s.match(/^(\S+)\s+—\s+(.+)$/),st=etatComp(k),nm=st.msgs.length-st.masques.size;
      let np=0,nc=0;Object.values(st.votes).forEach(v=>{np+=v.pour.length;nc+=v.contre.length;});
      return `<button class="comp-carte${k===curComp?' derniere':''}" data-comp="${k}">`
        +`<span class="carte-code">${m?m[1]:k} · ${U(C.type==='situation'?'typeSitu':'typeComp')}</span>`
        +`<span class="carte-titre">${m?m[2]:s}</span>`
        +`<span class="carte-pied">${nm?`<span title="${esc(U('discussion'))}">💬 ${nm}</span>`:''}${np?`<span title="${esc(U('nPour'))}">👍 ${np}</span>`:''}${nc?`<span title="${esc(U('nContre'))}">👎 ${nc}</span>`:''}${C.heures?`<span class="carte-heures">${U('hCourt',{n:C.heures})}</span>`:''}</span></button>`;
    }).join('');
  }

  // ---- En-tête : version, liste « À traiter », cloche ----
  function updateHeader(){
    $('header-doc').textContent=page==='traiter'?U('traiterTitre'):T(comp().subtitle);
    $('header-sous').hidden=page==='traiter'||comp().type!=='situation';$('header-sous').textContent=U('situ');
    R.querySelectorAll('.nav-btn[data-comp]').forEach(b=>b.classList.toggle('active',page!=='traiter'&&b.dataset.comp===curComp));
    // Administrateurs : le nom d'une compétence qui garde des liens « probable » est en italique.
    R.querySelectorAll('.nav-btn[data-comp]').forEach(b=>{const st=estAdmin()&&etatComp(b.dataset.comp);b.classList.toggle('probable',!!st&&[...st.probable].some(k=>st.maitre[k]));});
    $('vue-prog').classList.toggle('on',vues.prog);$('vue-prog').setAttribute('aria-pressed',vues.prog);
    $('vue-ref').classList.toggle('on',vues.ref);$('vue-ref').setAttribute('aria-pressed',vues.ref);
    $('crossref-cb').checked=crossRef;
    $('left-nav').classList.toggle('collapsed',!navOpen);
    const nT=estAdmin()&&enLigne?aTraiter().length:0;
    $('btn-traiter').hidden=!(estAdmin()&&enLigne);
    $('btn-traiter').innerHTML=`${esc(U('traiter'))}${nT?`<span class="compteur">${nT}</span>`:''}`;
    $('btn-traiter').classList.toggle('on',page==='traiter');
    const nN=connecte()&&enLigne?notifications().filter(n=>n.nouv).length:0;
    $('cloche').hidden=!(connecte()&&enLigne);
    $('btn-cloche').innerHTML=`🔔${nN?`<span class="compteur">${nN}</span>`:''}`;
    $('btn-cloche').title=U('notifications');
    updateUndoBtn();
  }

  // ---- Référentiel : pastilles de la version maître et ajouts proposés, chacun avec ses votes ----
  function traceTxt(st,k,v,e){const m=msgsLien(st,k).filter(x=>x.type==='ecart'&&x.version===v),r=m.length?m[m.length-1].texte:'';return U('traceAjout',{n:quiTexte(e.x),d:dateCourte(e.x.ts),s:e.etat==='classe'?' ('+U('classeCourt')+')':'',r:decoderMentions(r)});}
  // Les pouces d'un lien. Le chiffre du 👎 est rouge tant qu'une décision des administrateurs est attendue.
  function pouces(st,k){
    const vv=votesDe(st,k),vote=monVote(st,k),att=st.attente.has(k);
    return `<button type="button" class="pouce pour${vote==='pour'?' moi':vv.pour.length?' a':''}" data-vote="pour" data-k="${k}" title="${esc(U('pourTip')+' — '+noms(vv.pour))}"><span class="pouce-ic">👍</span>${vv.pour.length?`<small>${vv.pour.length}</small>`:''}</button>`
      +`<button type="button" class="pouce contre${vote==='contre'||voteContre===k?' moi':vv.contre.length?' a':''}" data-vote="contre" data-k="${k}" title="${esc(U('contreTip')+' — '+noms(vv.contre)+(att?' · '+U('legAttente'):''))}"><span class="pouce-ic">👎</span>${vv.contre.length?`<small${att?' class="att"':''}>${vv.contre.length}</small>`:''}</button>`;
  }
  function chipMaitre(st,k){
    // La mention « probable » (lecture initiale des liens) n'est visible que des administrateurs.
    const [,el]=deK(k),pro=estAdmin()&&st.probable.has(k);
    return `<span class="lien-v"><button type="button" class="el-chip lien${pro?' probable':''}" data-elid="${el}" data-k="${k}"><span class="barre-code">${shortBadge(el)}</span></button>${pouces(st,k)}</span>`;
  }
  // Un ajout proposé : pastille pâle, avec ses pouces; « non retenue » s'il y a lieu.
  function chipPropose(st,k,cv,p){
    const [,el]=deK(k),nr=p.etat==='classe';
    return `<span class="lien-v"><button type="button" class="el-chip fantome${nr?' classe':''}" data-elid="${el}" data-k="${k}" data-trace="${esc(traceTxt(st,k,cv,p))}"><span class="barre-code">${shortBadge(el)}</span>${nr?`<span class="etiq">${U('classeCourt')}</span>`:''}</button>${pouces(st,k)}</span>`;
  }
  // partie : 'row' (les pastilles), 'bulle' (la raison d'un vote contre ou la boîte d'un ajout en cours), ou les deux.
  function chipsRef(st,ecId,partie){
    const C=comp(),liste=[];
    C.els.forEach(e=>{
      const k=K(ecId,e.id);
      if(st.maitre[k]){liste.push(chipMaitre(st,k));return;}
      const pr=ecartsSur(st,k,'ajoute')[0];if(pr)liste.push(chipPropose(st,k,pr.v,pr.e));
    });
    // Le + : proposer un ajout, pour un participant connecté (les administrateurs éditent au crayon).
    const libres=C.els.filter(e=>!st.maitre[K(ecId,e.id)]&&!ecartsSur(st,K(ecId,e.id),'ajoute').length);
    if(maVersion()&&libres.length)liste.push(`<button type="button" class="plus-ajout${ajoutOuvert===ecId?' on':''}" data-plus="${ecId}" title="${esc(U('plusTip'))}" aria-label="${esc(U('plusTip'))}" aria-expanded="${ajoutOuvert===ecId}">+</button>`);
    let h=partie!=='bulle'&&liste.length?`<div class="el-chips-row">${liste.join('')}</div>`:'';
    if(partie!=='row'&&voteContre&&deK(voteContre)[0]===ecId)h+=`<form class="bulle" data-bulle="${voteContre}"><input id="raison-contre" data-champ="contre" value="${esc(voteContreTexte)}" maxlength="300" aria-label="${esc(U('raisonContre'))}" placeholder="${esc(U('raisonContre'))}"><button type="submit" class="btn-p danger">${U('envoyer')}</button><button type="button" class="btn-s" data-annuler-vote>${U('annuler')}</button></form>`;
    return h;
  }
  function renderReferentiel(el){
    const st=etatComp(curComp),edit=estAdmin()||(role==='administrateur'&&enLigne);
    let h=`<div class="sp-header"><span>📋 ${U('ref')}</span></div>`;
    if(T(comp().seuil))h+=`<p class="seuil">${U('seuil')} ${T(comp().seuil)}</p>`;
    comp().indicateurs.forEach((ind,si)=>{
      const pts=ind.ecs.reduce((a,id)=>{const e=ecById(id);return a+(e?e.pts:0);},0);
      const indKey=curComp+':'+si,indOpen=!collapsedInds.has(indKey);
      h+=`<div class="ind-section${indOpen?'':' collapsed'}"><div class="ind-header" data-indtgl="${indKey}" role="button" tabindex="0" aria-expanded="${indOpen}"><span class="ind-label">${T(ind.label)}</span><span class="ind-pts">${pts?pts+' '+U('pts'):''}</span><span class="ec-chevron ind-chevron">▼</span></div>`;
      if(indOpen)ind.ecs.forEach(ecId=>{
        const ec=ecById(ecId);if(!ec)return;
        const open=expandedEcs.has(ecId),sel=selectedEc===ecId||ajoutOuvert===ecId;
        h+=`<div class="ec-card${open?' expanded':''}${sel?' selected':''}" data-eckey="${ecId}">`;
        h+=`<div class="ec-head" data-tgl="${ecId}" role="button" tabindex="0" aria-expanded="${open}">`;
        h+=`<span class="ec-code">${ecCourt(ecId)}</span><span class="ec-label">${T(ec.label)}</span>`;
        h+=`<span class="ec-pts">${ec.pts!=null?ec.pts+' '+U('pts'):U('yesno')}</span>`;
        if(edit){const t=sel?U('editClose'):U('editMaitre');h+=`<button class="ec-edit${sel?' on':''}" data-edit="${ecId}" title="${esc(t)}" aria-label="${esc(t)}">✎</button>`;}
        h+=`<span class="ec-chevron">▼</span></div>`;
        if(!open&&crossRef)h+=chipsRef(st,ecId);
        if(open){
          h+=`<div class="ec-body">`;
          if(ec.subs.length)h+=`<ul class="sub-list">${ec.subs.map(s=>`<li>${T(s)}</li>`).join('')}</ul>`;
          else h+=`<p class="no-subs">${U('noSubs')}</p>`;
          if(ec.tol&&T(ec.tol))h+=`<p class="no-subs">${U('tol')} ${T(ec.tol)}</p>`;
          if(crossRef)h+=chipsRef(st,ecId,'row');
          h+=`</div>`;
          if(crossRef)h+=chipsRef(st,ecId,'bulle');
        }
        h+=`</div>`;
      });
      h+=`</div>`;
    });
    el.innerHTML=h;
    bindIndHeaders(el);
    el.querySelectorAll('[data-tgl]').forEach(hd=>hd.addEventListener('click',ev=>{
      if(ev.target.closest('[data-edit]'))return;
      const id=hd.dataset.tgl;
      if(expandedEcs.has(id))expandedEcs.delete(id);else expandedEcs.add(id);
      render();
    }));
    // Le crayon (administrateurs) sélectionne le critère et passe le programme en mode édition.
    el.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',ev=>{
      ev.stopPropagation();
      const id=b.dataset.edit;
      if(selectedEc===id){selectedEc=null;brouillons={};render();return;}
      const ouvrir=()=>{if(!estAdmin())return;selectionner(id);render();};
      if(!estAdmin()){ouvrirIdentite(ouvrir,true);return;}
      ouvrir();
    }));
    el.querySelectorAll('[data-vote]').forEach(b=>b.addEventListener('click',ev=>{
      ev.stopPropagation();
      const k=b.dataset.k,sens=b.dataset.vote,mien=monVote(st,k);
      if(mien===sens){voteContre=null;voter(k,'retrait');return;}
      if(sens==='pour'){voteContre=null;voter(k,'pour');return;}
      if(!identifie(()=>{voteContre=k;render();}))return;
      voteContre=voteContre===k?null:k;voteContreTexte='';render();
      const i=R.getElementById('raison-contre');if(i)i.focus();
    }));
    const bulle=el.querySelector('[data-bulle]');
    if(bulle){
      R.getElementById('raison-contre').addEventListener('input',ev=>{voteContreTexte=ev.target.value;});
      bulle.addEventListener('submit',ev=>{ev.preventDefault();const r=R.getElementById('raison-contre').value.trim();if(!r){R.getElementById('raison-contre').focus();return;}const k=voteContre;voteContre=null;voteContreTexte='';voter(k,'contre',encoderMentions(r));});
      bulle.querySelector('[data-annuler-vote]').addEventListener('click',()=>{voteContre=null;voteContreTexte='';render();});
    }
    // Le + : le programme passe en mode « proposer un ajout » pour ce critère.
    el.querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',ev=>{
      ev.stopPropagation();const id=b.dataset.plus;
      const ouvrir=()=>{
        ajoutOuvert=ajoutOuvert===id?null:id;ajoutTexte='';ajoutEl='';voteContre=null;
        if(ajoutOuvert){if(!vues.prog){vues.prog=true;garder('vues',JSON.stringify(vues));}comp().indicateurs.forEach((ind,si)=>{if(ind.ecs.includes(id))collapsedInds.delete(curComp+':'+si);});}
        render();
      };
      if(!identifie(ouvrir))return;
      ouvrir();
    }));
    el.querySelectorAll('.el-chip[data-elid]').forEach(chip=>{
      const e=elById(chip.dataset.elid),k=chip.dataset.k;if(!e)return;
      const notes=[];
      if(chip.classList.contains('probable'))notes.push(U('tipProbable'));
      if(chip.dataset.trace)notes.push(...chip.dataset.trace.split('\n'));
      chip.addEventListener('mouseenter',ev=>showTT(ev,e,notes));
      chip.addEventListener('mouseleave',hideTT);
      chip.addEventListener('click',ev=>{ev.stopPropagation();ouvrirEncadre(curComp,k,chip);});
    });
  }

  // ---- Programme : lecture, ou mode édition quand un critère est sélectionné ----
  function liensProgramme(st,elId){
    // Pour un élément : les critères liés dans la version maître, puis les ajouts proposés (pâles).
    const r=[];
    comp().ec.forEach(ec=>{
      const k=K(ec.id,elId);
      if(st.maitre[k])r.push({ec:ec.id,cls:'lien'+(estAdmin()&&st.probable.has(k)?' probable':'')});
      else{const pr=ecartsSur(st,k,'ajoute')[0];if(pr)r.push({ec:ec.id,cls:'fantome'+(pr.e.etat==='classe'?' classe':'')});}
    });
    return r;
  }
  function elCardHtml(st,e,opt={}){
    const open=expandedEls.has(e.id);
    const links=opt.chips?liensProgramme(st,e.id):[];
    const hasChips=links.length>0;
    const chips=()=>`<div class="ec-chips-row">${links.map(l=>`<button type="button" class="ec-chip ${l.cls}" data-ecid="${l.ec}"><span class="barre-code">${ecCourt(l.ec)}</span></button>`).join('')}</div>`;
    let cls='el-card'+(open?' expanded':'')+(opt.dimmed?' dimmed':'')+(opt.editable?' editable':'')+(opt.coche?' linked-fort':'')+(opt.ecart?' ecart-'+opt.ecart:'')+(opt.brouillon?' brouillon':'')+(opt.pris?' pris':'');
    let h=`<div class="${cls}" data-elkey="${e.id}"${opt.editable?` data-elrow="${opt.ecId}" data-elid="${e.id}"`:''}>`;
    h+=`<div class="el-card-top" data-eltgl="${e.id}" role="button" tabindex="0" aria-expanded="${open}">`;
    if(opt.editable)h+=`<div class="el-row-check" role="checkbox" tabindex="0" aria-checked="${!!opt.coche}"${opt.pris?' aria-disabled="true"':''}>${opt.coche?'✓':''}</div>`;
    const lab=T(e.label),m=lab.match(/^(.+?)\s+—\s+(.+)$/);
    h+=`<div class="el-card-main"><div class="el-label"><span class="el-code">${m?m[1]:''}</span><span class="el-text">${m?m[2]:lab}</span>${opt.bulle||''}</div>${opt.note||''}</div>`;
    h+=`<span class="ec-chevron el-chevron">▼</span></div>`;
    if(open)h+=`<div class="el-body indent"><ul class="pc-list">${e.pcs.map(p=>`<li>${T(p.t)}</li>`).join('')}</ul>${hasChips?chips():''}</div>`;
    else if(hasChips)h+=`<div class="el-body collapsed indent">${chips()}</div>`;
    return h+`</div>`;
  }
  // Note d'une fiche en mode édition (administrateurs) : « probable », votes, et « Maintenir » s'il y a lieu.
  function noteEdition(st,k){
    if(!st.maitre[k])return '';
    const pro=st.probable.has(k),att=st.attente.has(k),vv=votesDe(st,k);
    const info=[];
    if(vv.pour.length||vv.contre.length)info.push(`<span>${esc(decompte(st,k))}</span>`);
    if(!att)return info.length?`<div class="note-ecart"><div class="ligne">${info.join(' · ')}</div></div>`:'';
    return `<div class="note-ecart"><div class="ligne">${info.join(' · ')}<button type="button" class="btn-p" data-maintenir="${k}">${U('maintenir')}</button></div></div>`;
  }
  // La pastille « probable » d'une fiche en mode édition : un clic sur × la retire (confirmé), le lien est gardé.
  function puceProbable(st,k){
    if(!st.maitre[k]||!st.probable.has(k))return '';
    return `<button type="button" class="puce-probable" data-confirmer="${k}" title="${esc(U('retirerProbable'))}" aria-label="${esc(U('retirerProbable'))}">${U('probableCourt')}<span aria-hidden="true">×</span></button>`;
  }
  function renderProgramme(el){
    const st=etatComp(curComp),editing=selectedEc&&ecById(selectedEc)&&peutEditer();
    const ajout=!editing&&ajoutOuvert&&ecById(ajoutOuvert)&&maVersion()?ajoutOuvert:null;
    let h=`<div class="sp-header"><span>🔨 ${U('prog')}</span>`;
    if(ajout)h+=`<span class="sp-actions"><span class="sp-editing-badge">+ ${ecCourt(ajout)}<button class="sp-close" id="sp-fermer-ajout" title="${esc(U('editClose'))}" aria-label="${esc(U('editClose'))}">✕</button></span></span>`;
    if(editing)h+=`<span class="sp-actions"><span class="sp-editing-badge">✎ ${ecCourt(selectedEc)}<button class="sp-close" id="sp-deselect" title="${esc(U('editClose'))}" aria-label="${esc(U('editClose'))}">✕</button></span></span>`;
    h+=`</div>`;
    if(comp().heures)h+=`<p class="seuil">${U('duree')} ${U('heures',{n:comp().heures})}</p>`;
    if(comp().note)h+=`<p class="comp-note">${T(comp().note)}</p>`;
    if(editing){
      comp().els.forEach(e=>{
        const k=K(selectedEc,e.id);
        h+=elCardHtml(st,e,{editable:true,ecId:selectedEc,coche:!!st.maitre[k],chips:crossRef,note:noteEdition(st,k),bulle:puceProbable(st,k)});
      });
    }else if(ajout){
      // Proposer un ajout : un clic sur un élément libre le choisit, et sa fiche demande la raison. Les éléments déjà
      // liés ou déjà proposés ne se choisissent pas.
      comp().els.forEach(e=>{
        const k=K(ajout,e.id),pris=!!st.maitre[k]||ecartsSur(st,k,'ajoute').length>0,choisi=ajoutEl===e.id;
        const note=choisi?`<form class="note-ecart" data-ajout-form="${e.id}"><input maxlength="300" data-champ="ajout" value="${esc(ajoutTexte)}" placeholder="${esc(U('raisonAjout'))}" aria-label="${esc(U('raisonAjout'))}"><div class="ligne"><button type="submit" class="btn-p">${U('proposer')}</button><button type="button" class="btn-s" data-annuler-ajout>${U('annuler')}</button></div></form>`:'';
        h+=elCardHtml(st,e,{editable:true,ecId:ajout,coche:pris||choisi,pris,ecart:choisi?'ajoute':'',chips:crossRef,note});
      });
    }else{
      // À côté du référentiel, les éléments non évalués s'estompent, seulement quand les liens sont affichés.
      const lies=new Set();comp().ec.forEach(ec=>comp().els.forEach(e=>{if(presentDans(st,version,K(ec.id,e.id)))lies.add(e.id);}));
      const estomper=crossRef&&vues.ref&&lies.size>0;
      comp().els.forEach(e=>{h+=elCardHtml(st,e,{chips:crossRef,dimmed:estomper&&!lies.has(e.id)});});
    }
    el.innerHTML=h;
    bindElCards(el);
    if(ajout){
      $('sp-fermer-ajout').addEventListener('click',()=>{ajoutOuvert=null;ajoutEl='';ajoutTexte='';render();});
      el.querySelectorAll('[data-elrow] .el-row-check').forEach(chk=>{
        const row=chk.closest('[data-elrow]');
        chk.addEventListener('click',ev=>{
          ev.stopPropagation();if(row.classList.contains('pris'))return;
          const id=row.dataset.elid;ajoutEl=ajoutEl===id?'':id;ajoutTexte='';render();
          const i=el.querySelector('[data-ajout-form] input');if(i)i.focus();
        });
      });
      const f=el.querySelector('[data-ajout-form]');
      if(f){
        f.addEventListener('click',ev=>ev.stopPropagation());
        f.querySelector('input').addEventListener('input',ev=>{ajoutTexte=ev.target.value;});
        f.addEventListener('submit',ev=>{
          ev.preventDefault();const r=f.querySelector('input').value.trim();if(!r){f.querySelector('input').focus();return;}
          const ec=ajout,elId=f.dataset.ajoutForm;ajoutOuvert=null;ajoutEl='';ajoutTexte='';
          proposerAjout(ec,elId,encoderMentions(r));
        });
        f.querySelector('[data-annuler-ajout]').addEventListener('click',ev=>{ev.stopPropagation();ajoutEl='';ajoutTexte='';render();});
      }
      return;
    }
    if(!editing)return;
    $('sp-deselect').addEventListener('click',()=>{selectedEc=null;render();});
    el.querySelectorAll('[data-elrow] .el-row-check').forEach(chk=>{
      const row=chk.closest('[data-elrow]');
      chk.addEventListener('click',ev=>{
        ev.stopPropagation();
        const ec=row.dataset.elrow,elId=row.dataset.elid,k=K(ec,elId);
        // Cocher un lien qui a une proposition l'adopte.
        modifierLiens([{ec,el:elId,geste:st.maitre[k]?'retiré':ecartsSur(st,k,'ajoute').length?'adopté':'ajouté'}]);
      });
    });
    el.querySelectorAll('[data-maintenir]').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();maintenir(curComp,b.dataset.maintenir);}));
    el.querySelectorAll('[data-confirmer]').forEach(b=>b.addEventListener('click',ev=>{ev.stopPropagation();confirmer(curComp,b.dataset.confirmer);}));
  }
  function bindIndHeaders(root){
    root.querySelectorAll('[data-indtgl]').forEach(hd=>hd.addEventListener('click',()=>{
      const k=hd.dataset.indtgl;
      if(collapsedInds.has(k))collapsedInds.delete(k);else collapsedInds.add(k);
      render();
    }));
  }
  function bindCrossHover(){
    const app=$('app');
    app.querySelectorAll('.el-chip[data-elid]').forEach(ch=>{
      const id=ch.dataset.elid;
      ch.addEventListener('mouseenter',()=>app.querySelectorAll(`[data-elkey="${id}"]`).forEach(c=>c.classList.add('hl')));
      ch.addEventListener('mouseleave',()=>app.querySelectorAll('.hl').forEach(c=>c.classList.remove('hl')));
    });
    app.querySelectorAll('.ec-chip[data-ecid]').forEach(ch=>{
      const id=ch.dataset.ecid;
      ch.addEventListener('mouseenter',()=>app.querySelectorAll(`[data-eckey="${id}"]`).forEach(c=>c.classList.add('hl')));
      ch.addEventListener('mouseleave',()=>app.querySelectorAll('.hl').forEach(c=>c.classList.remove('hl')));
      const card=ch.closest('[data-elkey]');
      if(card)ch.addEventListener('click',ev=>{ev.stopPropagation();ouvrirEncadre(curComp,K(id,card.dataset.elkey),ch);});
    });
  }
  function bindElCards(root){
    root.querySelectorAll('[data-eltgl]').forEach(c=>c.addEventListener('click',ev=>{
      if(ev.target.closest('.el-row-check')||ev.target.closest('.note-ecart'))return;
      ev.stopPropagation();
      const id=c.dataset.eltgl;
      if(expandedEls.has(id))expandedEls.delete(id);else expandedEls.add(id);
      render();
    }));
    root.querySelectorAll('.ec-chip[data-ecid]').forEach(chip=>{
      const ec=ecById(chip.dataset.ecid);
      if(!ec)return;
      chip.addEventListener('mouseenter',ev=>showTT(ev,{label:ec.label,pcs:ec.subs.map(s=>({t:s}))}));
      chip.addEventListener('mouseleave',hideTT);
    });
  }

  // ---- Discussion et écarts de la compétence; encadré d'un lien ----
  function ouvrirFil(onglet){filOnglet=onglet;filJusteOuvert=true;render();if(onglet==='discussion')$('composer-txt').focus();}
  // L'encadré d'un lien montre, pour ce lien seulement, ce que montre la discussion. Il sert à lire.
  // À la fermeture, le focus revient au bouton qui a ouvert l'encadré (reconstruit entre-temps : on le retrouve par ses attributs).
  let encadreRetour='';
  function selecteurDe(b){
    if(!b)return '';
    const a=['data-ouvrir','data-encadre','data-k','data-ecid'].find(x=>b.hasAttribute(x));if(!a)return '';
    const s=`${b.tagName.toLowerCase()}.${b.classList[0]}[${a}="${b.getAttribute(a)}"]`,carte=b.closest('[data-elkey]');
    return a==='data-ecid'&&carte?`[data-elkey="${carte.dataset.elkey}"] ${s}`:s;
  }
  function ouvrirEncadre(c,k,declencheur){encadre={c,k};encadreRetour=selecteurDe(declencheur);hideTT();render();const b=$('encadre-fermer');if(b)b.focus();}
  function fermerEncadre(){
    encadre=null;render();
    const b=encadreRetour&&R.querySelector(encadreRetour);encadreRetour='';if(b)b.focus();
  }
  const decoderMentions=t=>String(t).replace(/@\[(\d+)\]/g,(_,id)=>{const p=participants.find(x=>x.id===id);return '@'+(p?p.nom:id);});
  const avecMentions=t=>esc(t).replace(/@\[(\d+)\]/g,(_,id)=>{const p=participants.find(x=>x.id===id);return `<span class="arobase">@${esc(p?p.nom:id)}</span>`;});
  function texteEvt(e){
    const n=quiTexte(e.x),c=versionNom(e.version||e.source);
    return U({ajout:'eAjout',retrait:'eRetrait',remis:'eRemis',maintenu:'eMaintenu',adopte:'eAdopte',classe:'eClasse','ecart-ajout':'eEcartAjout'}[e.type],{n,c});
  }
  // Un message de la discussion. Les miens (actions) portent ✎ et 🗑 au bout de la ligne; « modifié » s'il l'a été.
  function msgHtml(m,tag,st,actions){
    // Les messages de l'ancien outil visaient un critère sans élément : on garde l'étiquette du critère.
    const crit=m.cible&&!m.el?`<button type="button" class="tag" data-cible-ec="${esc(m.cible)}">${esc(ecCourt(m.cible))}</button>`:'';
    const texte=st&&st.texteDe.get(m)||m.texte,att=msgAttente.includes(m);
    const mien=actions&&!att&&m.type===''&&connecte()&&m.participant===moi(),edition=mien&&msgEdition&&msgEdition.ts===m.ts,suppr=mien&&msgSuppr===m.ts;
    const act=!mien||edition?'':suppr
      ?`<span class="msg-actions ouvert"><button type="button" class="btn-p danger" data-msg-confirmer="${esc(m.ts)}">${U('supprimer')}</button><button type="button" class="btn-s" data-msg-annuler>${U('annuler')}</button></span>`
      :`<span class="msg-actions"><button type="button" data-msg-modifier="${esc(m.ts)}" title="${esc(U('modifierMsg'))}" aria-label="${esc(U('modifierMsg'))}">✎</button><button type="button" data-msg-supprimer="${esc(m.ts)}" title="${esc(U('supprimerMsg'))}" aria-label="${esc(U('supprimerMsg'))}">🗑</button></span>`;
    const corps=edition
      ?`<form class="msg-edition" data-msg-edition="${esc(m.ts)}"><textarea data-champ="msgedit" maxlength="2000" aria-label="${esc(U('modifierMsg'))}">${esc(msgEdition.texte)}</textarea><div class="ligne"><button type="submit" class="btn-p">${U('enregistrer')}</button><button type="button" class="btn-s" data-msg-annuler>${U('annuler')}</button></div></form>`
      :`<div class="msg-texte">${avecMentions(texte)}</div>`;
    return `<div class="msg${att?' attente':''}"><div class="msg-tete">${qui(m)}${tag||crit}<span>${dateHeure(m.ts)}</span>${st&&st.modifies.has(m)?`<span class="msg-modifie">${U('modifie')}</span>`:''}${act}</div>${corps}</div>`;
  }
  // La discussion d'une compétence : les messages et les gestes, triés par date. Un geste est une ligne discrète; le
  // commentaire d'une proposition ou la raison d'un vote contre le suit en bulle. L'adoption vue du côté de la
  // proposition répète le geste de la version maître : elle n'apparaît qu'une fois.
  const IC_EVT={ajout:'+',retrait:'−',remis:'↺',maintenu:'⚖',adopte:'⇄',classe:'⇄','ecart-ajout':'+'};
  function filElements(st,k){
    const l=[];
    st.evts.forEach(e=>{if(e.masque||(e.version&&e.type==='adopte'))return;if(!k||e.k===k)l.push({ts:e.x.ts,r:0,e});});
    st.msgs.forEach(m=>{const mk=m.el?K(m.cible,m.el):'';if(!k||mk===k)l.push({ts:m.ts,r:1,m,mk});});
    return l.sort((a,b)=>a.ts<b.ts?-1:a.ts>b.ts?1:a.r-b.r);
  }
  // k : l'encadré d'un lien, où l'étiquette du lien est omise.
  function filHtml(st,k){
    const tag=x=>k?'':`<button type="button" class="tag" data-cible="${esc(x)}">${esc(lienTxt(x))}</button> `;
    const ligne=(ic,adm,x,txt,ts,att)=>`<div class="geste${adm?' admin':''}${att?' attente':''}"><span class="ic-g">${ic}</span><span>${tag(x)}${esc(txt)} <span class="q">· ${dateHeure(ts)}</span></span></div>`;
    const bulle=(m,cls)=>`<div class="msg rattache${cls}${msgAttente.includes(m)?' attente':''}"><div class="msg-texte">${avecMentions(m.texte)}</div></div>`;
    // La raison d'un écart part avec son geste, dans le même envoi : même date, même lien, même version.
    // dernier : le type du dernier geste d'écart de chaque version sur chaque lien, déjà passé dans le fil.
    const lies=new Set(),dernier={};
    const raisonDe=e=>{
      if(e.type!=='ecart-ajout')return null;
      const [ec,el]=deK(e.k);
      return st.msgs.find(m=>m.type==='ecart'&&!lies.has(m)&&m.ts===e.x.ts&&m.version===e.version&&m.cible===ec&&m.el===el)||null;
    };
    return filElements(st,k).map(i=>{
      if(i.e){
        const e=i.e,m=raisonDe(e);if(m)lies.add(m);
        if(e.type==='ecart-ajout')dernier[e.version+'#'+e.k]=e.type;
        return ligne(IC_EVT[e.type]||'·',e.version===''||e.type==='classe',e.k,texteEvt(e),e.x.ts,e.attente)+(m?bulle(m,e.type==='ecart-ajout'?' ajout':''):'');
      }
      const m=i.m,att=msgAttente.includes(m);
      if(lies.has(m)||st.masques.has(m))return '';
      if(m.type==='contre'&&i.mk)return ligne('👎',false,i.mk,U('eContre',{n:quiTexte(m)}),m.ts,att)+bulle(m,'');
      // Un commentaire modifié après coup : sa propre ligne, puis le texte, de la couleur du geste commenté. Sans geste
      // d'écart avant lui (le lien rejoignait déjà la version maître à l'envoi), c'est un simple commentaire du centre.
      if(m.type==='ecart'&&i.mk){const g=dernier[m.version+'#'+i.mk];return ligne('✎',false,i.mk,U(g?'eCommentaire':'eCommentaireLien',{n:quiTexte(m),c:versionNom(m.version)}),m.ts,att)+bulle(m,g==='ecart-ajout'?' ajout':'');}
      return msgHtml(m,i.mk?tag(i.mk):'',st,!k);
    }).join('');
  }
  function renderFil(){
    const st=etatComp(curComp);
    $('onglet-discussion').innerHTML=`💬 ${U('discussion')} <span class="compte">${st.msgs.length-st.masques.size}</span>`;
    $('onglet-ecarts').hidden=true;
    if(filOnglet==='ecarts')filOnglet=null;
    R.querySelectorAll('.fil-onglet').forEach(b=>{b.classList.toggle('active',b.dataset.onglet===filOnglet);b.setAttribute('aria-expanded',b.dataset.onglet===filOnglet);});
    const idx=COMP_ORDER.indexOf(curComp),prev=COMP_ORDER[idx-1],next=COMP_ORDER[idx+1];
    [[$('fil-prev'),prev,k=>'‹ '+k],[$('fil-next'),next,k=>k+' ›']].forEach(([b,k,txt])=>{b.style.visibility=k?'visible':'hidden';if(k){b.textContent=txt(k);b.title=T(COMPETENCES[k].subtitle);b.dataset.goto=k;}});
    $('fil-corps').hidden=!filOnglet;
    if(!filOnglet)return;
    const disc=filOnglet==='discussion';
    $('composer').hidden=!disc;$('fil-titre').hidden=!disc;
    const L=$('fil-liste'),enBas=L.scrollHeight-L.scrollTop-L.clientHeight<40;
    if(disc){
      $('fil-titre').innerHTML=`${esc(U('discTitre',{c:curComp}))}`;
      L.innerHTML=filHtml(st,null)||`<p class="vide">${U('videDiscussion')}</p>`;
      if(enBas||filJusteOuvert)L.scrollTop=L.scrollHeight;
    }
    filJusteOuvert=false;
  }
  function renderEncadre(){
    if(encadre&&!COMPETENCES[encadre.c])encadre=null;
    // Pendant que l'encadré est ouvert, le reste de l'outil est inerte : le clavier reste dans l'encadré.
    $('encadre').hidden=!encadre;$('app').inert=!!encadre;$('landing').inert=!!encadre;
    if(!encadre){$('encadre-boite').innerHTML='';return;}
    const dedans=$('encadre').contains(R.activeElement);
    const {c,k}=encadre,st=etatComp(c),[ec,el]=deK(k),etat=[];
    if(st.maitre[k]){
      etat.push(`<b>${esc(U('encMaitre'))}</b>`);
      if(estAdmin()&&st.probable.has(k))etat.push(`<span class="etiq-ecart probable">${U('probableCourt')}</span>`);
      etat.push(`<span>${esc(decompte(st,k))}</span>`);
      if(st.attente.has(k))etat.push(`<span class="att">${esc(U('encAttente'))}</span>`);
    }else etat.push(`<b>${esc(U('encHors'))}</b>`);
    ecartsSur(st,k).forEach(({v,e})=>{etat.push(`<span>${esc(U('ajoutePar',{c:versionNom(v)}))}${e.etat==='classe'?` (${esc(U('classeCourt'))})`:''}</span>`);etat.push(`<span>${esc(decompte(st,k))}</span>`);});
    $('encadre-boite').innerHTML=`<div class="encadre-tete"><h2 id="encadre-titre">${esc(lienTxt(k))}</h2><button type="button" class="btn-s" id="encadre-fermer" aria-label="${esc(U('fermer'))}" title="${esc(U('fermer'))}">✕</button></div>`
      +`<div class="encadre-def"><span><b>${esc(U('critere'))}</b> ${esc(T((ecById(ec,c)||{}).label))}</span><span><b>${esc(U('element'))}</b> ${esc(libEl(el,c))}</span></div>`
      +`<div class="encadre-etat">${etat.join('<span class="sep">·</span>')}</div>`
      +(filHtml(st,k)||`<p class="vide">${esc(U('encVide'))}</p>`);
    $('encadre-fermer').addEventListener('click',fermerEncadre);
    if(dedans&&!$('encadre').contains(R.activeElement))$('encadre-fermer').focus();
  }
  // Un clic à côté de la boîte ferme l'encadré; une sélection de texte commencée dans la boîte, non.
  let basVoile=false;
  $('encadre').addEventListener('mousedown',ev=>{basVoile=ev.target===$('encadre');});
  $('encadre').addEventListener('click',ev=>{if(ev.target===$('encadre')&&basVoile)fermerEncadre();basVoile=false;});
  function selectionner(ecId){
    selectedEc=ecId;
    if(!vues.prog){vues.prog=true;garder('vues',JSON.stringify(vues));}
    comp().indicateurs.forEach((ind,si)=>{if(ind.ecs.includes(ecId))collapsedInds.delete(curComp+':'+si);});
  }
  // Mes messages : ✎ ouvre la modification sur place, 🗑 demande une confirmation sur la même ligne.
  $('fil-liste').addEventListener('click',ev=>{
    const b=ev.target.closest('[data-msg-modifier],[data-msg-supprimer],[data-msg-confirmer],[data-msg-annuler]');if(!b)return;
    ev.stopPropagation();
    if(b.dataset.msgModifier){const st=etatComp(curComp),m=st.msgs.find(x=>x.ts===b.dataset.msgModifier&&x.participant===moi()&&x.type==='');if(!m)return;msgEdition={ts:m.ts,texte:decoderMentions(st.texteDe.get(m)||m.texte)};msgSuppr=null;render();const t=R.querySelector('[data-champ="msgedit"]');if(t){t.focus();t.selectionStart=t.selectionEnd=t.value.length;}return;}
    if(b.dataset.msgSupprimer){msgSuppr=b.dataset.msgSupprimer;msgEdition=null;render();return;}
    if(b.dataset.msgConfirmer){const ref=b.dataset.msgConfirmer;msgSuppr=null;envoyer({messages:[{comp:curComp,type:'supprime',ref,texte:'—'}]});return;}
    msgEdition=null;msgSuppr=null;render();
  });
  $('fil-liste').addEventListener('input',ev=>{if(ev.target.dataset.champ==='msgedit'&&msgEdition)msgEdition.texte=ev.target.value;});
  $('fil-liste').addEventListener('submit',ev=>{
    const f=ev.target.closest('[data-msg-edition]');if(!f)return;
    ev.preventDefault();
    const st=etatComp(curComp),m=st.msgs.find(x=>x.ts===f.dataset.msgEdition&&x.participant===moi()&&x.type==='');
    const t=msgEdition&&msgEdition.texte.trim();
    if(!m||!t){msgEdition=null;render();return;}
    const nouveau=encoderMentions(t);msgEdition=null;
    if(nouveau===(st.texteDe.get(m)||m.texte)){render();return;}
    envoyer({messages:[{comp:curComp,type:'modif',ref:m.ts,texte:nouveau}]}).then(ok=>{if(!ok&&!msgEdition){msgEdition={ts:m.ts,texte:t};render();}});
  });
  // L'étiquette d'un lien ou d'un critère, dans la discussion : on montre le critère dans le référentiel.
  $('fil-liste').addEventListener('click',ev=>{
    const b=ev.target.closest('[data-cible-ec],[data-cible]');if(!b)return;
    const ec=b.dataset.cibleEc||deK(b.dataset.cible)[0];if(!ecById(ec))return;
    comp().indicateurs.forEach((ind,si)=>{if(ind.ecs.includes(ec))collapsedInds.delete(curComp+':'+si);});
    if(!vues.ref){vues.ref=true;garder('vues',JSON.stringify(vues));}
    expandedEcs.add(ec);render();
    const card=R.querySelector(`#sheet-ref [data-eckey="${ec}"]`);if(card)card.scrollIntoView({block:'nearest',behavior:'smooth'});
  });
  R.querySelectorAll('.fil-onglet').forEach(b=>b.addEventListener('click',()=>{if(filOnglet===b.dataset.onglet){filOnglet=null;render();}else{ouvrirFil(b.dataset.onglet);if(enLigne&&pret)charger(true);}}));
  [$('fil-prev'),$('fil-next')].forEach(b=>b.addEventListener('click',()=>{if(b.dataset.goto)goToComp(b.dataset.goto);}));

  // ---- Envoi d'un message, avec mentions @ ----
  // Une mention s'enregistre avec le numéro du participant (« @[12] »), pour survivre à une correction de nom.
  function encoderMentions(t){
    const tri=participants.slice().sort((a,b)=>b.nom.length-a.nom.length);
    tri.forEach(p=>{const re=new RegExp('@'+p.nom.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\w\\u00C0-\\u024F])','g');t=t.replace(re,'@['+p.id+']');});
    return t;
  }
  function envoyerMessage(){
    const brut=$('composer-txt').value.trim();if(!brut)return;
    if(!identifie(envoyerMessage))return;
    const txt=encoderMentions(brut);
    $('composer-txt').value='';$('suggestions').hidden=true;
    envoyer({messages:[{comp:curComp,texte:txt}]}).then(ok=>{if(!ok&&!$('composer-txt').value)$('composer-txt').value=brut;});
  }
  $('composer').addEventListener('submit',ev=>{ev.preventDefault();envoyerMessage();});
  const normal=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let suggestionSel=0;
  function majSuggestions(){
    const ta=$('composer-txt'),avant=ta.value.slice(0,ta.selectionStart),m=avant.match(/@([^\s@\[]{1,30})$/),s=$('suggestions');
    if(!m||!participants.length){s.hidden=true;return;}
    const q=normal(m[1]),liste=participants.filter(p=>normal(p.nom).split(/\s+/).some(w=>w.startsWith(q))||normal(p.nom).startsWith(q)).slice(0,6);
    if(!liste.length){s.hidden=true;return;}
    suggestionSel=Math.min(suggestionSel,liste.length-1);
    s.innerHTML=liste.map((p,i)=>`<button type="button" data-mention="${esc(p.nom)}" class="${i===suggestionSel?'sel':''}">${esc(p.nom)} <small>· ${esc(p.role==='administrateur'?'admin':nomCentre(p.centre))}</small></button>`).join('');
    s.hidden=false;
  }
  function choisirMention(nomP){
    const ta=$('composer-txt'),pos=ta.selectionStart,avant=ta.value.slice(0,pos).replace(/@([^\s@\[]{1,30})$/,'@'+nomP+' ');
    ta.value=avant+ta.value.slice(pos);ta.focus();ta.selectionStart=ta.selectionEnd=avant.length;$('suggestions').hidden=true;
  }
  $('composer-txt').addEventListener('input',()=>{suggestionSel=0;majSuggestions();});
  $('suggestions').addEventListener('mousedown',ev=>{const b=ev.target.closest('[data-mention]');if(b){ev.preventDefault();choisirMention(b.dataset.mention);}});
  $('composer-txt').addEventListener('keydown',ev=>{
    const s=$('suggestions');
    if(!s.hidden){
      const bs=[...s.querySelectorAll('[data-mention]')];
      if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ev.preventDefault();suggestionSel=(suggestionSel+(ev.key==='ArrowDown'?1:-1)+bs.length)%bs.length;majSuggestions();return;}
      if(ev.key==='Enter'||ev.key==='Tab'){ev.preventDefault();if(bs[suggestionSel])choisirMention(bs[suggestionSel].dataset.mention);return;}
      if(ev.key==='Escape'){s.hidden=true;return;}
    }
    if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();envoyerMessage();}
  });

  // ---- Liste « À traiter » (administrateurs) ----
  function aTraiter(){
    const lignes=[];
    COMP_ORDER.forEach(c=>{
      const st=etatComp(c),C=COMPETENCES[c];
      C.ec.forEach(ec=>C.els.forEach(e=>{
        const k=K(ec.id,e.id);
        if(st.maitre[k]){if(st.attente.has(k))lignes.push({c,k,type:'maitre',st});}
        else{const aj=ecartsSur(st,k,'ajoute').filter(a=>a.e.etat==='attente');if(aj.length)lignes.push({c,k,type:'ajout',aj,st});}
      }));
    });
    return lignes;
  }
  // Raisons d'une ligne : celles des votes contre qui comptent encore (le dernier message de chaque votant depuis la
  // dernière décision), et la raison de l'ajout proposé.
  function raisonsHtml(l){
    const st=l.st,dec=st.decision[l.k]||'',items=[],votants=new Set(votesDe(st,l.k).contre.map(x=>x.participant)),parVotant={};
    msgsLien(st,l.k).forEach(m=>{if(m.type==='contre'&&m.ts>dec&&votants.has(m.participant))parVotant[m.participant]=m;});
    Object.values(parVotant).forEach(m=>items.push({m,cls:''}));
    (l.aj||[]).forEach(r=>{const parV={};msgsLien(st,l.k).forEach(m=>{if(m.type==='ecart'&&m.ts>=r.e.x.ts&&!st.masques.has(m))parV[m.version]=m;});Object.values(parV).forEach(m=>items.push({m,cls:'ajout'}));});
    items.sort((a,b)=>a.m.ts<b.m.ts?-1:1);
    return items.length?`<ul class="raisons">${items.map(i=>`<li class="${i.cls}">${U('cite',{t:avecMentions(i.m.texte)})} <span class="detail" style="display:inline">— ${esc(quiTexte(i.m))}, ${dateCourte(i.m.ts)}</span></li>`).join('')}</ul>`:'';
  }
  function renderTraiter(){
    const l=aTraiter(),s1=l.filter(x=>x.type==='maitre'),s2=l.filter(x=>x.type==='ajout');
    const quoi=x=>{const [ec,el]=deK(x.k);return `<b>${esc(lienTxt(x.k))}</b> — ${esc(libEl(el,x.c))}<span class="detail">${esc(U('critere'))} ${esc(T((ecById(ec,x.c)||{}).label))}</span>`;};
    const ligne=(x,tags,actions)=>`<div class="ligne-t"><span class="comp-t">${esc(x.c)}</span><span>${quoi(x)}${tags.length?`<span class="tags-t">${tags.join('')}</span>`:''}<span class="detail">${esc(decompte(x.st,x.k))}</span>${raisonsHtml(x)}</span><span class="actions">${actions}<button type="button" class="btn-s" data-ouvrir="${x.c}|${x.k}">${U('ouvrirComp')}</button></span></div>`;
    let h=`<h2>${esc(U('traiterTitre'))}</h2>`;
    if(!l.length)h+=`<p class="vide">${esc(U('traiterVide'))}</p>`;
    if(s1.length)h+=`<div class="section-t"><h3>${esc(U('traiterS1'))} <span class="compteur">${s1.length}</span></h3>${s1.map(x=>ligne(x,x.st.probable.has(x.k)?[`<span class="tag-t p">${U('probableCourt')}</span>`]:[],`<button type="button" class="btn-p" data-maintenir="${x.c}|${x.k}">${U('maintenir')}</button><button type="button" class="btn-p danger" data-retirer="${x.c}|${x.k}">${U('retirerLien')}</button>`)).join('')}</div>`;
    if(s2.length)h+=`<div class="section-t"><h3>${esc(U('traiterS2'))} <span class="compteur">${s2.length}</span></h3>${s2.map(x=>ligne(x,x.aj.map(a=>`<span class="tag-t e">⇄ ${esc(U('ajoutePar',{c:versionNom(a.v)}))}</span>`),`<button type="button" class="btn-p" data-adopter-t="${x.c}|${x.k}|${x.aj[0].v}">${esc(U('adopterAjout'))}</button><button type="button" class="btn-s" data-classer-t="${x.c}|${x.k}|${x.aj.map(a=>a.v).join(',')}" title="${esc(U('classerTip'))}">${U('classer')}</button>`)).join('')}</div>`;
    const P=$('page-traiter');
    P.innerHTML=h;
    const parts=s=>{const [c,ec,el,v]=s.split('|');return {c,k:K(ec,el),v};};
    P.querySelectorAll('[data-maintenir]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.maintenir);maintenir(p.c,p.k);}));
    P.querySelectorAll('[data-retirer]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.retirer);retirerMaitre(p.c,p.k);}));
    P.querySelectorAll('[data-adopter-t]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.adopterT);adopter(p.c,p.k);}));
    P.querySelectorAll('[data-classer-t]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.classerT);classer(p.c,p.k);}));
    P.querySelectorAll('[data-ouvrir]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.ouvrir);ouvrirCritere(p.c,deK(p.k)[0]);}));
  }
  // Ouvrir une compétence sur un critère : déplié et montré dans le référentiel.
  function ouvrirCritere(c,ec){
    page='';goToComp(c);
    if(!vues.ref){vues.ref=true;garder('vues',JSON.stringify(vues));}
    comp().indicateurs.forEach((ind,si)=>{if(ind.ecs.includes(ec))collapsedInds.delete(curComp+':'+si);});
    expandedEcs.add(ec);render();
    const card=R.querySelector(`#sheet-ref [data-eckey="${ec}"]`);if(card)card.scrollIntoView({block:'center'});
  }
  $('btn-traiter').addEventListener('click',()=>{page=page==='traiter'?'':'traiter';selectedEc=null;render();});

  // ---- Notifications : ce qui concerne la personne connectée ----
  function notifications(){
    if(!connecte())return [];
    const lu=lire('notifs_lu')||'',jeton='@['+moi()+']',l=[];
    COMP_ORDER.forEach(c=>{
      const st=etatComp(c);
      st.msgs.forEach(m=>{if(m.participant!==moi()&&!st.masques.has(m)&&(st.texteDe.get(m)||m.texte).includes(jeton))l.push({ts:!m.texte.includes(jeton)&&st.modifieLe.get(m)||m.ts,c,ic:'@',txt:U('nMention',{n:quiTexte(m),comp:c})});});
      st.evts.forEach(e=>{
        if(e.attente||e.masque||e.x.participant===moi())return;
        const v=st.mesVotes[e.k+'#'+moi()],eff=e.effet||e.type;
        if(e.version===''&&(eff==='maintenu'||eff==='retrait')&&v&&v.sens==='contre'&&e.x.ts>v.ts)l.push({ts:e.x.ts,c,k:e.k,ic:'⚖',txt:U(eff==='maintenu'?'nDecisionMaintenu':'nDecisionRetrait',{n:quiTexte(e.x),l:lienTxt(e.k),comp:c})});
        if(e.version===''&&eff==='remis'&&v&&v.sens!=='retrait'&&e.x.ts>v.ts)l.push({ts:e.x.ts,c,k:e.k,ic:'↺',txt:U('nRemis',{l:lienTxt(e.k),comp:c})});
        if(maVersion()&&e.version===maVersion()&&(e.type==='adopte'||e.type==='classe'))l.push({ts:e.x.ts,c,k:e.k,ic:'⇄',txt:U(e.type==='adopte'?'nAdopte':'nClasse',{n:quiTexte(e.x),l:lienTxt(e.k),comp:c})});
      });
    });
    l.sort((a,b)=>a.ts<b.ts?1:-1);
    l.forEach(n=>{n.nouv=n.ts>lu;});
    return l.slice(0,50);
  }
  function renderNotifs(){
    const N=$('notifs');N.hidden=!notifsOuvert;
    if(!notifsOuvert)return;
    const l=notifications();
    N.innerHTML=`<div class="notifs-tete"><span>${esc(U('notifications'))}</span><button type="button" class="val-lien" id="notifs-lu">${esc(U('toutLu'))}</button></div>`
      +(l.length?l.map((n,i)=>`<div class="notif${n.nouv?' nouv':''}" data-notif="${i}"><span class="notif-ic">${n.ic}</span><span>${esc(n.txt)}<small>${dateHeure(n.ts)}</small></span></div>`).join(''):`<p class="vide" style="padding:10px 12px">${esc(U('aucuneNotif'))}</p>`);
    $('notifs-lu').addEventListener('click',ev=>{ev.stopPropagation();garder('notifs_lu',new Date().toISOString());render();});
    N.querySelectorAll('[data-notif]').forEach(d=>d.addEventListener('click',ev=>{
      ev.stopPropagation();const n=l[+d.dataset.notif];notifsOuvert=false;page='';garder('notifs_lu',new Date().toISOString());
      goToComp(n.c);ouvrirFil('discussion');
    }));
  }
  $('btn-cloche').addEventListener('click',ev=>{
    ev.stopPropagation();
    if(notifsOuvert)garder('notifs_lu',new Date().toISOString());
    notifsOuvert=!notifsOuvert;render();
  });
  document.addEventListener('click',ev=>{if(notifsOuvert&&!ev.composedPath().includes($('cloche'))){notifsOuvert=false;garder('notifs_lu',new Date().toISOString());render();}});

  function buildNav(){
    $('nav-comps').innerHTML=COMP_ORDER.map(k=>{
      const t=T(COMPETENCES[k].subtitle);
      return `<button class="nav-btn" data-comp="${k}" title="${esc(t)}"><span class="nav-txt">${t}</span></button>`;
    }).join('');
    R.querySelectorAll('#nav-comps .nav-btn').forEach(b=>b.addEventListener('click',()=>{page='';goToComp(b.dataset.comp);}));
  }
  // Un rendu reconstruit les feuilles : la saisie en cours est déjà gardée dans l'état; on lui rend le focus et le curseur.
  function render(){
    const a=R.activeElement,ch=a&&a.dataset&&a.dataset.champ,deb=ch?a.selectionStart:0,fin=ch?a.selectionEnd:0;
    renderTout();
    if(ch){const n=R.querySelector(`[data-champ="${ch}"]`);if(n&&n!==a){n.focus();try{n.setSelectionRange(deb,fin);}catch(e){}}}
  }
  function renderTout(){
    majSync();majIdent();
    if(!pret&&enLigne)return;
    if(enLigne&&!connecte()){if(!porte)ouvrirPorte();return;}
    renderEncadre();
    if(!$('landing').hidden){renderAccueil();return;}
    buildNav();updateHeader();
    const traiter=page==='traiter'&&estAdmin();
    if(page==='traiter'&&!traiter)page='';
    $('content-row').hidden=traiter;$('fil').hidden=traiter;$('page-traiter').hidden=!traiter;
    R.querySelector('.vues').hidden=traiter;
    renderNotifs();
    if(traiter){renderTraiter();return;}
    if(selectedEc&&(!vues.prog||!peutEditer()))selectedEc=null;
    if(ajoutOuvert&&(!vues.prog||!maVersion()||!ecById(ajoutOuvert)))ajoutOuvert=null;
    $('pane-prog').hidden=!vues.prog;$('pane-ref').hidden=!vues.ref;
    if(vues.prog)renderProgramme($('sheet-prog'));else $('sheet-prog').innerHTML='';
    if(vues.ref)renderReferentiel($('sheet-ref'));else $('sheet-ref').innerHTML='';
    bindCrossHover();
    renderFil();
  }

  function goToComp(k){
    curComp=k;garder('comp',k);expandedEcs.clear();expandedEls.clear();collapsedInds.clear();selectedEc=null;brouillons={};voteContre=null;encadre=null;msgEdition=null;msgSuppr=null;ajoutOuvert=null;
    if(etroit())navOpen=false;   // sur petit écran, le menu se superpose au contenu
    vueActive='app';$('landing').hidden=true;$('app').hidden=false;
    render();R.querySelectorAll('.pane,.content-row').forEach(p=>p.scrollTop=0);
  }
  function goHome(){
    vueActive='landing';$('app').hidden=true;$('landing').hidden=false;page='';
    expandedEcs.clear();expandedEls.clear();collapsedInds.clear();selectedEc=null;filOnglet=null;brouillons={};voteContre=null;encadre=null;ajoutOuvert=null;
    render();
  }

  $('comp-grille').addEventListener('click',ev=>{const b=ev.target.closest('[data-comp]');if(b)goToComp(b.dataset.comp);});
  R.querySelectorAll('.vue-btn').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.vue,autre=k==='prog'?'ref':'prog';
    if(vues[k]&&!vues[autre])return;   // toujours au moins un document affiché
    vues[k]=!vues[k];garder('vues',JSON.stringify(vues));render();
  }));
  host.dataset.theme=lire('theme')==='dark'?'dark':'light';
  $('theme-btn').addEventListener('click',()=>{host.dataset.theme=host.dataset.theme==='dark'?'light':'dark';garder('theme',host.dataset.theme);});
  $('undo-btn').addEventListener('click',undo);
  $('lang-btn').addEventListener('click',()=>setLang(lang==='fr'?'en':'fr'));
  R.querySelectorAll('.lang-choice').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));
  // Clavier : Entrée/Espace sur les éléments cliquables, Échap ferme les bulles, les menus et la fenêtre.
  R.addEventListener('keydown',ev=>{
    if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('[data-tgl],[data-eltgl],[data-indtgl],.el-row-check')){ev.preventDefault();ev.target.click();}
    if(ev.key==='Escape'){
      if(!$('ident').hidden){if(!porte){$('ident').hidden=true;apresIdentite=null;}}
      else if(encadre)fermerEncadre();
      else if(voteContre){voteContre=null;render();}
      else if(notifsOuvert){notifsOuvert=false;garder('notifs_lu',new Date().toISOString());render();}
      else if(ajoutOuvert){ajoutOuvert=null;ajoutTexte='';ajoutEl='';render();}
    }
  });
  // Échap ferme l'encadré même si le focus est sorti de l'outil.
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&encadre&&!ev.composedPath().includes(host))fermerEncadre();});
  // Ctrl+Z seulement quand l'outil a le focus (ou la page autonome), jamais dans un champ.
  document.addEventListener('keydown',ev=>{
    if(!((ev.ctrlKey||ev.metaKey)&&!ev.shiftKey&&ev.key.toLowerCase()==='z')||$('app').hidden||!$('ident').hidden)return;
    const path=ev.composedPath(),t=path[0];
    if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable))return;
    if(!path.includes(host)&&document.activeElement!==document.body)return;
    if(!estAdmin())return;
    ev.preventDefault();undo();
  });
  $('nav-toggle').addEventListener('click',()=>{navOpen=!navOpen;$('left-nav').classList.toggle('collapsed',!navOpen);});
  R.querySelector('.main-area').addEventListener('click',()=>{if(navOpen&&etroit()){navOpen=false;$('left-nav').classList.add('collapsed');}});
  $('nav-home').addEventListener('click',goHome);
  $('crossref-cb').addEventListener('change',ev=>{crossRef=ev.target.checked;render();});

  applyUI();
  if(enLigne){afficherVerrou('verrouChargement');charger();}
  else{afficherContenu();render();charger();}
  if(enLigne){
    setInterval(()=>{if(pret&&!document.hidden&&!enAttente.length&&!msgAttente.length&&!voteAttente.length)charger(true);},60000);
    document.addEventListener('visibilitychange',()=>{if(pret&&!document.hidden)charger(true);});
  }
}

customElements.define('concordance-5319',class extends HTMLElement{connectedCallback(){if(!this.shadowRoot)monter(this);}});
})();
