/* Outil de concordance DEP 5319 / DVS 5819 — composant autonome.
   Intégration (page autonome ou bloc « HTML personnalisé » WordPress) :
     <concordance-5319></concordance-5319>
     <script src="donnees-5319.js"></script>
     <script src="concordance-5319.js"></script>
   L'outil vit dans un Shadow DOM : ses styles n'atteignent pas la page hôte et ceux du thème ne l'atteignent pas.
   Enregistrement : la feuille Google partagée (URL_FEUILLE, ou l'attribut feuille, p. ex. la page d'essai DEV). Une page
   qui donne l'attribut feuille garde ses données de navigateur à part (préfixe dep5319dev_).
   Référentiel verrouillé : la page publiée charge une copie chiffrée de donnees-5319.js ({chiffre: {iv, donnees}},
   faite par publier.mjs). La première lecture complète de la feuille, avec un bon code d'accès, donne la clé (cle), et
   l'outil la déverrouille avant tout affichage. La copie en clair, ouverte en local, s'affiche telle quelle.
   Modèle (voir PLAN-DE-TRAVAIL.md) :
   - Journal {ts, comp, ec, el, geste, nom, participant}, rejoué dans l'ordre sur les liens proposés (defaultLinks).
     Geste : proposé (un participant propose d'ajouter le lien; un seul par lien, qui vit tant qu'au moins une personne
     l'appuie d'un 👍), ajouté, adopté (ajouté ou adopté sur un lien qui a une proposition l'adoptent), non retenu,
     retiré, confirmé (retire seulement la mention « probable ») et maintenu (tranche seulement les votes contre);
   - Ctrl+Z d'un administrateur : la feuille efface la ligne de son geste ({annuler:[{ts, comp, ec, el}]});
   - votes {ts, comp, ec, el, sens: pour | contre | retrait} sur les liens de la concordance et les ajouts proposés : le
     dernier vote de chaque personne compte; un vote contre donné après la dernière décision met le lien en attente;
   - messages {ts, comp, cible, el, type, texte} : la discussion de la compétence; un message qui vise un lien porte son
     critère (cible) et son élément (el). Type : vide (message), contre (raison d'un vote contre), ecart (raison d'un
     ajout proposé), modif et supprime (son auteur modifie ou retire un message).
   « participant » et « centre » sont des numéros de lignes des onglets Participants et Centres : le nom et le centre
   affichés sont toujours ceux de la feuille. */
(function(){
'use strict';

// URL de l'application Web Google Apps Script (voir LISEZMOI.md).
const URL_FEUILLE='https://script.google.com/macros/s/AKfycbyGwb6rlwT_fTwrh4HwZ_pYlkH-2RKd9C5fYWQRcxr6L6KdHE4TKOKTHjtI2Jajj4vq/exec';
// Dossier du script : les fichiers publiés à côté de lui (aide-5319.json), même depuis une page WordPress.
const BASE=((document.currentScript&&document.currentScript.src)||'').replace(/[^/]*$/,'');
const POLICES='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';

const CSS=`
:host{all:initial;display:block;height:100vh;height:100dvh;
  --page-bg:#e6e4df;--bg:#ffffff;--surface:#ffffff;--surface-2:#f5f4f1;
  --border:#c9c6bf;--border-soft:#dedbd4;--fg:#1a1816;--fg-muted:#6b6760;--ink:#1a1816;--accent:#1f4e8c;--accent-bg:#e4edf8;--doc-ref:#2d4f7a;--doc-prog:#8a5a1e;--hl:#fff3bf;
  --fort:#1a6335;--fort-bg:#d6f0e2;
  --probable:#7a4a08;--probable-bg:#feecc8;
  --ajout:#6d28d9;--ajout-bg:#f3ecff;
  --nav-w:200px;color-scheme:light;}
:host([data-theme="dark"]){
  --page-bg:#161616;--bg:#1f1f1f;--surface:#1f1f1f;--surface-2:#282828;
  --border:#444444;--border-soft:#333333;--fg:#f0f0f0;--fg-muted:#9a9a9a;--ink:#f0f0f0;--accent:#7fb0ee;--accent-bg:#172a44;--doc-ref:#9bbbe6;--doc-prog:#e0b070;--hl:#3d3516;
  --fort:#6dd492;--fort-bg:#0d2819;
  --probable:#edb644;--probable-bg:#271c05;
  --ajout:#c4a5ff;--ajout-bg:#271a45;
  color-scheme:dark;}
:host([hidden]){display:none}
[hidden]{display:none!important}
*{box-sizing:border-box;margin:0;padding:0}
button,input,textarea{font-family:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.racine{position:relative;height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.5;font-weight:400;font-style:normal;letter-spacing:normal;word-spacing:normal;text-transform:none;text-align:left;text-indent:0;white-space:normal;background:var(--page-bg);color:var(--fg);padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);container-type:inline-size;}

/* Accueil : choix parmi les 19 compétences */
.landing{position:relative;background:var(--page-bg);flex:1;overflow-y:auto;padding:20px 16px 28px;}
/* Accueil : « Membres » en haut à gauche (dans la rangée des outils sur un écran étroit) */
.accueil-pages{position:absolute;top:20px;left:16px;display:flex;gap:8px;}
.membres-accueil{display:inline-flex;align-items:center;gap:6px;font-size:12px;border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:5px;padding:5px 12px;cursor:pointer;}
.membres-accueil svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
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

.app-shell{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
.app-header{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--fg);flex-shrink:0;flex-wrap:wrap;}
.app-header button,.header-actions label{color:var(--fg);background:transparent;border-radius:4px;border:1px solid var(--border);padding:5px 10px;cursor:pointer;font-size:12px;white-space:nowrap;transition:background .12s,border-color .12s;}
.app-header button:hover,.header-actions label:hover{background:var(--surface-2);border-color:var(--fg);}
#nav-toggle{font-size:16px;padding:5px 9px;}
.header-info{flex:1 1 280px;min-width:0;}
.header-doc{color:var(--fg);font-weight:700;font-size:17px;letter-spacing:-.01em;line-height:1.3;}
.header-sous{color:var(--fg-muted);font-size:11.5px;line-height:1.3;}
.header-outils{display:contents;}
.reglages{display:none;}
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
.nav-divider{height:1.5px;background:var(--border-soft);margin:6px 0;}
.nav-home{font-size:11px;color:var(--fg-muted);cursor:pointer;padding:5px 8px;transition:background .12s;background:none;border:none;text-align:left;border-radius:4px;}
.nav-home:hover{background:var(--surface-2);color:var(--fg);}
.nav-home.active{background:var(--accent);color:var(--bg);font-weight:600;}

.main-area{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;}
.content-row{flex:1 1 0;display:flex;min-height:0;overflow:hidden;background:var(--page-bg);}
/* Deux "feuilles" de même largeur, comme deux PDF côte à côte : programme à gauche, référentiel à droite. Chaque
   document ouvert porte une languette à sa couleur dans sa marge extérieure, qui le referme. Le document refermé devient
   une boîte étroite qui flotte sur sa marge, et sa languette avance vers le document ouvert. */
.pane{flex:1 1 0;min-width:0;overflow-y:auto;padding:20px 16px 40px;}
#pane-prog{padding-left:34px;padding-right:10px;}
#pane-ref{padding-left:10px;padding-right:34px;}
/* La languette suit le haut de la feuille pendant le défilement : une tenue de hauteur nulle, collée au haut du panneau. */
.tenue{position:sticky;top:0;z-index:3;height:0;max-width:820px;margin:0 auto;}
.lang-doc{position:absolute;top:16px;display:flex;align-items:center;justify-content:center;width:22px;height:52px;padding:0;border:none;color:var(--bg);font-size:15px;font-weight:700;line-height:1;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.25);}
.lang-doc.prog{background:var(--doc-prog);}
.lang-doc.ref{background:var(--doc-ref);}
.tenue .lang-doc.prog{right:100%;border-radius:8px 0 0 8px;}
.tenue .lang-doc.ref{left:100%;border-radius:0 8px 8px 0;}
.lang-doc:hover{filter:brightness(1.15);}
.poignee{position:relative;z-index:4;align-self:flex-start;flex:0 0 36px;display:flex;flex-direction:column;align-items:center;margin:20px 0 0 12px;padding:12px 0 16px;border:1px solid;border-top-width:4px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.18);font-size:12px;font-weight:700;cursor:pointer;}
.poignee.gauche{background:color-mix(in srgb,var(--doc-prog) 12%,var(--surface));border-color:color-mix(in srgb,var(--doc-prog) 40%,var(--surface));border-top-color:var(--doc-prog);color:var(--doc-prog);}
.poignee.droite{margin:20px 12px 0 0;background:color-mix(in srgb,var(--doc-ref) 12%,var(--surface));border-color:color-mix(in srgb,var(--doc-ref) 40%,var(--surface));border-top-color:var(--doc-ref);color:var(--doc-ref);}
.poignee>span:first-child{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;}
.poignee.droite>span:first-child{transform:none;}
.poignee .lang-doc{top:12px;}
.poignee.gauche .lang-doc{left:100%;border-radius:0 8px 8px 0;}
.poignee.droite .lang-doc{right:100%;border-radius:8px 0 0 8px;}
.sheet{background:var(--surface);border:1px solid var(--border);border-radius:2px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 18px rgba(0,0,0,.06);max-width:820px;margin:0 auto;padding:28px 32px 40px;min-height:100%;}
/* Mises en page selon la largeur de l'outil lui-même (pleine page ou colonne WordPress) */
@container (max-width:860px){.content-row{flex-direction:column;overflow-y:auto;}.content-row{padding-bottom:28px;}.pane,#pane-prog,#pane-ref{flex:none;overflow:visible;padding:12px 12px 20px;}.sheet{padding:18px 16px 28px;}.tenue,.poignee{display:none!important;}.sheet.plie{min-height:0;padding-bottom:6px;}.sheet.plie .sp-header{margin-bottom:0;}}
/* Les autres règles selon la largeur (tablettes, téléphones, colonne étroite) sont à la fin, après les règles de base. */

/* Discussion de la compétence, sous les documents */
.fil{position:relative;z-index:5;flex-shrink:0;display:flex;flex-direction:column;border-top:1px solid var(--border);background:var(--surface);}
/* Au milieu de la barre du bas, une languette pleine monte sur les documents : un clic déploie la discussion ou
   l'escamote. Déployée, la languette reste à son bord supérieur. */
.fil-barre{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:30px;padding:2px 10px;}
.poignee-fil{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;gap:6px;min-height:30px;padding:0 14px;border:none;border-radius:8px 8px 0 0;background:var(--fg);color:var(--bg);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;box-shadow:0 -2px 6px rgba(0,0,0,.18);}
.poignee-fil:hover{filter:brightness(1.3);}
.poignee-fil .chev{font-size:10px;transition:transform .18s;}
.poignee-fil.active .chev{transform:rotate(180deg);}
.compte{font-variant-numeric:tabular-nums;font-weight:500;opacity:.8;margin-left:2px;}
.comp-nav{display:inline-flex;align-items:center;gap:6px;background:transparent;border:none;padding:4px 6px;cursor:pointer;color:var(--fg-muted);font-size:12.5px;font-weight:500;white-space:nowrap;}
.comp-nav:hover{color:var(--fg);}
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
.ind-pts{font-size:11px;opacity:.6;margin-left:auto;font-family:'JetBrains Mono',monospace;white-space:nowrap;}
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

.ec-code{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;white-space:nowrap;margin-top:2px;letter-spacing:.02em;min-width:44px;flex-shrink:0;}
.ec-label{flex:1;font-size:13px;font-weight:500;}
.ec-pts{font-size:11px;font-weight:700;color:var(--fg-muted);white-space:nowrap;margin-top:2px;}
.ec-chevron{font-size:10px;color:var(--fg-muted);transition:transform .18s;margin-top:3px;flex-shrink:0;}
.ec-card.expanded .ec-chevron{transform:rotate(180deg);}

.el-chips-row{display:flex;flex-wrap:wrap;gap:4px;padding:0 12px 6px 64px;}
.el-chip,.ec-chip{display:inline-flex;align-items:center;font-size:11px;font-weight:600;font-family:'Inter',sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.01em;line-height:1.4;border-radius:3px;padding:2px 6px;border:1.5px solid transparent;cursor:pointer;background:none;}

.ec-body{border-top:1px solid var(--border-soft);padding:6px 12px 8px 64px;}
.ec-body .el-chips-row{margin-top:6px;padding:6px 0 0;border-top:1px solid var(--border-soft);}
.sub-list{list-style:none;padding:0;margin:0;}
.sub-list li{font-size:12px;color:var(--fg-muted);padding:1px 0;line-height:1.4;position:relative;}
.sub-list li::before{content:"–";position:absolute;left:-12px;}
.no-subs{font-size:12px;color:var(--fg-muted);font-style:italic;}

/* Crayon des administrateurs : la carte de lecture, plus une case à cocher */
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
.el-card.editable .el-row-check[aria-checked="true"]{background:var(--fort);border-color:var(--fort);color:#fff;}
.val-lien{background:none;border:none;color:var(--fg-muted);text-decoration:underline;cursor:pointer;font-size:11px;}
/* Programme EL cards. En lecture, les éléments liés à au moins un critère sont mis en relief; aucun n'est estompé.
   Mode « + » : le relief passe aux éléments disponibles pour un ajout, qui attendent un clic. (Apparence provisoire :
   le lot 2 la redessine.) */
.el-card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:4px;margin-bottom:6px;padding:0;}
.el-card.lie{border-color:var(--fg-muted);box-shadow:inset 3px 0 0 var(--doc-prog);}
.el-card.disponible{border:1.5px dashed var(--ajout);background:var(--ajout-bg);}
.el-card.disponible>.el-card-top{cursor:pointer;}
.el-card.disponible>.el-card-top:hover{background:color-mix(in srgb,var(--ajout) 14%,var(--surface));}
.el-card.choisi{border:2px solid var(--ajout);background:var(--ajout-bg);}
/* L'invitation se pose sur le contour du haut de la carte, sans la grandir. */
.invite-ajout{position:absolute;top:-8px;right:30px;padding:0 6px;border-radius:3px;background:var(--surface);color:var(--ajout);font-size:11px;font-weight:600;line-height:14px;white-space:nowrap;pointer-events:none;}
.pc-list{list-style:none;padding:0;margin:0;}
.pc-list li{font-size:12px;color:var(--fg-muted);padding:1px 0;line-height:1.4;position:relative;}
.pc-list li::before{content:"–";position:absolute;left:-12px;}
.ec-chips-row{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border-soft);}

/* En-tête de feuille avec fermeture de l'édition */
.sp-header{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--fg);color:var(--fg);}
.sp-titre{display:inline-flex;align-items:center;gap:6px;font:inherit;color:inherit;background:none;border:none;padding:0;text-align:left;}
/* Documents empilés : le titre occupe la rangée, et son chevron, dans un rond à la couleur du document, se tient au bout. */
button.sp-titre{flex:1;cursor:pointer;}
button.sp-titre .chev{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;margin-left:auto;flex-shrink:0;border:1.5px solid currentColor;border-radius:50%;background:color-mix(in srgb,currentColor 12%,transparent);font-size:12px;line-height:1;transition:transform .18s;}
.sp-titre[aria-expanded="false"] .chev{transform:rotate(-90deg);}
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

.tooltip{position:fixed;z-index:999;background:var(--fg);color:var(--bg);font-size:11.5px;padding:8px 12px;max-width:280px;pointer-events:none;line-height:1.5;}
.tooltip ul{list-style:none;padding:0;margin:0;}
.tooltip ul li{padding:1px 0 1px 12px;position:relative;}
.tooltip ul li::before{content:"–";position:absolute;left:0;opacity:.6;}
.tooltip .tt-title{font-weight:700;margin-bottom:4px;opacity:.7;font-size:10px;text-transform:uppercase;letter-spacing:.06em;}
.tooltip .tt-pts{margin-left:6px;white-space:nowrap;text-transform:none;letter-spacing:normal;}

.modal-fond{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:16px;}
.modal{background:var(--surface);color:var(--fg);border:1px solid var(--border);border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:20px 22px;width:min(430px,100%);display:flex;flex-direction:column;gap:12px;}
.modal h2{font-size:16px;font-weight:700;}
.modal p{font-size:12.5px;color:var(--fg-muted);}
/* Connexion : la bulle d'information d'une première connexion */
.modal .ident-info{gap:8px;align-items:flex-start;color:var(--fg);background:var(--accent-bg);border:1px solid var(--accent);border-radius:6px;padding:8px 10px;line-height:1.45;}
.modal .ident-info:not([hidden]){display:flex;}
.ident-info svg{flex:none;width:16px;height:16px;margin-top:1px;fill:none;stroke:var(--accent);stroke-width:1.8;stroke-linecap:round;}
.modal label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;}
.modal input,.modal select{font-size:14px;padding:7px 9px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--fg);}
/* Mot de passe d'administrateur : l'œil, au bout du champ, l'affiche ou le masque */
.mdp-champ{position:relative;display:flex;}
.mdp-champ input{flex:1;min-width:0;padding-right:40px;}
.oeil{position:absolute;right:1px;top:1px;bottom:1px;width:38px;display:flex;align-items:center;justify-content:center;border:none;border-radius:0 3px 3px 0;background:none;color:var(--fg-muted);cursor:pointer;padding:0;}
.oeil:hover{color:var(--fg);}
.oeil svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
.modal-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:4px;}
.modal-actions button{white-space:nowrap;font-size:13px;padding:6px 14px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--fg);cursor:pointer;}
.modal-actions button[type=submit]{background:var(--accent);border-color:var(--accent);color:var(--bg);font-weight:600;}
.modal-actions button[type=submit]:disabled{opacity:.6;cursor:wait;}
.modal-actions button.lien{margin-right:auto;border:none;padding:6px 0;color:var(--accent);text-decoration:underline;}
.modal .ident-erreur{color:var(--probable);font-weight:600;}
.modal .ident-erreur .soutien{display:block;margin-top:3px;font-weight:400;color:var(--fg-muted);}
.modal .ident-erreur .soutien a{color:var(--accent);}

/* ---- Votes, ajouts proposés, discussion, liste « À traiter », notifications ---- */
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
.verrou .mdp-champ input{flex:1;padding-right:40px;}
.verrou .oeil{border:none;background:none;color:var(--fg-muted);padding:0;}
.verrou .oeil:hover{color:var(--fg);}

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

/* Pastilles d'un lien : état et votes */
.lien-v{display:inline-flex;align-items:center;gap:1px;margin-right:6px;}
.el-chip.lien,.ec-chip.lien{background:var(--fort-bg);color:var(--fort);border-color:var(--fort);}
.el-chip.lien.probable,.ec-chip.lien.probable{background:var(--probable-bg);color:var(--probable);border-color:var(--probable);border-style:dashed;}
.el-chip .etiq,.ec-chip .etiq{font-family:'Inter',sans-serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-left:5px;}
.el-chip.classe,.ec-chip.classe{opacity:.7;}
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

.bulle{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 12px 8px 64px;padding:6px 8px;border:1px solid var(--contre);border-radius:4px;background:var(--surface);font-size:12px;}
.bulle input{flex:1 1 260px;min-width:160px;border:1px solid var(--border);border-radius:3px;padding:4px 6px;background:var(--bg);color:var(--fg);font-size:12px;}
.btn-p{font-size:11.5px;font-weight:600;border:1px solid var(--accent);background:var(--accent);color:var(--bg);border-radius:4px;padding:2px 10px;cursor:pointer;}
.btn-p:disabled{opacity:.5;cursor:not-allowed;}
.btn-p.danger{border-color:var(--contre);background:var(--contre);}
.btn-s{font-size:11.5px;border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:4px;padding:2px 10px;cursor:pointer;}

/* Crayon : la mention « probable », les votes et « Maintenir » sur la fiche d'un lien */
.puce-probable{align-self:center;display:inline-flex;align-items:center;gap:5px;font-family:'Inter',sans-serif;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;line-height:1.5;padding:0 6px;border-radius:3px;border:1px dashed var(--probable);background:var(--probable-bg);color:var(--probable);cursor:pointer;}
.puce-probable span{font-size:12px;line-height:1;font-weight:700;}
.puce-probable:hover{border-style:solid;}
.note-ecart{margin-top:6px;font-size:11.5px;color:var(--fg-muted);display:flex;flex-direction:column;gap:4px;cursor:default;}
/* Le + au bout d'une rangée de pastilles; la raison d'un ajout s'écrit sur la fiche de l'élément choisi */
.plus-ajout{border:1px dashed var(--border);background:none;color:var(--fg-muted);border-radius:3px;font-size:11.5px;font-weight:700;line-height:1.3;padding:0 6px;margin-left:2px;cursor:pointer;}
.plus-ajout:hover{border-color:var(--ajout);color:var(--ajout);background:var(--ajout-bg);}
.plus-ajout.on{border:1px solid var(--ajout);color:var(--bg);background:var(--ajout);}
.note-ecart label{display:flex;flex-direction:column;gap:2px;font-weight:600;color:var(--fg);}
.note-ecart input{font-weight:400;border:1px solid var(--border);border-radius:3px;padding:3px 6px;background:var(--bg);color:var(--fg);font-size:12px;}
.note-ecart .ligne{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.etiq-ecart{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border-radius:3px;padding:0 5px;align-self:flex-start;}
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
.encadre-def{font-size:12px;color:var(--fg-muted);display:flex;flex-direction:column;gap:3px;}
.encadre-def b{color:var(--fg);font-weight:600;}
.encadre-def .enc-pts{font-weight:700;white-space:nowrap;margin-left:4px;}
.encadre-def ul{list-style:none;margin:1px 0 2px 14px;padding:0;}
.encadre-def li{position:relative;line-height:1.4;}
.encadre-def li::before{content:"–";position:absolute;left:-12px;}
.encadre-etat{font-size:12px;display:flex;gap:4px 8px;flex-wrap:wrap;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-soft);margin-bottom:2px;}
.encadre-etat .att{color:var(--contre);font-weight:600;}
.encadre-etat .sep{color:var(--fg-muted);margin-right:8px;}
.encadre-etat .votants{flex-basis:100%;color:var(--fg-muted);}
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
/* Mode d'emploi : une colonne de lecture */
.aide{max-width:720px;font-size:13.5px;line-height:1.55;color:var(--fg);}
.aide h3{font-size:14px;margin:20px 0 6px;}
.aide p{margin:0 0 8px;}
.aide ul,.aide ol{margin:0 0 8px;padding-left:22px;}
.aide li{margin-bottom:4px;}
.aide a{color:var(--accent);}
.aide .nw{white-space:nowrap;}
.aide .capture{margin:10px 0 16px;}
.aide .capture img{display:block;max-width:100%;height:auto;min-height:40px;border:1px solid var(--border);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.08);background:var(--surface);}
.aide figcaption{font-size:12px;color:var(--fg-muted);margin-top:6px;}
.section-t{margin-bottom:20px;max-width:1150px;}
.section-t h3{font-size:13px;margin-bottom:4px;}
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
/* Membres : regroupés par centre; le titre d'un centre porte, pour les administrateurs, Renommer et Fusionner */
.groupe-m{margin-bottom:14px;}
.membres{list-style:none;margin:2px 0 0 12px;padding:0;display:flex;flex-wrap:wrap;gap:4px 18px;font-size:13px;}
.membres li{display:inline-flex;align-items:center;gap:6px;}
.ligne-c{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;background:var(--surface);border:1px solid var(--border-soft);border-radius:4px;padding:7px 12px;margin-bottom:6px;font-size:12.5px;}
.ligne-c .nom-c{font-weight:600;}
.ligne-c .detail{font-size:11.5px;color:var(--fg-muted);}
.ligne-c .actions{margin-left:auto;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.ligne-c input,.ligne-c select{font-size:12px;border:1px solid var(--border);border-radius:3px;padding:3px 6px;background:var(--bg);color:var(--fg);}
.ligne-c input{flex:1 1 220px;min-width:0;}
.ligne-c .ident-erreur{flex-basis:100%;color:var(--contre);font-weight:600;font-size:12px;}
/* Membres : 🗑 d'un compte (administrateurs), puis sa confirmation sous la liste du centre */
.membres .suppr-m{border:none;background:none;cursor:pointer;font-size:12px;padding:1px 4px;border-radius:3px;color:var(--fg-muted);}
.membres .suppr-m:hover{background:var(--surface-2);color:var(--fg);}
.ligne-c.confirmer-m{margin:8px 0 0 12px;border-color:var(--contre);}
/* Membres, administrateurs : centres, puis tableau des comptes (défile de côté sur un écran étroit) */
.titre-m{font-size:13px;font-weight:700;margin:16px 0 8px;}
.table-m{overflow-x:auto;background:var(--surface);border:1px solid var(--border-soft);border-radius:4px;}
.table-m table{border-collapse:collapse;width:100%;font-size:12.5px;}
.table-m th{text-align:left;font-size:11.5px;font-weight:600;color:var(--fg-muted);padding:8px 10px;border-bottom:1px solid var(--border-soft);white-space:nowrap;}
.table-m td{padding:6px 10px;border-bottom:1px solid var(--border-soft);vertical-align:middle;white-space:nowrap;}
.table-m tbody tr:last-child td{border-bottom:none;}
.table-m .nb{text-align:right;font-variant-numeric:tabular-nums;}
.table-m select{font-size:12px;border:1px solid var(--border);border-radius:3px;padding:3px 6px;background:var(--bg);color:var(--fg);max-width:190px;}
.table-m .actions-m{display:flex;gap:6px;align-items:center;justify-content:flex-end;}
.table-m .suppr-m{border:none;background:none;cursor:pointer;font-size:12px;padding:1px 4px;border-radius:3px;color:var(--fg-muted);}
.table-m .suppr-m:hover{background:var(--surface-2);color:var(--fg);}
.table-m .confirmer-r td{white-space:normal;padding:0 10px 10px;}
.table-m .confirmer-m{margin:0;}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
@container (max-width:860px){.ligne-t{grid-template-columns:1fr;}.ligne-t .actions{justify-content:flex-start;}.bulle{margin-left:12px;}.voile{padding:12px 8px;}.msg.rattache{margin-left:16px;}}

/* ---- Tablettes et téléphones ----
   Selon la largeur de l'outil (pleine page ou colonne WordPress) : @container. Selon l'appareil (écran tactile, sans
   survol) : @media (hover:none) and (pointer:coarse). Ces règles suivent les règles de base pour les remplacer. */
/* Une boîte plus haute que l'écran (code d'accès, connexion, compte) défile au lieu de passer sous le bandeau DEV. */
.verrou-fond,.modal-fond{overflow-y:auto;}
.verrou,.modal{margin:auto;}
/* Colonne étroite : l'encadré, presque sans marge, commence sous le bandeau DEV. */
@container (max-width:860px){.bandeau-dev:not([hidden])~.voile{top:18px;}}
@container (max-width:760px){.accueil-pages{position:static;}}
@container (max-width:900px){
  /* Le menu de gauche se superpose au contenu, avec un voile; il est fermé à l'ouverture d'une compétence. */
  .left-nav{position:absolute;top:0;bottom:0;left:0;z-index:60;box-shadow:4px 0 16px rgba(0,0,0,.18);width:min(300px,86cqw);}
  .left-nav{transition:width .22s,visibility 0s;}
  .left-nav.collapsed{box-shadow:none;border-right-width:0;visibility:hidden;transition:width .22s,visibility 0s .22s;}
  .left-nav:not(.collapsed)~.main-area::after{content:"";position:absolute;inset:0;z-index:55;background:rgba(0,0,0,.35);}
  .nav-btn{white-space:normal;line-height:1.3;}
  .nav-txt{overflow:visible;text-overflow:clip;}
  /* Les notifications s'ouvrent sous l'en-tête, contre son bord droit. */
  .app-header{position:relative;}
  .cloche{position:static;}
  .notifs{right:10px;top:100%;}
  .page-traiter{padding:14px 12px 24px;}
}
@container (max-width:760px){
  /* En-tête sur une rangée : ☰, le titre, la cloche et ⋮, un menu qui porte le bouton du compte, « À traiter », Liens,
     EN, Annuler et le thème. Le compteur d'« À traiter » se répète sur ⋮. --reglages-w : la largeur de ⋮. */
  .app-header{gap:6px 8px;padding:6px 8px;--reglages-w:32px;}
  .header-info{flex:1 1 0;min-width:0;}
  .app-header:has(.cloche:not([hidden])) .header-info{padding-right:72px;}
  .header-doc{font-size:15px;}
  .reglages{display:block;position:relative;align-self:flex-start;flex-shrink:0;}
  #btn-reglages{position:relative;width:var(--reglages-w);padding:5px 0;font-size:16px;font-weight:700;}
  #btn-reglages .compteur{position:absolute;top:-7px;right:-9px;margin:0;}
  .menu-reglages{position:absolute;right:0;top:calc(100% + 6px);z-index:600;display:grid;grid-template-columns:repeat(3,auto);gap:6px;width:max-content;min-width:180px;max-width:calc(100cqw - 16px);padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.2);}
  .menu-reglages .ident-btn,.menu-reglages #btn-traiter,.menu-reglages #links-wrap{grid-column:1/-1;min-width:0;overflow:hidden;text-overflow:ellipsis;text-align:left;}
  .menu-reglages #links-wrap{display:flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:4px;padding:5px 10px;font-size:12px;cursor:pointer;user-select:none;}
  .menu-reglages input[type=checkbox]{accent-color:var(--accent);width:16px;height:16px;}
  /* Tout est passé dans ⋮ : la cloche reste dans la rangée, l'état d'enregistrement s'efface (une erreur a sa bannière). */
  .header-outils,.header-actions{display:contents;}
  #sync{display:none;}
  .cloche{position:absolute;top:6px;right:calc(16px + var(--reglages-w));}
  /* Les notifications, sous la cloche, contre le bord droit de l'en-tête (au-delà de ⋮). */
  .notifs{right:calc(-8px - var(--reglages-w));top:calc(100% + 6px);width:min(420px,calc(100cqw - 16px));}
  /* Documents : marges réduites, retraits ramenés, libellé du critère sous son code */
  .pane{padding:8px 6px 16px;}
  .sheet{padding:14px 10px 24px;}
  .ec-head{flex-wrap:wrap;row-gap:2px;padding:7px 10px;}
  .ec-code{flex:1 1 auto;}
  .ec-label{order:10;flex:1 1 100%;}
  .el-chips-row{padding:0 10px 8px 12px;}
  .ec-body{padding:6px 10px 8px 26px;}
  .el-body,.el-body.indent{padding-left:26px;}
  .el-card.editable .el-body,.el-card.editable .el-body.indent{padding-left:40px;}
  .el-card-top{padding:7px 10px;}
  .el-label{flex-wrap:wrap;row-gap:4px;}
  .el-text{flex:1 1 170px;}
  .bulle{margin:6px 8px 8px 12px;}
  .bulle input{flex:1 1 100%;min-width:0;}
  /* Discussion : plus haute; la barre du bas se resserre */
  .fil-barre{padding:7px 6px 3px;gap:4px;}
  /* La languette de la discussion s'encastre à moitié dans la barre du bas : elle déborde moins sur les documents. */
  .fil-barre .poignee-fil{min-height:30px;transform:translate(-50%,50%);border-radius:8px;}
  .fil-corps{height:clamp(200px,50vh,440px);}
  .fil-titre{padding:6px 10px 0;}
  .fil-liste{padding:6px 10px;}
  .composer{padding:6px 10px 8px;}
  .msg.rattache{margin-left:10px;}
  /* Fenêtres et encadré sur toute la largeur */
  .voile{padding:8px 6px;}
  .encadre{width:100%;padding:12px;}
  .modal-fond{padding:10px;}
  .modal{padding:16px;}
  .verrou{padding:20px 18px;}
  .ligne-t{padding:8px 10px;}
}
/* Écran de moins de 360 px : les boutons de la rangée 2 se resserrent; ce qui ne tient pas encore passe à la ligne au
   lieu de sortir de l'écran. */
@container (width<360px){
  .header-outils{flex-wrap:wrap;gap:6px 4px;}
  .header-outils button:not(.icon-btn),.header-outils #links-wrap{padding-left:5px;padding-right:5px;}
}
/* Clavier ouvert dans la discussion, sur un écran bas : la bande des boutons et le titre de la discussion s'effacent le
   temps de la saisie, et la discussion se resserre sur la hauteur qui reste, la zone de saisie au-dessus du clavier. */
@media (max-height:560px){@container (max-width:760px){
  .racine:has(.fil textarea:focus) .header-outils,.racine:has(.fil textarea:focus) .header-sous,.racine:has(.fil textarea:focus) .fil-titre{display:none;}
  .racine:has(.fil textarea:focus) .fil{flex:0 1 auto;min-height:0;}
  .racine:has(.fil textarea:focus) .fil-corps{flex:0 1 auto;min-height:0;}
}}
@media (hover:none) and (pointer:coarse){
  /* Cibles d'environ 40 px pour le doigt, texte d'au moins 12 px, champs à 16 px (sans agrandissement sur iOS) */
  .bandeau-dev{font-size:12px;}
  .app-header button,.header-actions label{min-height:40px;padding:6px 12px;font-size:13px;}
  #nav-toggle,.icon-btn,.lang-btn{min-width:40px;}
  .app-header{--reglages-w:40px;}
  .lang-btn{font-size:12px!important;}
  .ind-header{padding-top:8px;padding-bottom:8px;}
  .header-actions input[type=checkbox]{width:20px;height:20px;}
  .header-sous{font-size:12px;}
  .compteur{font-size:12px;}
  .lang-choice,.ident-accueil,.membres-accueil{min-height:40px;font-size:13px;}
  .bascule .lang-choice{min-height:36px;padding:6px 16px;font-size:13px;}
  .carte-code,.carte-pied{font-size:12px;}
  .nav-label{font-size:12px;}
  .nav-btn{padding:10px;font-size:14px;}
  .nav-home{padding:10px;font-size:14px;}
  .poignee-fil{min-height:40px;font-size:13px;}
  .lang-doc{width:30px;height:56px;font-size:18px;}
  .invite-ajout{top:-9px;font-size:12px;line-height:16px;}
  .menu-reglages #links-wrap{min-height:40px;font-size:13px;}
  .menu-reglages input[type=checkbox]{width:20px;height:20px;}
  .poignee{flex-basis:40px;font-size:13px;}
  .sp-titre{min-height:40px;}
  .comp-nav{min-height:40px;padding:6px 10px;font-size:13.5px;}
  .ec-head{padding-top:9px;padding-bottom:9px;}
  .ec-code,.el-code,.ec-pts,.ind-pts,.ec-chevron{font-size:12px;}
  .ec-edit{width:40px;height:40px;margin:-9px 0;opacity:.85;font-size:16px;}
  .sub-list li,.pc-list li{font-size:13px;}
  .el-chips-row,.ec-chips-row{gap:6px;}
  .el-chip,.ec-chip{min-height:22px;padding:0 6px;font-size:12px;}
  .el-chip .etiq,.ec-chip .etiq{font-size:11px;}
  .pouce{min-width:38px;min-height:38px;justify-content:center;padding:4px 6px;font-size:15px;}
  .pouce .pouce-ic{opacity:.7;}
  .pouce small{font-size:12.5px;}
  .plus-ajout{min-width:38px;min-height:34px;font-size:15px;}
  .bulle input,.note-ecart input,.ligne-c input,.ligne-c select{font-size:16px;min-height:42px;padding:8px 10px;}
  .btn-p,.btn-s{min-height:40px;padding:6px 14px;font-size:13.5px;}
  .sp-editing-badge{font-size:13px;padding:0 0 0 10px;}
  .sp-close{min-width:40px;min-height:36px;font-size:18px;}
  .el-card.editable .el-card-top{padding-left:52px;}
  .el-card-top .el-row-check{left:10px;top:7px;width:30px;height:30px;font-size:16px;}
  .el-card-top .el-row-check::before{content:"";position:absolute;inset:-7px;}
  .el-card.editable .el-body,.el-card.editable .el-body.indent{padding-left:52px;}
  .puce-probable{min-height:32px;padding:2px 10px;font-size:12px;}
  .puce-probable span{font-size:18px;}
  .note-ecart{font-size:13px;}
  /* Sans survol : ✎ et 🗑 de ses propres messages restent visibles */
  .msg-actions{opacity:1;}
  .msg-actions button{min-width:40px;min-height:36px;font-size:16px;}
  .msg-actions .btn-p,.msg-actions .btn-s{min-height:40px;font-size:13px;padding:4px 12px;}
  .msg-tete,.msg-tete b{font-size:12px;}
  .msg-texte{font-size:14px;}
  .tag{font-size:12px;min-height:32px;padding:3px 8px;}
  .geste{font-size:12.5px;}
  .role{font-size:11px;}
  .fil-titre small{font-size:12px;}
  .composer textarea,.msg-edition textarea{font-size:16px;}
  .composer textarea::placeholder{font-size:13px;}
  .composer button{min-height:44px;font-size:13px;}
  .modal input,.modal select,.verrou input{font-size:16px;min-height:44px;}
  .modal-actions button,.verrou button{min-height:44px;}

  .notifs-tete .val-lien{min-height:36px;font-size:13px;}
  .notif{padding:10px 12px;}
  .notif small{font-size:12px;}
  #encadre-fermer{min-width:40px;min-height:40px;font-size:15px;}
  .encadre-def,.encadre-etat{font-size:13px;}
  .ligne-t .comp-t,.ligne-t .detail,.tag-t,.ligne-c,.ligne-c .detail{font-size:12.5px;}
  .raisons{font-size:13px;}
}
`;

const GABARIT=`<div class="racine">
<div class="bandeau-dev" id="bandeau-dev" hidden>DEV</div>
<div class="verrou-fond" id="verrou" hidden><form class="verrou" id="verrou-form">
  <div class="bascule" role="group" aria-label="Langue / Language"><button type="button" class="lang-choice" data-lang="fr" lang="fr">Français</button><button type="button" class="lang-choice" data-lang="en" lang="en">English</button></div>
  <h2 id="verrou-titre"></h2><p id="verrou-expl"></p>
  <label id="verrou-champ"><span id="verrou-l"></span><span class="mdp-champ"><input id="verrou-code" type="password" autocomplete="off" maxlength="60"><button type="button" class="oeil" id="verrou-code-oeil" aria-controls="verrou-code" aria-pressed="false"></button></span></label>
  <p class="ident-erreur" id="verrou-erreur" role="alert" hidden></p>
  <button type="submit" id="verrou-ok"></button>
</form></div>
<div class="banniere" id="banniere" hidden><span id="banniere-txt"></span><button type="button" id="banniere-btn"></button></div>

<div id="landing" class="landing">
  <div class="landing-inner">
    <div class="landing-outils"><div class="accueil-pages"><button type="button" class="membres-accueil" id="landing-membres"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18.5 14.3c1.8.8 3 2.9 3 5.7"/></svg><span id="landing-membres-l"></span></button><button type="button" class="membres-accueil" id="landing-aide"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.3-2.6 3.9"/><path d="M12 17.2h.01"/></svg><span id="landing-aide-l"></span></button></div><div class="lang-choices"><button class="lang-choice" data-lang="fr">Français</button><button class="lang-choice" data-lang="en">English</button></div><button class="ident-btn ident-accueil"></button></div>
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
    <span class="reglages" id="reglages"><button id="btn-reglages" aria-expanded="false" aria-controls="menu-reglages">⋮</button><div class="menu-reglages" id="menu-reglages" hidden></div></span>
    <div class="header-outils">

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
    </div>
  </header>
  <div class="body-row">
    <nav class="left-nav" id="left-nav">
      <button class="nav-home" id="nav-home"></button>
      <button class="nav-home" id="nav-membres"></button>
      <button class="nav-home" id="nav-aide"></button>
      <div class="nav-divider"></div>
      <div class="nav-label" id="nav-label-comp"></div>
      <div id="nav-comps"></div>
    </nav>
    <div class="main-area">
      <div class="content-row" id="content-row">
        <button type="button" class="poignee gauche" id="poignee-prog" hidden></button>
        <div class="pane" id="pane-prog"><div class="tenue"><button type="button" class="lang-doc prog" id="fermer-prog">‹</button></div><div class="sheet doc-prog" id="sheet-prog"></div></div>
        <div class="pane" id="pane-ref"><div class="tenue"><button type="button" class="lang-doc ref" id="fermer-ref">›</button></div><div class="sheet doc-ref" id="sheet-ref"></div></div>
        <button type="button" class="poignee droite" id="poignee-ref" hidden></button>
      </div>
      <div class="page-traiter" id="page-traiter" hidden></div>
      <div class="page-traiter" id="page-membres" hidden></div>
      <div class="page-traiter" id="page-aide" hidden></div>
      <div class="fil" id="fil">
        <div class="fil-barre">
          <button class="comp-nav" id="fil-prev"></button>
          <button type="button" class="poignee-fil" data-onglet="discussion" id="onglet-discussion" aria-controls="fil-corps"></button>
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

    <h2 id="ident-titre"></h2>
    <p id="ident-expl"></p>
    <p class="ident-info" id="ident-info" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><path d="M12 7.5h.01"/></svg><span id="ident-info-t"></span></p>
    <label id="ident-nom-wrap"><span id="ident-l-nom"></span><input id="ident-nom" autocomplete="name" maxlength="60" required></label>
    <label id="ident-courriel-wrap"><span id="ident-l-courriel"></span><input id="ident-courriel" type="email" autocomplete="email" maxlength="120"></label>
    <label id="ident-centre-wrap" hidden><span id="ident-l-centre"></span><select id="ident-centre"></select></label>
    <label id="ident-nouveau-wrap" hidden><span id="ident-l-nouveau"></span><input id="ident-nouveau" maxlength="80" autocomplete="organization"></label>
    <label id="ident-mdp-wrap" hidden><span id="ident-l-mdp"></span><span class="mdp-champ"><input id="ident-mdp" type="password" autocomplete="current-password" maxlength="100"><button type="button" class="oeil" id="ident-mdp-oeil" aria-controls="ident-mdp" aria-pressed="false"></button></span></label>
    <p class="ident-erreur" id="ident-erreur" role="alert" hidden></p>
    <div class="modal-actions"><button type="button" class="lien" id="ident-deconnexion" hidden></button><button type="button" id="ident-annuler"></button><button type="submit" id="ident-ok"></button></div>
  </form>
</div>
</div>`;

const UI={
 fr:{retirerProbable:"Retirer la mention « probable » : le lien est gardé",ouvrirComp:"Ouvrir cette compétence",soutien:"Pour du soutien :",proposer:"Proposer",plusTip:"Proposer un ajout",modifie:"modifié",supprimer:"Supprimer",supprimerMsg:"Supprimer mon message",modifierMsg:"Modifier mon message",title:'DEP 5319 — Charpenterie-menuiserie',tagline:"Outil de concordance — Référentiel d'évaluation 5319 & Programme d'études",ref:"Référentiel d'évaluation",prog:"Programme d'études",nav:'Navigation',links:'Liens',linksTip:"Afficher les liens vers l'autre document",undo:'Annuler (Ctrl+Z)',nothing:'Rien à annuler',theme:"Inverser l'affichage",comp:'Compétences',fermerProg:"Refermer le programme d'études",fermerRef:"Refermer le référentiel d'évaluation",home:'⌂ Accueil',yesno:'Oui / Non',pts:'pts',noSubs:'Aucun sous-critère.',tol:'Tolérance :',seuil:'Seuil de réussite :',el:'Él.',global:'Global',situ:'Compétence traduite en situation',lang:'EN',
  typeSitu:'Situation',typeComp:'Comportement',duree:'Durée :',heures:'{n} heures',hCourt:'{n} h',
  editMaitre:'Modifier les liens de ce critère',editClose:"Fermer l'édition",inviteAjout:"Cliquer ici pour proposer l'ajout",
  
  probableCourt:'probable',
  legAttente:"en attente d'une décision",
  tipProbable:"Mention « probable » : les administrateurs n'ont pas encore tranché ce lien.",
  pourTip:'Je suis pour',contreTip:'Je suis contre',personne:'personne',
  nPour:'pour',nContre:'contre',
  raisonContre:'Raison du vote contre',
  traceAjout:"Ajout proposé par {n}, le {d}{s} : {r}",
  
  
  raisonAjout:"Raison de l'ajout",
  retirerLien:'Retirer',annuler:'Annuler',enregistrer:'Enregistrer',
  maintenir:'Maintenir',
  adopterAjout:"Adopter",classer:"Ne pas retenir",classerTip:"La proposition reste visible, avec la mention « non retenue ».",
  discussion:'Discussion',discTitre:'Discussion de la compétence {c}',
  videDiscussion:'Aucun message pour l\'instant.',
  composerPh:'Écrire un message… (@ pour mentionner, Ctrl+Entrée pour envoyer)',envoyer:'Envoyer',critere:'Critère :',element:'Élément :',
  eContre:'{n} a voté contre ce lien.',cite:'« {t} »',eBloque:"Trop d'essais : réessayez dans 15 minutes.",
  eAjout:'{n} a ajouté le lien.',eRetrait:'{n} a retiré le lien.',eRemis:'{n} a remis le lien.',eMaintenu:'{n} a maintenu le lien.',eAdopte:"{n} a adopté la proposition de {c}.",eClasse:"{n} ne retient pas la proposition de {c}.",eEcartAjout:"{n} propose d'ajouter ce lien.",
  traiter:'À traiter',traiterTitre:'À traiter',reglages:'Réglages',
  traiterS1:'Liens contestés',
  traiterS2:"Ajouts proposés",
  traiterVide:'Rien à traiter pour le moment.',ajoutePar:"ajout proposé par {c}",fermer:'Fermer',encMaitre:'Votes :',encHors:'Lien retiré',encAjout:'Ajout proposé',encPar:'par {c}',encAttente:"en attente d'une décision des administrateurs",encVide:'Aucun geste ni commentaire sur ce lien.',classeCourt:"non retenue",
  membres:'Membres',aide:"Mode d'emploi",sansCentre:'Sans centre',nCompte:'{n} compte',nComptes:'{n} comptes',renommer:'Renommer',fusionnerAvec:'Fusionner avec…',fusionner:'Fusionner',confirmerFusion:'Fusionner « {a} » dans « {b} »?',supprimerMembre:'Supprimer ce compte et ses traces',confirmerSupprMembre:'Supprimer le compte de « {n} »{c}?',tracesSuppr:"Traces effacées aussi : {l}.",aucuneTrace:"Ce compte n'a laissé aucune trace.",definitif:'Ce geste est définitif.',n1Message:'1 message',nMessages:'{n} messages',n1Vote:'1 vote',nVotes:'{n} votes',n1Prop:"1 proposition d'ajout",nProps:"{n} propositions d'ajout",et:'et',eCompteAdmin:"Un compte d'administrateur ne se supprime pas ici.",centresTitre:'Centres',comptesTitre:'Comptes',colNom:'Nom',colCentre:'Centre',colInscription:'Inscription',colPour:'Votes pour',colContre:'Votes contre',colComm:'Commentaires',colAjouts:'Ajouts',colActions:'Actions',fusionnerDans:'Fusionner dans…',confirmerFusionCompte:'Fusionner le compte de « {a} » dans celui de « {b} »? Ses votes, ses messages et ses propositions passent à « {b} », puis son compte est supprimé.',promouvoir:'Promouvoir administrateur',promouvoirBtn:'Promouvoir',retirerRole:"Retirer le rôle d'administrateur",retirerRoleBtn:'Retirer le rôle',confirmerPromo:'« {n} » devient administrateur, avec le mot de passe commun des administrateurs. Transmettez-le-lui par courriel.',confirmerRetraitRole:"Retirer le rôle d'administrateur à « {n} »?",retirerCentre:'Retirer',retirerCentreTip:'Retirer ce centre vide de la liste',eCentreOccupe:'Ce centre a encore des comptes.',eRefuse:'Ce geste est refusé pour ce compte.',participantRetire:'participant retiré',eDoublon:'Un autre centre porte déjà ce nom.',
  notifications:'Notifications',toutLu:'Tout marquer comme lu',aucuneNotif:'Aucune notification.',
  nMention:'{n} a mentionné votre nom dans la discussion de {comp}.',nDecisionMaintenu:'{n} a maintenu le lien {l} ({comp}), contre lequel vous avez voté.',nDecisionRetrait:'{n} a retiré le lien {l} ({comp}), contre lequel vous avez voté.',
  nAdopte:"{n} a adopté votre proposition : {l} ({comp}).",nClasse:"{n} n'a pas retenu votre proposition : {l} ({comp}).",nRemis:'Le lien {l} ({comp}) est remis : votre vote compte de nouveau.',
  sIdentifier:'👤 Se connecter',deconnecter:'Se déconnecter',creerTitre:'Créer un compte',connecterTitre:'Se connecter',monCompte:'Mon compte',roleAdmin:'administrateur',identExpl:"Votre nom et votre centre sont visibles par les membres du groupe. Votre courriel n'est vu que par la personne responsable du projet : il sert à vous reconnaître quand vous revenez et à vous écrire au sujet du projet. Ces renseignements sont compilés dans une feuille Google à accès privé, et ils seront effacés à la fin du projet.",compteActif:'Compte actif :',identNom:'Votre nom',identCourriel:'Votre courriel',identCentre:'Pour quel centre?',choisirCentre:'— Choisir votre centre —',ajouterCentre:'Ajouter un centre…',nomCentre:'Nom du centre',identMdp:'Mot de passe administrateur',identInfo:"1re connexion? Indiquez simplement votre nom et courriel. Ils vous serviront d'identifiant la prochaine fois.",montrerMdp:'Afficher le mot de passe',cacherMdp:'Masquer le mot de passe',montrerCode:'Afficher le code',cacherCode:'Masquer le code',creer:'Créer mon compte',connecter:'Se connecter',
  eNom:'Ce courriel est déjà associé à un autre nom. Entrez le nom utilisé à la création du compte.',eCourriel:"Ce courriel n'est pas valide.",eCentre:'Choisissez votre centre.',eReseau:'Impossible de joindre la feuille Google. Réessayez dans un moment.',eMdpRequis:'Ce compte est un compte administrateur : entrez son mot de passe.',eMdp:'Mot de passe refusé.',
  verrouTitre:'DEP 5319 — Outil de concordance',verrouExpl:"Cet outil est réservé à la communauté de pratique. Entrez le code d'accès reçu avec votre invitation.",verrouCode:"Code d'accès",verrouOk:"Ouvrir l'outil",verrouRefuse:"Code d'accès refusé.",verrouReseau:'Impossible de joindre la feuille Google. Vérifiez votre connexion, puis réessayez.',verrouChargement:'Chargement…',reessayer:'Réessayer',
  sOk:'✓ À jour',sEnvoi:'Enregistrement…',sChargement:'Chargement…',sErreur:'⚠ Non enregistré',sTitreFeuille:"Les modifications sont enregistrées dans la feuille Google partagée de l'équipe.",
  bReseau:'Impossible de joindre la feuille Google : la dernière modification n’a peut-être pas été enregistrée.',bCompte:'Votre compte est introuvable dans la feuille : reconnectez-vous.',bAdmin:'Mot de passe administrateur refusé : reconnectez-vous.',bRecent:"Un geste plus récent d'un autre administrateur sur ce lien empêche l'annulation."},
 en:{retirerProbable:"Remove the \"probable\" mention: the link is kept",ouvrirComp:"Open this competency",soutien:"For support:",proposer:"Propose",plusTip:"Propose an addition",modifie:"edited",supprimer:"Delete",supprimerMsg:"Delete my message",modifierMsg:"Edit my message",title:'DVS 5819 — Carpentry',tagline:'Cross-reference tool — Specifications for Evaluation 5819 & Program of Study',ref:'Specifications for Evaluation',prog:'Program of Study',nav:'Navigation',links:'Links',linksTip:'Show links to the other document',undo:'Undo (Ctrl+Z)',nothing:'Nothing to undo',theme:'Invert display',comp:'Competencies',fermerProg:'Close the program of study',fermerRef:'Close the specifications for evaluation',home:'⌂ Home',yesno:'Yes / No',pts:'marks',noSubs:'No sub-criteria.',tol:'Tolerance:',seuil:'Passing threshold:',el:'El.',global:'Overall',situ:'Competency translated into a situation',lang:'FR',
  typeSitu:'Situation',typeComp:'Behaviour',duree:'Duration:',heures:'{n} hours',hCourt:'{n} h',
  editMaitre:'Edit the links of this criterion',editClose:'Close editing',inviteAjout:'Click here to propose the addition',
  
  probableCourt:'probable',
  legAttente:"awaiting a decision",
  tipProbable:'"Probable": the administrators have not yet ruled on this link.',
  pourTip:'I agree',contreTip:'I disagree',personne:'nobody',
  nPour:'for',nContre:'against',
  raisonContre:'Reason for voting against',
  traceAjout:"Addition proposed by {n}, {d}{s}: {r}",
  
  
  raisonAjout:"Reason for adding",
  retirerLien:'Remove',annuler:'Cancel',enregistrer:'Save',
  maintenir:'Keep',
  adopterAjout:"Adopt",classer:"Do not retain",classerTip:"The proposal stays visible, marked \"not retained\".",
  discussion:'Discussion',discTitre:'{c} discussion',
  videDiscussion:'No messages yet.',
  composerPh:'Write a message… (@ to mention, Ctrl+Enter to send)',envoyer:'Send',critere:'Criterion:',element:'Element:',
  cite:'"{t}"',eBloque:'Too many attempts: try again in 15 minutes.',eContre:'{n} voted against this link.',
  eAjout:'{n} added the link.',eRetrait:'{n} removed the link.',eRemis:'{n} put the link back.',eMaintenu:'{n} kept the link.',eAdopte:"{n} adopted {c}'s proposal.",eClasse:"{n} did not retain {c}'s proposal.",eEcartAjout:"{n} proposes adding this link.",
  traiter:'To review',traiterTitre:'To review',reglages:'Settings',
  traiterS1:'Contested links',
  traiterS2:"Proposed additions",
  traiterVide:'Nothing to review for now.',ajoutePar:"addition proposed by {c}",fermer:'Close',encMaitre:'Votes:',encHors:'Link removed',encAjout:'Proposed addition',encPar:'by {c}',encAttente:'awaiting a decision by the administrators',encVide:'No changes or comments on this link.',classeCourt:"not retained",
  membres:'Members',aide:'How to use',sansCentre:'No centre',nCompte:'{n} account',nComptes:'{n} accounts',renommer:'Rename',fusionnerAvec:'Merge with…',fusionner:'Merge',confirmerFusion:'Merge "{a}" into "{b}"?',supprimerMembre:'Delete this account and its traces',confirmerSupprMembre:'Delete the account of "{n}"{c}?',tracesSuppr:'Traces also deleted: {l}.',aucuneTrace:'This account left no traces.',definitif:'This cannot be undone.',n1Message:'1 message',nMessages:'{n} messages',n1Vote:'1 vote',nVotes:'{n} votes',n1Prop:'1 proposed addition',nProps:'{n} proposed additions',et:'and',eCompteAdmin:'An administrator account cannot be deleted here.',centresTitre:'Centres',comptesTitre:'Accounts',colNom:'Name',colCentre:'Centre',colInscription:'Joined',colPour:'Votes for',colContre:'Votes against',colComm:'Comments',colAjouts:'Additions',colActions:'Actions',fusionnerDans:'Merge into…',confirmerFusionCompte:'Merge the account of "{a}" into that of "{b}"? Its votes, messages and proposals move to "{b}", then the account is deleted.',promouvoir:'Make administrator',promouvoirBtn:'Promote',retirerRole:'Remove the administrator role',retirerRoleBtn:'Remove role',confirmerPromo:'"{n}" becomes an administrator, with the administrators\' shared password. Send it to them by email.',confirmerRetraitRole:'Remove the administrator role from "{n}"?',retirerCentre:'Remove',retirerCentreTip:'Remove this empty centre from the list',eCentreOccupe:'This centre still has accounts.',eRefuse:'This action is not allowed for this account.',participantRetire:'former participant',eDoublon:'Another centre already has this name.',
  notifications:'Notifications',toutLu:'Mark all as read',aucuneNotif:'No notifications.',
  nMention:'{n} mentioned you in the {comp} discussion.',nDecisionMaintenu:'{n} kept the link {l} ({comp}), which you voted against.',nDecisionRetrait:'{n} removed the link {l} ({comp}), which you voted against.',
  nAdopte:"{n} adopted your proposal: {l} ({comp}).",nClasse:"{n} did not retain your proposal: {l} ({comp}).",nRemis:'The link {l} ({comp}) is back: your vote counts again.',
  sIdentifier:'👤 Sign in',deconnecter:'Sign out',creerTitre:'Create an account',connecterTitre:'Sign in',monCompte:'My account',roleAdmin:'administrator',identExpl:'Your name and centre are visible to the members of the group. Your email is seen only by the project lead: it is used to recognize you when you come back and to write to you about the project. This information is kept in a private Google Sheet and will be deleted at the end of the project.',compteActif:'Active account:',identNom:'Your name',identCourriel:'Your email',identCentre:'Which centre?',choisirCentre:'— Choose your centre —',ajouterCentre:'Add a centre…',nomCentre:'Centre name',identMdp:'Administrator password',identInfo:'First time signing in? Just enter your name and email. They will be your sign-in details next time.',montrerMdp:'Show password',cacherMdp:'Hide password',montrerCode:'Show code',cacherCode:'Hide code',creer:'Create my account',connecter:'Sign in',
  eNom:'This email is already linked to another name. Enter the name used when the account was created.',eCourriel:'This email is not valid.',eCentre:'Choose your centre.',eReseau:'Unable to reach the Google Sheet. Try again in a moment.',eMdpRequis:'This is an administrator account: enter its password.',eMdp:'Password refused.',
  verrouTitre:'DVS 5819 — Cross-reference tool',verrouExpl:'This tool is reserved for the community of practice. Enter the access code you received with your invitation.',verrouCode:'Access code',verrouOk:'Open the tool',verrouRefuse:'Access code refused.',verrouReseau:'Unable to reach the Google Sheet. Check your connection, then try again.',verrouChargement:'Loading…',reessayer:'Retry',
  sOk:'✓ Up to date',sEnvoi:'Saving…',sChargement:'Loading…',sErreur:'⚠ Not saved',sTitreFeuille:"Changes are saved to the team's shared Google Sheet.",
  bReseau:'Unable to reach the Google Sheet: the last change may not have been saved.',bCompte:'Your account cannot be found in the sheet: sign in again.',bAdmin:'Administrator password refused: sign in again.',bRecent:"A more recent change by another administrator on this link prevents the undo."}
};

// « Mode d'emploi » des participants, en HTML. {courriel} : l'adresse de soutien. MODE-D-EMPLOI.md en est la version à
// remettre aux participants : les deux disent la même chose.
const AIDE={
 fr:`<p>L'outil met côte à côte le <b>programme d'études</b> (à gauche) et le <b>référentiel d'évaluation</b> (à droite), et relie chaque critère d'évaluation aux éléments de compétence qu'il évalue. Les administrateurs tiennent la <b>concordance</b>, l'ensemble de ces liens. Vous pouvez voter, en discuter et proposer des changements.</p>
<h3>L'écran</h3>
<ul>
<li>L'accueil présente les 19 compétences. Cliquez sur une carte pour ouvrir la compétence.</li>
<li>Le <b>programme d'études</b> est à gauche, le <b>référentiel d'évaluation</b> à droite. En bas de l'écran, <b class="nw">‹ C2</b> et <b class="nw">C4 ›</b> mènent à la compétence voisine.</li>
<li><b>☰</b> ouvre la liste des compétences, la page <b>Membres</b> et ce mode d'emploi.</li>
<li>La case <b>Liens</b>, en haut, affiche ou masque les pastilles qui relient un document à l'autre.</li>
</ul>
<figure class="capture"><img data-capture="ecran" alt=""><figcaption>Une compétence : le programme d'études à gauche, le référentiel d'évaluation à droite, la discussion en bas.</figcaption></figure>
<h3>Lire un lien</h3>
<p>Sous chaque critère d'évaluation, une pastille par élément relié (<span class="nw">Él.2, Él.3…</span>). Survolez-la pour lire l'élément. Dans le programme, les éléments reliés à au moins un critère sont mis en relief.</p>
<ul>
<li><b>Pastille pâle, en pointillés :</b> un ajout proposé par un participant. Survolez-la pour savoir qui l'a proposé et pourquoi.</li>
</ul>
<p>Cliquez sur une pastille pour ouvrir l'encadré du lien : tout ce qui le concerne, dans l'ordre. L'encadré donne aussi le critère avec sa pondération (« 10 pts », ou « Oui / Non ») et ses sous-critères, l'élément avec ses précisions, et le nom des personnes qui ont voté pour ou contre. Côté programme, une pastille de critère (<span class="nw">CE-03…</span>) ouvre l'encadré du même lien.</p>
<figure class="capture"><img data-capture="lien" alt=""><figcaption>L'encadré d'un lien : le critère, l'élément, les votes et la discussion du lien.</figcaption></figure>
<h3>Voter</h3>
<p>À côté de chaque pastille, celles de la concordance comme les ajouts proposés :</p>
<ul>
<li><b>👍</b> : vous êtes pour. Un second clic retire votre vote.</li>
<li><b>👎</b> : vous êtes contre. Écrivez une raison d'une ligne : elle s'affiche dans la discussion de la compétence. Retirer votre vote la retire aussi.</li>
</ul>
<p>Votre propre vote est le pouce coloré. Le chiffre du 👎 est <b>rouge</b> tant que les administrateurs n'ont pas tranché, gris ensuite. Survolez les pouces, ou ouvrez l'encadré du lien, pour voir qui a voté.</p>
<figure class="capture"><img data-capture="voter" alt=""><figcaption>Un critère, sa pastille d'élément et ses pouces : votre 👍 est coloré. Le + propose un ajout.</figcaption></figure>
<h3>Proposer un ajout</h3>
<ol>
<li>Cliquez sur le <b>+</b> au bout de la rangée de pastilles d'un critère : le programme passe en mode ajout, en violet, et chaque élément que vous pouvez proposer porte la mention « Cliquer ici pour proposer l'ajout ».</li>
<li>Cliquez sur l'élément à ajouter, écrivez la raison sur sa fiche, en une ligne, puis cliquez sur <b>Proposer</b>. Le chevron ▼ d'un élément affiche ses précisions sans le choisir.</li>
<li>L'ajout proposé apparaît pour tous en pastille pâle, avec votre 👍. Tout le monde peut voter dessus.</li>
</ol>
<p>Si un ajout est déjà proposé, appuyez-le d'un 👍 plutôt que de le proposer de nouveau. Pour retirer votre proposition, retirez votre 👍 : si personne d'autre ne l'appuie, elle disparaît. Pour qu'un lien existant soit retiré, votez contre.</p>
<p>Les administrateurs peuvent <b>adopter</b> un ajout proposé (la concordance change) ou <b>ne pas le retenir</b> : il reste alors visible, avec la mention « non retenue ».</p>
<figure class="capture"><img data-capture="ajout" alt=""><figcaption>Le mode ajout : chaque élément que vous pouvez proposer porte « Cliquer ici pour proposer l'ajout ».</figcaption></figure>
<h3>Discuter</h3>
<ul>
<li>La languette <b>💬 Discussion</b>, en bas de l'écran, déploie ou escamote la discussion de la compétence. Elle réunit tout ce qui s'y passe, dans l'ordre : les messages, et chaque geste en ligne discrète avec l'étiquette du lien (vote contre, proposition, décision des administrateurs). La raison qui accompagne un geste le suit.</li>
<li>Tapez <b>@</b> suivi d'un nom pour mentionner quelqu'un. La personne en sera avisée. Ctrl+Entrée envoie le message.</li>
<li>Au survol de vos propres messages, <b>✎</b> les modifie et <b>🗑</b> les supprime. Sur un téléphone ou une tablette, ces deux icônes restent affichées.</li>
</ul>
<figure class="capture"><img data-capture="discussion" alt=""><figcaption>La discussion de la compétence : les messages, et les gestes en lignes discrètes, avec l'étiquette du lien.</figcaption></figure>
<h3>Le programme et le référentiel</h3>
<ul>
<li>Chaque document ouvert porte une languette à sa couleur sur son bord extérieur : <b>‹</b>, à gauche du programme, le referme; <b>›</b>, à droite du référentiel, le referme aussi. L'autre document prend alors toute la largeur.</li>
<li>Le document refermé devient une languette étroite, sur le bord de l'écran, qui porte son nom : cliquez dessus pour le rouvrir.</li>
<li>Le <b>+</b> rouvre le programme au besoin.</li>
</ul>
<figure class="capture"><img data-capture="languettes" alt=""><figcaption>Le programme refermé : sa languette, sur le bord de l'écran, le rouvre.</figcaption></figure>
<h3>Sur un téléphone ou une tablette</h3>
<ul>
<li>Sur un écran étroit, le programme et le référentiel s'affichent l'un sous l'autre. Touchez le titre d'un document pour le replier, puis de nouveau pour le déplier.</li>
<li>Sur un téléphone, <b>⋮</b>, en haut à droite, donne votre nom (👤), <b>EN</b> et le bouton du thème.</li>
<li>Il n'y a pas de survol : touchez une pastille pour ouvrir l'encadré du lien.</li>
<li>Après un toucher sur <b>+</b>, l'écran descend jusqu'au programme, où vous choisissez l'élément.</li>
</ul>
<figure class="capture"><img data-capture="telephone" alt=""><figcaption>Sur un téléphone : les documents l'un sous l'autre, la discussion en bas.</figcaption></figure>
<h3>Membres</h3>
<p>La page <b>Membres</b> montre tous les membres, regroupés par centre. Elle s'ouvre par le bouton <b>Membres</b>, en haut à gauche de l'accueil, ou par <b>☰</b>.</p>
<h3>Notifications</h3>
<p>La cloche <b>🔔</b> compte ce qui vous concerne : une mention de votre nom, une décision sur un lien contre lequel vous avez voté, ce qui arrive à vos propositions.</p>
<h3>En cas de pépin</h3>
<ul>
<li>Si l'outil affiche « ⚠ Non enregistré », vérifiez votre connexion et cliquez sur <b>Réessayer</b>.</li>
<li>Pour toute question, écrivez dans la discussion ou à <a href="mailto:{courriel}">{courriel}</a>.</li>
</ul>`,
 en:`<p>The tool places the <b>Program of Study</b> (left) and the <b>Specifications for Evaluation</b> (right) side by side, and links each evaluation criterion to the competency elements it evaluates. The administrators maintain the <b>cross-reference</b>, the set of these links. You can vote on them, discuss them and propose changes.</p>
<h3>The screen</h3>
<ul>
<li>The home page shows the 19 competencies. Click a card to open the competency.</li>
<li>The <b>Program of Study</b> is on the left, the <b>Specifications for Evaluation</b> on the right. At the bottom of the screen, <b class="nw">‹ C2</b> and <b class="nw">C4 ›</b> lead to the neighbouring competency.</li>
<li><b>☰</b> opens the list of competencies, the <b>Members</b> page and this guide.</li>
<li>The <b>Links</b> box, at the top, shows or hides the badges that link one document to the other.</li>
</ul>
<figure class="capture"><img data-capture="ecran" alt=""><figcaption>A competency: the Program of Study on the left, the Specifications for Evaluation on the right, the discussion at the bottom.</figcaption></figure>
<h3>Reading a link</h3>
<p>Under each evaluation criterion, one badge per linked element (<span class="nw">El.2, El.3…</span>). Hover over it to read the element. In the program, elements linked to at least one criterion are highlighted.</p>
<ul>
<li><b>Pale, dotted badge:</b> an addition proposed by a participant. Hover over it to see who proposed it and why.</li>
</ul>
<p>Click a badge to open the link's panel: everything about it, in order. The panel also shows the criterion with its weighting ("10 marks", or "Yes / No") and its sub-criteria, the element with its details, and the names of the people who voted for or against. On the program side, a criterion badge (<span class="nw">EC-03…</span>) opens the panel of the same link.</p>
<figure class="capture"><img data-capture="lien" alt=""><figcaption>A link's panel: the criterion, the element, the votes and the link's discussion.</figcaption></figure>
<h3>Voting</h3>
<p>Next to each badge, for links in the cross-reference as well as proposed additions:</p>
<ul>
<li><b>👍</b>: you are for it. A second click removes your vote.</li>
<li><b>👎</b>: you are against it. Write a one-line reason: it appears in the competency's discussion. Removing your vote removes it too.</li>
</ul>
<p>Your own vote is the coloured thumb. The 👎 count is <b>red</b> until the administrators have decided, grey afterwards. Hover over the thumbs, or open the link's panel, to see who voted.</p>
<figure class="capture"><img data-capture="voter" alt=""><figcaption>A criterion, its element badge and its thumbs: your 👍 is coloured. The + proposes an addition.</figcaption></figure>
<h3>Proposing an addition</h3>
<ol>
<li>Click the <b>+</b> at the end of a criterion's row of badges: the program switches to addition mode, in purple, and each element you can propose is marked "Click here to propose the addition".</li>
<li>Click the element to add, write the reason on its card, in one line, then click <b>Propose</b>. An element's ▼ chevron shows its details without choosing it.</li>
<li>The proposed addition appears for everyone as a pale badge, with your 👍. Everyone can vote on it.</li>
</ol>
<p>If an addition has already been proposed, support it with a 👍 rather than proposing it again. To withdraw your proposal, remove your 👍: if nobody else supports it, it disappears. To have an existing link removed, vote against it.</p>
<p>The administrators can <b>adopt</b> a proposed addition (the cross-reference changes) or <b>not retain</b> it: it then stays visible, marked "not retained".</p>
<figure class="capture"><img data-capture="ajout" alt=""><figcaption>Addition mode: each element you can propose is marked "Click here to propose the addition".</figcaption></figure>
<h3>Discussing</h3>
<ul>
<li>The <b>💬 Discussion</b> tab, at the bottom of the screen, opens or closes the competency's discussion. It gathers everything that happens in it, in order: messages, and each action as a discreet line with the link's label (vote against, proposal, administrators' decision). The reason given with an action follows it.</li>
<li>Type <b>@</b> followed by a name to mention someone. They will be notified. Ctrl+Enter sends the message.</li>
<li>When you hover over your own messages, <b>✎</b> edits them and <b>🗑</b> deletes them. On a phone or tablet, these two icons stay visible.</li>
</ul>
<figure class="capture"><img data-capture="discussion" alt=""><figcaption>The competency's discussion: messages, and actions as discreet lines, with the link's label.</figcaption></figure>
<h3>The program and the specifications</h3>
<ul>
<li>Each open document has a tab in its colour on its outer edge: <b>‹</b>, left of the program, closes it; <b>›</b>, right of the specifications, closes them too. The other document then takes the full width.</li>
<li>The closed document becomes a narrow tab on the edge of the screen, bearing its name: click it to reopen it.</li>
<li>The <b>+</b> reopens the program when needed.</li>
</ul>
<figure class="capture"><img data-capture="languettes" alt=""><figcaption>The program closed: its tab, on the edge of the screen, reopens it.</figcaption></figure>
<h3>On a phone or tablet</h3>
<ul>
<li>On a narrow screen, the program and the specifications are shown one below the other. Tap a document's title to fold it, and again to unfold it.</li>
<li>On a phone, <b>⋮</b>, at the top right, gives your name (👤), <b>FR</b> and the display button.</li>
<li>There is no hovering: tap a badge to open the link's panel.</li>
<li>After tapping <b>+</b>, the screen scrolls down to the program, where you choose the element.</li>
</ul>
<figure class="capture"><img data-capture="telephone" alt=""><figcaption>On a phone: the documents one below the other, the discussion at the bottom.</figcaption></figure>
<h3>Members</h3>
<p>The <b>Members</b> page shows all members, grouped by centre. It opens from the <b>Members</b> button, at the top left of the home page, or from <b>☰</b>.</p>
<h3>Notifications</h3>
<p>The <b>🔔</b> bell counts what concerns you: a mention of your name, a decision on a link you voted against, what happens to your proposals.</p>
<h3>If something goes wrong</h3>
<ul>
<li>If the tool shows "⚠ Not saved", check your connection and click <b>Retry</b>.</li>
<li>For any question, write in the discussion or to <a href="mailto:{courriel}">{courriel}</a>.</li>
</ul>`
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
  // Référentiel verrouillé : vide jusqu'à deverrouiller(), qui le remplit en place.
  const verrouille=!!D.chiffre;
  const COMP_ORDER=verrouille?[]:D.ordre,COMPETENCES=verrouille?{}:D.competences;
  const urlFeuille=host.getAttribute('feuille')||URL_FEUILLE;
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
  // Tablette ou téléphone (même seuil que les règles @container) : le menu de gauche se superpose au contenu.
  const etroit=()=>(host.clientWidth||window.innerWidth)<=900;
  // Programme et référentiel empilés (colonne étroite) : un document peut être hors de l'écran.
  const empile=()=>getComputedStyle($('content-row')).flexDirection==='column';
  const montrer=(sel,bloc)=>{if(!empile())return;const n=R.querySelector(sel);if(n)n.scrollIntoView({block:bloc||'start',behavior:'smooth'});};
  let navOpen=!etroit(),crossRef=true;
  let vues={prog:true,ref:true};try{const v=JSON.parse(lire('vues'));if(v&&(v.prog||v.ref))vues={prog:!!v.prog,ref:!!v.ref};}catch(e){}
  let expandedEcs=new Set(),expandedEls=new Set(),collapsedInds=new Set(),selectedEc=null;
  let filOnglet=null,filJusteOuvert=false,encadre=null;   // encadre : le lien affiché par-dessus l'outil, {c, k}
  let page='';   // '' : la compétence; 'traiter' : la liste des administrateurs; 'membres' : les membres, par centre
  let journal=[],messages=[],votes=[],enAttente=[],msgAttente=[],voteAttente=[],annulAttente=[],undoStack=[],cache=null;
  // Compte : numéro de participant et courriel, gardés dans ce navigateur pour signer chaque envoi à la feuille.
  // Le mot de passe d'un administrateur y est aussi gardé après sa connexion.
  let nom=lire('nom')||'',code=lire('code')||'',centre=lire('centre')||'',participant=lire('participant')||'',courriel=lire('courriel')||'',role=lire('role')||'',mdp=lire('mdp')||'';
  let centres=[],participants=[];
  let pret=false;   // les données de la feuille ont été reçues au moins une fois
  let sync='';   // '', 'chargement', 'envoi', 'erreur-compte', 'erreur-admin', 'erreur-centre', 'erreur-reseau'
  let msgEdition=null,msgSuppr=null;   // mon message en cours de modification {ts, texte}, ou à supprimer (ts)
  let ajoutOuvert=null,ajoutTexte='',ajoutEl='';   // le critère dont la boîte « Proposer un ajout » est ouverte
  let voteContre=null; // lien dont on écrit la raison d'un vote contre
  let notifsOuvert=false,vueActive='landing';
  let reglagesOuvert=false,pileRendu=null;   // menu ⋮ ouvert (en-tête du téléphone); documents empilés au dernier rendu
  let voteContreTexte='';   // saisie en cours, gardée d'un rendu à l'autre
  let centreEdition=null,centreFusion=null,centreErreur=null;
  let membreAction=null,membreErreur=null;   // « Membres » : le geste à confirmer sur un compte {type: suppr | fusion | role, id, vers, admin}, et l'erreur reçue   // section « Centres » de « À traiter » : {id, nom}, {de, vers}, {id, cle}
  const connecte=()=>!!participant;
  const estAdmin=()=>role==='administrateur'&&!!mdp&&!!participant;
  const moi=()=>participant;
  // Proposer un ajout : un participant connecté. Les administrateurs modifient la concordance au crayon.
  const proposeur=()=>!!participant&&role!=='administrateur';

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
  // Pondération d'un critère, comme dans le référentiel : « 5 pts » (espace insécable), ou « Oui / Non » sans points.
  const ponderation=ec=>ec.pts!=null?ec.pts+' '+U('pts'):U('yesno');

  function applyUI(){
    host.lang=lang;
    $('landing-title').textContent=U('title');$('landing-membres-l').textContent=U('membres');$('landing-aide-l').textContent=U('aide');$('landing-tag').textContent=U('tagline');
    $('nav-toggle').title=U('nav');$('links-label').textContent=' '+U('links');$('links-wrap').title=U('linksTip');
    $('theme-btn').title=U('theme');$('nav-label-comp').textContent=U('comp');$('nav-home').textContent=U('home');$('nav-membres').textContent=U('membres');$('nav-aide').textContent=U('aide');
    [['fermer-prog','fermerProg'],['fermer-ref','fermerRef']].forEach(([id,k])=>{$(id).title=U(k);$(id).setAttribute('aria-label',U(k));});
    $('poignee-prog').innerHTML=`<span>🔨 ${esc(U('prog'))}</span><span class="lang-doc prog" aria-hidden="true">›</span>`;
    $('poignee-ref').innerHTML=`<span>📋 ${esc(U('ref'))}</span><span class="lang-doc ref" aria-hidden="true">‹</span>`;
    $('btn-reglages').title=U('reglages');$('btn-reglages').setAttribute('aria-label',U('reglages'));
    
    majIdent();
    $('ident-l-nom').textContent=U('identNom');$('ident-l-courriel').textContent=U('identCourriel');$('ident-l-centre').textContent=U('identCentre');$('ident-l-nouveau').textContent=U('nomCentre');$('ident-l-mdp').textContent=U('identMdp');majOeil();
    $('ident-annuler').textContent=U('annuler');
    $('composer-txt').placeholder=U('composerPh');$('composer-ok').textContent=U('envoyer');
    $('lang-btn').textContent=U('lang');$('lang-btn').title=lang==='fr'?'Switch to English':'Passer en français';
    R.querySelectorAll('.lang-choice').forEach(b=>{b.classList.toggle('active',b.dataset.lang===lang);b.setAttribute('aria-pressed',b.dataset.lang===lang);});
    $('verrou-titre').textContent=U('verrouTitre');$('verrou-expl').textContent=U('verrouExpl');$('verrou-l').textContent=U('verrouCode');$('verrou-ok').textContent=U('verrouOk');
    updateUndoBtn();
  }
  // L'œil d'un champ masqué (code d'accès, mot de passe d'administrateur) : œil ouvert pour afficher, œil barré pour masquer.
  const OEIL='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OEIL_BARRE='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.9 5.2A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';
  const CHAMPS_OEIL={'verrou-code':['montrerCode','cacherCode'],'ident-mdp':['montrerMdp','cacherMdp']};
  function majOeil(){
    Object.entries(CHAMPS_OEIL).forEach(([id,[montrer,cacher]])=>{
      const vu=$(id).type==='text',b=$(id+'-oeil'),t=U(vu?cacher:montrer);
      b.innerHTML=vu?OEIL_BARRE:OEIL;b.title=t;b.setAttribute('aria-label',t);b.setAttribute('aria-pressed',String(vu));
    });
  }
  function montrerChamp(id,vu){$(id).type=vu?'text':'password';majOeil();}
  function montrerMdp(vu){montrerChamp('ident-mdp',vu);}
  Object.keys(CHAMPS_OEIL).forEach(id=>$(id+'-oeil').addEventListener('click',()=>{const i=$(id),fin=i.value.length;montrerChamp(id,i.type==='password');i.focus();try{i.setSelectionRange(fin,fin);}catch(e){}}));
  function setLang(l){lang=l;garder('lang',l);applyUI();if(!$('ident').hidden)modeIdentite(modeIdent);if(COMP_ORDER.length)render();}

  // ---- Données partagées (feuille Google) ou locales (ce navigateur) ----
  // Numéro de version de la feuille : la lecture de routine (chaque minute, retour sur l'onglet) le donne, et la feuille
  // répond « inchange » s'il n'a pas changé. Une lecture complète au moins toutes les 10 minutes; jamais de numéro
  // envoyé à un script qui n'en donne pas (ancienne version du script).
  let versionFeuille=null,lectureComplete=0;
  const RELECTURE_MS=600000;
  function reponse(r){if(!r.ok)throw new Error('reseau');return r.json().then(x=>{if(!x||!x.ok)throw new Error(x&&x.erreur||'reseau');if(x.inchange)return {inchange:true,version:x.version};return {journal:x.journal||[],messages:x.messages||[],votes:x.votes||[],centres:x.centres||[],participants:x.participants||[],compte:x.compte,version:x.version,cle:x.cle};});}
  // Déverrouille le référentiel (AES-GCM) avec la clé donnée par la feuille, une fois par ouverture. Sans clé (script
  // d'une version antérieure) ou avec une clé qui ne va pas, l'outil reste sur l'écran du code, avec l'erreur réseau.
  const octets=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  let cleDonnees='';   // la clé reçue de la feuille, gardée pour les captures du mode d'emploi
  // Un fichier verrouillé {iv, donnees} (AES-GCM) : son JSON en clair.
  function dechiffrer(c){
    return crypto.subtle.importKey('raw',octets(cleDonnees),'AES-GCM',false,['decrypt'])
      .then(k=>crypto.subtle.decrypt({name:'AES-GCM',iv:octets(c.iv)},k,octets(c.donnees)))
      .then(b=>JSON.parse(new TextDecoder().decode(b)));
  }
  function deverrouiller(cle){
    if(!verrouille||COMP_ORDER.length)return Promise.resolve();
    if(!cle)return Promise.reject(new Error('reseau'));
    cleDonnees=cle;
    return dechiffrer(D.chiffre)
      .then(x=>{
        COMP_ORDER.push(...x.ordre);Object.assign(COMPETENCES,x.competences);
        curComp=COMPETENCES[lire('comp')]?lire('comp'):COMP_ORDER[0];
      },()=>{throw new Error('reseau');});
  }
  const poster=b=>fetch(urlFeuille,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({code,...b})}).then(reponse);
  const backend={
    charger:v=>fetch(urlFeuille+(urlFeuille.includes('?')?'&':'?')+'code='+encodeURIComponent(code)+(v!=null?'&version='+encodeURIComponent(v):'')+'&t='+Date.now()).then(reponse),
    ajouter:p=>poster({participant,courriel,motDePasse:mdp,...p}),
    compte:c=>poster({compte:c}),
    // Centres (administrateurs) : {renommer: {id, nom}} ou {fusionner: {de, vers}}.
    centres:op=>poster({participant,courriel,motDePasse:mdp,centres:op}),
    // Supprimer un compte et ses traces (administrateurs).
    supprimerCompte:id=>poster({participant,courriel,motDePasse:mdp,supprimerCompte:id}),
    // Centre d'un compte, fusion de deux comptes, rôle d'administrateur (administrateurs).
    comptes:op=>poster({participant,courriel,motDePasse:mdp,comptes:op})
  };
  // Une requête à la fois : une réponse plus ancienne ne peut pas écraser une plus récente.
  let file=Promise.resolve();
  const enFile=f=>(file=file.then(f));
  function erreur(e){
    const m=e.message;
    if(m==='compte'){participant='';role='';mdp='';['participant','role','mdp'].forEach(oublier);return 'erreur-compte';}
    if(m==='admin'||m==='bloque'){mdp='';oublier('mdp');return 'erreur-admin';}

    if(m==='recent')return 'erreur-recent';
    if(m==='code'){const motif=code?'verrouRefuse':'verrouCode';code='';oublier('code');afficherVerrou(motif);return '';}
    return 'erreur-reseau';
  }
  function appliquer(d){
    versionFeuille=d.version!=null?String(d.version):null;lectureComplete=Date.now();
    const avant=JSON.stringify([journal,messages,votes,centres,participants]);
    journal=d.journal;messages=d.messages;votes=d.votes||[];
    if(d.centres)centres=d.centres;
    if(d.participants)participants=d.participants;
    // Le centre, le nom et le rôle de la personne connectée suivent la feuille : une correction s'applique aussitôt.
    const moiF=participant&&participants.find(p=>p.id===participant);
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

  // silencieux : la lecture de routine, qui donne le numéro de version connu; rien n'est redessiné si rien n'a changé.
  function charger(silencieux){
    if(!silencieux&&pret){sync='chargement';render();}
    let syncAvant;
    return enFile(()=>Promise.resolve().then(()=>{
      syncAvant=sync;
      // Le relevé qui précède les 10 minutes relit tout : le suivant, une minute plus tard, arriverait après.
      const v=silencieux&&pret&&versionFeuille!=null&&Date.now()-lectureComplete+60000<=RELECTURE_MS?versionFeuille:null;
      return backend.charger(v);
    }).then(d=>d.inchange?d:deverrouiller(d.cle).then(()=>d)).then(d=>{
      if(d.inchange){if(d.version!=null)versionFeuille=String(d.version);if(sync!=='envoi')sync='';return sync!==syncAvant;}
      const change=appliquer(d);
      if(sync!=='envoi')sync='';
      if(!pret){pret=true;afficherContenu();return true;}
      return change||!silencieux||sync!==syncAvant;
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
    if(champ){$('verrou-code').value='';montrerChamp('verrou-code',false);setTimeout(()=>$('verrou-code').focus(),0);}
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
    if(!proposeur())return;
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
  // La concordance : les liens proposés à la génération, puis les gestes du Journal, dans l'ordre. Ajouts proposés
  // (props, par lien) : un seul par lien; une proposition vit tant qu'au moins une personne l'appuie d'un 👍 et que la
  // concordance ne contient pas le lien. Ajouté ou adopté sur un lien qui a une proposition l'adopte.
  // Confirmé retire seulement la mention « probable »; maintenu tranche seulement les votes contre. Les lignes que
  // Ctrl+Z fait effacer (annulAttente) ne comptent déjà plus.
  function etatComp(c){
    if(!cache)cache={};
    if(cache[c])return cache[c];
    const C=COMPETENCES[c],ecs=new Set(C.ec.map(e=>e.id)),els=new Set(C.els.map(e=>e.id));
    const maitre={},probable=new Set(),decision={},retireAvant=new Set(),props={},evts=[],annulees=[];
    Object.entries(C.defaultLinks||{}).forEach(([ec,m])=>Object.entries(m).forEach(([el,s])=>{const k=K(ec,el);maitre[k]=true;if(s!=='fort')probable.add(k);}));
    const valide=x=>x.comp===c&&ecs.has(x.ec)&&els.has(x.el);
    const lignes=journal.concat(enAttente).filter(x=>valide(x)&&!annulAttente.includes(cleGeste(x)));

    // Appui d'un lien juste avant t : le dernier vote de chaque personne avant t, dont au moins un 👍.
    const votesC=votes.concat(voteAttente).filter(x=>valide(x)&&!(participants.length&&!participants.some(p=>p.id===x.participant)));
    const appuye=(k,t,depuis)=>{const d={};votesC.forEach(x=>{if(x.ts<t&&x.ts>=depuis&&K(x.ec,x.el)===k)d[x.participant]=x.sens;});return Object.values(d).includes('pour');};
    // Une proposition qui disparaît faute d'appui quitte la discussion, avec sa raison et la décision de ne pas la retenir.
    const eteindre=(k,t)=>{const p=props[k];p.evt.masque=true;if(p.evtClasse)p.evtClasse.masque=true;annulees.push({k,de:p.x.ts,a:t});delete props[k];};
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
        // Une adoption garde la ligne de la proposition (prop) : son auteur en est notifié.
        const effet=apres?(remis?'remis':'ajout'):'retrait',p=apres&&props[k];
        evts.push({x,k,type:p?'adopte':effet,effet,prop:p?p.x:null,attente});
        if(p)delete props[k];
        return;
      }
      if(g==='non retenu'){const p=props[k];if(!p||p.etat!=='attente')return;const ev={x,k,type:'classe',prop:p.x,attente};props[k]=Object.assign({},p,{etat:'classe',classe:x,evtClasse:ev});evts.push(ev);return;}
      // Une proposition compte tant que la concordance ne contient pas le lien.
      if(g!=='proposé'||maitre[k])return;
      // Une proposition encore appuyée reste; la deuxième personne l'appuie de son 👍, et sa raison reste dans la discussion.
      if(props[k]){if(appuye(k,x.ts,props[k].x.ts))return;eteindre(k,x.ts);}
      const ev={x,k,type:'propose',attente};
      props[k]={x,etat:'attente',evt:ev};
      evts.push(ev);
    });
    // Votes : le dernier de chaque personne sur chaque lien; un compte supprimé ne compte plus.
    const parPersonne={};
    votes.concat(voteAttente).forEach(x=>{
      if(!valide(x))return;
      if(participants.length&&!participants.some(p=>p.id===x.participant))return;
      parPersonne[K(x.ec,x.el)+'#'+x.participant]=x;
    });
    const vt={};
    const debutProp={};Object.keys(props).forEach(k=>{debutProp[k]=props[k].x.ts;});
    Object.values(parPersonne).forEach(x=>{if(x.sens!=='pour'&&x.sens!=='contre')return;const k=K(x.ec,x.el);if(!maitre[k]&&debutProp[k]&&x.ts<debutProp[k])return;(vt[k]=vt[k]||{pour:[],contre:[]})[x.sens].push(x);});
    const attente=new Set();
    Object.entries(vt).forEach(([k,o])=>{if(maitre[k]&&o.contre.some(x=>!decision[k]||x.ts>decision[k]))attente.add(k);});
    Object.keys(props).forEach(k=>{if(!appuye(k,'~',props[k].x.ts))eteindre(k,'~');});
    const msgs=messages.concat(msgAttente).filter(m=>m.comp===c&&m.texte);
    // La raison d'un vote contre reste dans la discussion tant que ce vote compte : la personne qui le retire ou le
    // change la retire aussi, et une nouvelle raison remplace la précédente. La feuille, elle, garde tout.
    const masques=new Set(),derniere={};
    msgs.forEach(m=>{if(m.type!=='contre'||!m.el)return;const kp=K(m.cible,m.el)+'#'+m.participant;if(derniere[kp])masques.add(derniere[kp]);derniere[kp]=m;});
    Object.entries(derniere).forEach(([kp,m])=>{const v=parPersonne[kp];if(v&&v.sens!=='contre')masques.add(m);});
    msgs.forEach(m=>{if(m.type==='ecart'&&annulees.some(a=>a.k===K(m.cible,m.el)&&m.ts>=a.de&&m.ts<a.a))masques.add(m);});
    // Mes messages modifiés ou supprimés : la dernière modification de l'auteur remplace le texte; une suppression le
    // retire. Les lignes « modif » et « supprime » elles-mêmes ne s'affichent pas.
    const texteDe=new Map(),modifies=new Set(),modifieLe=new Map();
    msgs.forEach(m=>{
      if(m.type!=='modif'&&m.type!=='supprime')return;
      masques.add(m);
      const o=msgs.find(x=>x.type===''&&x.ts===m.ref&&x.participant===m.participant);if(!o)return;
      if(m.type==='supprime')masques.add(o);else{texteDe.set(o,m.texte);modifies.add(o);modifieLe.set(o,m.ts);}
    });
    return cache[c]={maitre,probable,decision,props,evts,votes:vt,attente,msgs,masques,texteDe,modifies,modifieLe,mesVotes:parPersonne};
  }
  const votesDe=(st,k)=>st.votes[k]||{pour:[],contre:[]};
  const monVote=(st,k)=>{const x=st.mesVotes[k+'#'+moi()];return x&&x.sens!=='retrait'?x.sens:'';};

  const msgsLien=(st,k)=>{const [ec,el]=deK(k);return st.msgs.filter(m=>m.cible===ec&&m.el===el);};

  function decompte(st,k){
    const vv=votesDe(st,k);
    return `${vv.pour.length} ${U('nPour')}, ${vv.contre.length} ${U('nContre')}`;
  }
  const noms=l=>l.length?l.map(x=>quiTexte(x)).join(', '):U('personne');
  // Nom de l'auteur d'un geste (la ligne d'une proposition, par exemple), tel que la feuille le donne aujourd'hui.
  const nomDe=x=>x?auteur(x).nom:'';

  // ---- Identification : un compte dans la feuille (nom, courriel, centre); un mot de passe pour les administrateurs ----
  // modeIdent : « connecter » (nom et courriel), « creer » (courriel inconnu : le centre est demandé) ou « profil ».
  let apresIdentite=null,modeIdent='connecter',besoinMdp=false;
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
  // La liste des centres se termine par « Ajouter un centre… », qui ouvre un champ pour le nom du centre.
  function remplirCentres(){
    const s=$('ident-centre'),choix=s.value;
    const tri=centres.slice().sort((a,b)=>a.nom.localeCompare(b.nom,lang,{sensitivity:'base'}));
    s.innerHTML=`<option value="">${esc(U('choisirCentre'))}</option>`+tri.map(c=>`<option value="${esc(c.id)}">${esc(c.nom)}</option>`).join('')+`<option value="+">${esc(U('ajouterCentre'))}</option>`;
    s.value=choix==='+'||tri.some(c=>c.id===choix)?choix:'';
    const visible=modeIdent==='creer',nouveau=visible&&s.value==='+';
    $('ident-centre-wrap').hidden=!visible;s.required=visible;
    $('ident-nouveau-wrap').hidden=!nouveau;$('ident-nouveau').required=nouveau;
  }
  // Trois modes : se connecter (nom et courriel), créer un compte (courriel inconnu : le centre est demandé sur le même
  // écran, avec l'avis sur l'usage du courriel), ou « profil » quand on est déjà connecté (le compte, Se déconnecter,
  // Fermer).
  function modeIdentite(m){
    modeIdent=m;
    const creer=m==='creer',profil=m==='profil',moiX={nom,centre,participant};
    $('ident-titre').textContent=U(profil?'monCompte':creer?'creerTitre':'connecterTitre');
    $('ident-expl').textContent=profil?quiTexte(moiX)+(role==='administrateur'?' · '+U('roleAdmin'):''):creer?U('identExpl'):participant?`${U('compteActif')} ${quiTexte(moiX)}.`:'';
    $('ident-expl').hidden=!$('ident-expl').textContent;
    // Personne de connecté, première étape : la bulle d'une première connexion.
    $('ident-info-t').textContent=U('identInfo');$('ident-info').hidden=m!=='connecter'||!!participant;
    $('ident-nom-wrap').hidden=profil;$('ident-nom').required=!profil;
    $('ident-courriel-wrap').hidden=profil;$('ident-courriel').required=!profil;
    $('ident-mdp-wrap').hidden=profil||!(besoinMdp||role==='administrateur');
    $('ident-deconnexion').hidden=!participant;$('ident-deconnexion').textContent=U('deconnecter');
    $('ident-ok').hidden=profil;$('ident-ok').textContent=U(creer?'creer':'connecter');
    $('ident-annuler').textContent=U(profil?'fermer':'annuler');$('ident-annuler').hidden=porte;$('ident-langue').hidden=!porte;
    $('ident-erreur').hidden=true;
    remplirCentres();
  }
  // forcer : se connecter de nouveau même si un compte est en mémoire (compte introuvable, mot de passe refusé).
  function ouvrirIdentite(suite,forcer){
    apresIdentite=suite||null;besoinMdp=false;
    $('ident-nom').value=nom;$('ident-courriel').value=courriel;$('ident-mdp').value='';montrerMdp(false);$('ident-centre').value='';
    const profil=participant&&!forcer&&!suite&&!(role==='administrateur'&&!mdp);
    $('ident-nouveau').value='';
    modeIdentite(profil?'profil':'connecter');
    $('ident-ok').disabled=false;
    $('ident').hidden=false;(profil?$('ident-annuler'):$('ident-nom')).focus();
  }
  function identiteFaite(){
    const suite=apresIdentite;
    if(porte){porte=false;$('ident').classList.remove('porte');R.querySelector('.racine').classList.remove('attente');}
    $('ident').hidden=true;apresIdentite=null;applyUI();render();
    if(suite)suite();
  }
  // Une seule requête : courriel connu, la personne est connectée; courriel inconnu, la feuille répond « nouveau » et
  // l'écran demande le centre; avec le centre (ou le nom d'un nouveau centre), le compte est créé.
  $('ident-form').addEventListener('submit',ev=>{
    ev.preventDefault();
    const n=$('ident-nom').value.trim();if(!n)return;
    const cou=$('ident-courriel').value.trim().toLowerCase(),sel=$('ident-centre').value,mp=$('ident-mdp').value;
    const creer=modeIdent==='creer',nouveau=creer&&sel==='+'?$('ident-nouveau').value.trim():'';
    if(creer&&(!sel||sel==='+'&&!nouveau)){(sel?$('ident-nouveau'):$('ident-centre')).focus();return;}
    $('ident-ok').disabled=true;$('ident-erreur').hidden=true;
    enFile(()=>backend.compte({nom:n,courriel:cou,centre:creer&&sel!=='+'?sel:'',nouveauCentre:nouveau,motDePasse:mp}).then(d=>{
      appliquer(d);
      if(d.compte.id!==participant)undoStack=[];
      ({nom,centre,id:participant}=d.compte);role=d.compte.role||'';courriel=cou;mdp=role==='administrateur'?mp:'';
      garder('nom',nom);garder('centre',centre);garder('participant',participant);garder('courriel',courriel);
      if(role){garder('role',role);garder('mdp',mdp);}else{oublier('role');oublier('mdp');}
      sync='';identiteFaite();
    },e=>{
      if(e.message==='nouveau'){modeIdentite('creer');$('ident-centre').focus();return;}
      if(e.message==='motdepasse-requis'||e.message==='motdepasse'){besoinMdp=true;$('ident-mdp-wrap').hidden=false;$('ident-mdp').focus();}
      if(e.message==='code'){afficherVerrou('verrouRefuse');$('ident').hidden=true;return;}
      const cle={nom:'eNom',courriel:'eCourriel',centre:'eCentre','motdepasse-requis':'eMdpRequis',motdepasse:'eMdp',bloque:'eBloque'}[e.message]||'eReseau';
      $('ident-erreur').innerHTML=esc(U(cle))+(cle==='eMdpRequis'?'':`<span class="soutien">${esc(U('soutien'))} <a href="mailto:${COURRIEL_SOUTIEN}">${COURRIEL_SOUTIEN}</a></span>`);
      $('ident-erreur').hidden=false;
    }).then(()=>{$('ident-ok').disabled=false;}));
  });
  // Corriger son courriel ramène l'écran à sa première étape; « Ajouter un centre… » ouvre le champ du nom du centre.
  $('ident-courriel').addEventListener('input',()=>{if(modeIdent==='creer')modeIdentite('connecter');});
  $('ident-centre').addEventListener('change',()=>{remplirCentres();if($('ident-centre').value==='+')$('ident-nouveau').focus();});
  // Se déconnecter : le compte est oublié par ce navigateur (le code d'accès, lui, reste).
  $('ident-deconnexion').addEventListener('click',()=>{
    nom='';centre='';participant='';courriel='';role='';mdp='';
    ['nom','centre','participant','courriel','role','mdp','notifs_lu'].forEach(oublier);
    undoStack=[];voteContre=null;voteContreTexte='';centreEdition=null;centreFusion=null;centreErreur=null;selectedEc=null;notifsOuvert=false;page='';msgEdition=null;msgSuppr=null;ajoutOuvert=null;ajoutTexte='';ajoutEl='';
    $('ident').hidden=true;apresIdentite=null;cache=null;applyUI();render();   // render ouvre la page de connexion
  });
  $('ident-annuler').addEventListener('click',()=>{if(porte)return;$('ident').hidden=true;apresIdentite=null;});
  R.querySelectorAll('.ident-btn').forEach(b=>b.addEventListener('click',()=>ouvrirIdentite()));
  $('banniere-btn').addEventListener('click',()=>{if(sync==='erreur-reseau')charger();else ouvrirIdentite(null,true);});
  function majSync(){
    const s=$('sync');
    s.textContent=sync==='envoi'?U('sEnvoi'):sync==='chargement'?U('sChargement'):sync.startsWith('erreur')?U('sErreur'):U('sOk');
    s.title=U('sTitreFeuille');s.hidden=!sync;
    s.classList.toggle('erreur',sync.startsWith('erreur'));
    const msg={'erreur-compte':'bCompte','erreur-admin':'bAdmin','erreur-recent':'bRecent','erreur-reseau':'bReseau'}[sync]||'';
    $('banniere').hidden=!msg;
    if(msg){$('banniere-txt').textContent=U(msg);$('banniere-btn').textContent=U(sync==='erreur-reseau'?'reessayer':'sIdentifier');$('banniere-btn').hidden=sync==='erreur-recent';}
  }

  // ---- Infobulle : texte d'un élément ou d'un critère, avec les remarques sur le lien ----
  const ttEl=$('tooltip');
  function showTT(ev,item,notes){
    if(!item)return;
    const pcs=item.pcs||item.subs&&item.subs.map(s=>({t:s}))||[];
    // pond : la pondération d'un critère, à la suite de son nom.
    ttEl.innerHTML=`<div class="tt-title">${T(item.label)}${item.pond?`<span class="tt-pts">${esc(item.pond)}</span>`:''}</div>${pcs.length?`<ul>${pcs.map(p=>`<li>${T(p.t!==undefined?p.t:p)}</li>`).join('')}</ul>`:''}${(notes||[]).map(n=>`<div style="margin-top:6px">${esc(n)}</div>`).join('')}`;
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

  // ---- En-tête : titre, liste « À traiter », cloche ----
  function updateHeader(){
    $('header-doc').textContent=page==='traiter'?U('traiterTitre'):page==='membres'?U('membres'):page==='aide'?U('aide'):T(comp().subtitle);
    $('header-sous').hidden=!!page||comp().type!=='situation';$('header-sous').textContent=U('situ');
    R.querySelectorAll('.nav-btn[data-comp]').forEach(b=>b.classList.toggle('active',!page&&b.dataset.comp===curComp));
    $('nav-membres').classList.toggle('active',page==='membres');$('nav-aide').classList.toggle('active',page==='aide');
    // Administrateurs : le nom d'une compétence qui garde des liens « probable » est en italique.
    R.querySelectorAll('.nav-btn[data-comp]').forEach(b=>{const st=estAdmin()&&etatComp(b.dataset.comp);b.classList.toggle('probable',!!st&&[...st.probable].some(k=>st.maitre[k]));});

    $('crossref-cb').checked=crossRef;
    $('left-nav').classList.toggle('collapsed',!navOpen);
    const nT=estAdmin()?aTraiter().length:0;
    $('btn-traiter').hidden=!estAdmin();
    $('btn-traiter').innerHTML=`${esc(U('traiter'))}${nT?`<span class="compteur">${nT}</span>`:''}`;
    $('btn-reglages').innerHTML=`⋮${estAdmin()&&nT?`<span class="compteur">${nT}</span>`:''}`;
    $('btn-traiter').classList.toggle('on',page==='traiter');
    const nN=connecte()?notifications().filter(n=>n.nouv).length:0;
    $('cloche').hidden=!connecte();
    $('btn-cloche').innerHTML=`🔔${nN?`<span class="compteur">${nN}</span>`:''}`;
    $('btn-cloche').title=U('notifications');
    updateUndoBtn();
  }

  // ---- Référentiel : pastilles de la concordance et ajouts proposés, chacun avec ses votes ----
  // Titre d'un document. Documents empilés (téléphone) : un accordéon qui replie le document sur son titre.
  function titreDoc(d){
    const t=`${d==='prog'?'🔨':'📋'} ${esc(U(d))}`;
    return empile()?`<button type="button" class="sp-titre" data-plier="${d}" aria-expanded="${!!vues[d]}">${t}<span class="chev" aria-hidden="true">▼</span></button>`:`<span class="sp-titre">${t}</span>`;
  }
  function traceTxt(st,k,p){const m=msgsLien(st,k).filter(x=>x.type==='ecart'&&x.participant===p.x.participant),r=m.length?m[m.length-1].texte:'';return U('traceAjout',{n:quiTexte(p.x),d:dateCourte(p.x.ts),s:p.etat==='classe'?' ('+U('classeCourt')+')':'',r:decoderMentions(r)});}
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
  function chipPropose(st,k,p){
    const [,el]=deK(k),nr=p.etat==='classe';
    return `<span class="lien-v"><button type="button" class="el-chip fantome${nr?' classe':''}" data-elid="${el}" data-k="${k}" data-trace="${esc(traceTxt(st,k,p))}"><span class="barre-code">${shortBadge(el)}</span>${nr?`<span class="etiq">${U('classeCourt')}</span>`:''}</button>${pouces(st,k)}</span>`;
  }
  // partie : 'row' (les pastilles), 'bulle' (la raison d'un vote contre ou la boîte d'un ajout en cours), ou les deux.
  function chipsRef(st,ecId,partie){
    const C=comp(),liste=[];
    C.els.forEach(e=>{
      const k=K(ecId,e.id);
      if(st.maitre[k]){liste.push(chipMaitre(st,k));return;}
      const p=st.props[k];if(p)liste.push(chipPropose(st,k,p));
    });
    // Le + : proposer un ajout, pour un participant connecté (les administrateurs éditent au crayon).
    const libres=C.els.filter(e=>!st.maitre[K(ecId,e.id)]&&!st.props[K(ecId,e.id)]);
    if(proposeur()&&libres.length)liste.push(`<button type="button" class="plus-ajout${ajoutOuvert===ecId?' on':''}" data-plus="${ecId}" title="${esc(U('plusTip'))}" aria-label="${esc(U('plusTip'))}" aria-expanded="${ajoutOuvert===ecId}">+</button>`);
    let h=partie!=='bulle'&&liste.length?`<div class="el-chips-row">${liste.join('')}</div>`:'';
    if(partie!=='row'&&voteContre&&deK(voteContre)[0]===ecId)h+=`<form class="bulle" data-bulle="${voteContre}"><input id="raison-contre" data-champ="contre" value="${esc(voteContreTexte)}" maxlength="300" aria-label="${esc(U('raisonContre'))}" placeholder="${esc(U('raisonContre'))}"><button type="submit" class="btn-p danger">${U('envoyer')}</button><button type="button" class="btn-s" data-annuler-vote>${U('annuler')}</button></form>`;
    return h;
  }
  function renderReferentiel(el){
    const st=etatComp(curComp),edit=role==='administrateur',plie=empile()&&!vues.ref;
    el.classList.toggle('plie',plie);
    let h=`<div class="sp-header">${titreDoc('ref')}</div>`;
    if(plie){el.innerHTML=h;return;}
    if(T(comp().seuil))h+=`<p class="seuil">${U('seuil')} ${T(comp().seuil)}</p>`;
    comp().indicateurs.forEach((ind,si)=>{
      const pts=ind.ecs.reduce((a,id)=>{const e=ecById(id);return a+(e?e.pts:0);},0);
      const indKey=curComp+':'+si,indOpen=!collapsedInds.has(indKey);
      h+=`<div class="ind-section${indOpen?'':' collapsed'}"><div class="ind-header" data-indtgl="${indKey}" role="button" tabindex="0" aria-expanded="${indOpen}"><span class="ind-label">${T(ind.label)}</span><span class="ind-pts">${pts?pts+' '+U('pts'):''}</span><span class="ec-chevron ind-chevron">▼</span></div>`;
      if(indOpen)ind.ecs.forEach(ecId=>{
        const ec=ecById(ecId);if(!ec)return;
        const open=expandedEcs.has(ecId),sel=selectedEc===ecId||ajoutOuvert===ecId;
        h+=`<div class="ec-card${open?' expanded':''}${sel?' selected':''}" data-eckey="${ecId}">`;
        h+=`<div class="ec-head" data-tgl="${ecId}" role="button" tabindex="0" aria-expanded="${open}">`;
        h+=`<span class="ec-code">${ecCourt(ecId)}</span><span class="ec-label">${T(ec.label)}</span>`;
        h+=`<span class="ec-pts">${ponderation(ec)}</span>`;
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
      if(selectedEc===id){selectedEc=null;render();montrer(`#sheet-ref [data-eckey="${id}"]`,'center');return;}
      // Documents empilés : le programme, qui passe en mode édition, est amené à l'écran.
      const ouvrir=()=>{if(!estAdmin())return;selectionner(id);render();montrer('#sheet-prog .sp-header');};
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
        // Documents empilés : le programme en mode ajout est amené à l'écran; refermer ramène au critère.
        if(ajoutOuvert)montrer('#sheet-prog .sp-header');else montrer(`#sheet-ref [data-eckey="${id}"]`,'center');
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
    // Pour un élément : les critères liés dans la concordance, puis les ajouts proposés (pâles).
    const r=[];
    comp().ec.forEach(ec=>{
      const k=K(ec.id,elId);
      if(st.maitre[k])r.push({ec:ec.id,cls:'lien'+(estAdmin()&&st.probable.has(k)?' probable':'')});
      else{const p=st.props[k];if(p)r.push({ec:ec.id,cls:'fantome'+(p.etat==='classe'?' classe':'')});}
    });
    return r;
  }
  function elCardHtml(st,e,opt={}){
    const open=expandedEls.has(e.id);
    const links=opt.chips?liensProgramme(st,e.id):[];
    const hasChips=links.length>0;
    const chips=()=>`<div class="ec-chips-row">${links.map(l=>`<button type="button" class="ec-chip ${l.cls}" data-ecid="${l.ec}"><span class="barre-code">${ecCourt(l.ec)}</span></button>`).join('')}</div>`;
    let cls='el-card'+(open?' expanded':'')+(opt.lie?' lie':'')+(opt.editable?' editable':'')+(opt.disponible?' disponible':'')+(opt.choisi?' choisi':'');
    let h=`<div class="${cls}" data-elkey="${e.id}"${opt.ecId?` data-elrow="${opt.ecId}" data-elid="${e.id}"`:''}>`;
    if(opt.disponible)h+=`<span class="invite-ajout" aria-hidden="true">${esc(U('inviteAjout'))}</span>`;
    h+=`<div class="el-card-top" data-eltgl="${e.id}" role="button" tabindex="0" aria-expanded="${open}">`;
    if(opt.editable)h+=`<div class="el-row-check" role="checkbox" tabindex="0" aria-checked="${!!opt.coche}">${opt.coche?'✓':''}</div>`;
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
    const st=etatComp(curComp),editing=selectedEc&&ecById(selectedEc)&&estAdmin();
    const ajout=!editing&&ajoutOuvert&&ecById(ajoutOuvert)&&proposeur()?ajoutOuvert:null;
    const plie=empile()&&!vues.prog;
    el.classList.toggle('plie',plie);
    let h=`<div class="sp-header">${titreDoc('prog')}`;

    if(editing)h+=`<span class="sp-actions"><span class="sp-editing-badge">✎ ${ecCourt(selectedEc)}<button class="sp-close" id="sp-deselect" title="${esc(U('editClose'))}" aria-label="${esc(U('editClose'))}">✕</button></span></span>`;
    h+=`</div>`;
    if(plie){el.innerHTML=h;return;}
    if(comp().heures)h+=`<p class="seuil">${U('duree')} ${U('heures',{n:comp().heures})}</p>`;
    if(comp().note)h+=`<p class="comp-note">${T(comp().note)}</p>`;
    // Lecture et crayon : les éléments liés à au moins un critère sont en relief, quand les liens sont affichés.
    const lies=new Set();comp().ec.forEach(ec=>comp().els.forEach(e=>{if(st.maitre[K(ec.id,e.id)])lies.add(e.id);}));
    const relief=id=>crossRef&&lies.has(id);
    if(editing){
      // Crayon : la vue de lecture, plus une case par élément (cochée : lié au critère sélectionné).
      comp().els.forEach(e=>{
        const k=K(selectedEc,e.id);
        h+=elCardHtml(st,e,{editable:true,ecId:selectedEc,coche:!!st.maitre[k],lie:relief(e.id),chips:crossRef,note:noteEdition(st,k),bulle:puceProbable(st,k)});
      });
    }else if(ajout){
      // Proposer un ajout : le relief passe aux éléments disponibles, qui attendent un clic; celui qu'on choisit demande
      // la raison. Les éléments déjà liés à ce critère ou déjà proposés ne se choisissent pas.
      comp().els.forEach(e=>{
        const k=K(ajout,e.id),pris=!!st.maitre[k]||!!st.props[k],choisi=ajoutEl===e.id;
        const note=choisi?`<form class="note-ecart" data-ajout-form="${e.id}"><input maxlength="300" data-champ="ajout" value="${esc(ajoutTexte)}" placeholder="${esc(U('raisonAjout'))}" aria-label="${esc(U('raisonAjout'))}"><div class="ligne"><button type="submit" class="btn-p">${U('proposer')}</button><button type="button" class="btn-s" data-annuler-ajout>${U('annuler')}</button></div></form>`:'';
        h+=elCardHtml(st,e,{ecId:ajout,disponible:!pris&&!choisi,choisi,chips:crossRef,note});
      });
    }else{
      comp().els.forEach(e=>{h+=elCardHtml(st,e,{chips:crossRef,lie:relief(e.id)});});
    }
    el.innerHTML=h;
    bindElCards(el);
    if(ajout){

      // Un clic sur un élément disponible le choisit; son chevron, lui, déplie ses précisions.
      el.querySelectorAll('.el-card.disponible>.el-card-top').forEach(top=>{
        top.addEventListener('click',ev=>{
          if(ev.target.closest('.el-chevron'))return;
          ev.stopPropagation();ajoutEl=top.parentNode.dataset.elid;ajoutTexte='';render();
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
          proposerAjout(ec,elId,encoderMentions(r));montrer(`#sheet-ref [data-eckey="${ec}"]`,'center');
        });
        f.querySelector('[data-annuler-ajout]').addEventListener('click',ev=>{ev.stopPropagation();ajoutEl='';ajoutTexte='';render();});
      }
      return;
    }
    if(!editing)return;
    $('sp-deselect').addEventListener('click',()=>{const ec=selectedEc;selectedEc=null;render();montrer(`#sheet-ref [data-eckey="${ec}"]`,'center');});
    el.querySelectorAll('[data-elrow] .el-row-check').forEach(chk=>{
      const row=chk.closest('[data-elrow]');
      chk.addEventListener('click',ev=>{
        ev.stopPropagation();
        const ec=row.dataset.elrow,elId=row.dataset.elid,k=K(ec,elId);
        // Cocher un lien qui a une proposition l'adopte.
        gesteAdmin([{ec,el:elId,geste:st.maitre[k]?'retiré':st.props[k]?'adopté':'ajouté'}]);
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
      if(c.parentNode.classList.contains('disponible')&&!ev.target.closest('.el-chevron'))return;
      ev.stopPropagation();
      const id=c.dataset.eltgl;
      if(expandedEls.has(id))expandedEls.delete(id);else expandedEls.add(id);
      render();
    }));
    root.querySelectorAll('.ec-chip[data-ecid]').forEach(chip=>{
      const ec=ecById(chip.dataset.ecid);
      if(!ec)return;
      chip.addEventListener('mouseenter',ev=>showTT(ev,{label:ec.label,pond:ponderation(ec),pcs:ec.subs.map(s=>({t:s}))}));
      chip.addEventListener('mouseleave',hideTT);
    });
  }

  // ---- Discussion de la compétence; encadré d'un lien ----
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
  // Mention d'un compte supprimé : « @participant retiré ».
  const decoderMentions=t=>String(t).replace(/@\[(\d+)\]/g,(_,id)=>{const p=participants.find(x=>x.id===id);return '@'+(p?p.nom:U('participantRetire'));});
  const avecMentions=t=>esc(t).replace(/@\[(\d+)\]/g,(_,id)=>{const p=participants.find(x=>x.id===id);return `<span class="arobase">@${esc(p?p.nom:U('participantRetire'))}</span>`;});
  function texteEvt(e){
    const n=quiTexte(e.x),c=nomDe(e.prop);
    return U({ajout:'eAjout',retrait:'eRetrait',remis:'eRemis',maintenu:'eMaintenu',adopte:'eAdopte',classe:'eClasse',propose:'eEcartAjout'}[e.type],{n,c});
  }
  // Un message de la discussion. Les miens (actions) portent ✎ et 🗑 au bout de la ligne; « modifié » s'il l'a été.
  function msgHtml(m,tag,st,actions){

    const texte=st&&st.texteDe.get(m)||m.texte,att=msgAttente.includes(m);
    const mien=actions&&!att&&m.type===''&&connecte()&&m.participant===moi(),edition=mien&&msgEdition&&msgEdition.ts===m.ts,suppr=mien&&msgSuppr===m.ts;
    const act=!mien||edition?'':suppr
      ?`<span class="msg-actions ouvert"><button type="button" class="btn-p danger" data-msg-confirmer="${esc(m.ts)}">${U('supprimer')}</button><button type="button" class="btn-s" data-msg-annuler>${U('annuler')}</button></span>`
      :`<span class="msg-actions"><button type="button" data-msg-modifier="${esc(m.ts)}" title="${esc(U('modifierMsg'))}" aria-label="${esc(U('modifierMsg'))}">✎</button><button type="button" data-msg-supprimer="${esc(m.ts)}" title="${esc(U('supprimerMsg'))}" aria-label="${esc(U('supprimerMsg'))}">🗑</button></span>`;
    const corps=edition
      ?`<form class="msg-edition" data-msg-edition="${esc(m.ts)}"><textarea data-champ="msgedit" maxlength="2000" aria-label="${esc(U('modifierMsg'))}">${esc(msgEdition.texte)}</textarea><div class="ligne"><button type="submit" class="btn-p">${U('enregistrer')}</button><button type="button" class="btn-s" data-msg-annuler>${U('annuler')}</button></div></form>`
      :`<div class="msg-texte">${avecMentions(texte)}</div>`;
    return `<div class="msg${att?' attente':''}"><div class="msg-tete">${qui(m)}${tag||''}<span>${dateHeure(m.ts)}</span>${st&&st.modifies.has(m)?`<span class="msg-modifie">${U('modifie')}</span>`:''}${act}</div>${corps}</div>`;
  }
  // La discussion d'une compétence : les messages et les gestes, triés par date. Un geste est une ligne discrète; le
  // raison d'un ajout proposé ou d'un vote contre le suit en bulle.
  const IC_EVT={ajout:'+',retrait:'−',remis:'↺',maintenu:'⚖',adopte:'⇄',classe:'⇄',propose:'+'};
  function filElements(st,k){
    const l=[];
    st.evts.forEach(e=>{if(e.masque)return;if(!k||e.k===k)l.push({ts:e.x.ts,r:0,e});});
    st.msgs.forEach(m=>{const mk=m.el?K(m.cible,m.el):'';if(!k||mk===k)l.push({ts:m.ts,r:1,m,mk});});
    return l.sort((a,b)=>a.ts<b.ts?-1:a.ts>b.ts?1:a.r-b.r);
  }
  // k : l'encadré d'un lien, où l'étiquette du lien est omise.
  function filHtml(st,k){
    const tag=x=>k?'':`<button type="button" class="tag" data-cible="${esc(x)}">${esc(lienTxt(x))}</button> `;
    const ligne=(ic,adm,x,txt,ts,att)=>`<div class="geste${adm?' admin':''}${att?' attente':''}"><span class="ic-g">${ic}</span><span>${tag(x)}${esc(txt)} <span class="q">· ${dateHeure(ts)}</span></span></div>`;
    const bulle=(m,cls)=>`<div class="msg rattache${cls}${msgAttente.includes(m)?' attente':''}"><div class="msg-texte">${avecMentions(m.texte)}</div></div>`;
    // La raison d'un ajout proposé part avec son geste, dans le même envoi : même date, même lien, même auteur.
    const lies=new Set();
    const raisonDe=e=>{
      if(e.type!=='propose')return null;
      const [ec,el]=deK(e.k);
      return st.msgs.find(m=>m.type==='ecart'&&!lies.has(m)&&m.ts===e.x.ts&&m.participant===e.x.participant&&m.cible===ec&&m.el===el)||null;
    };
    return filElements(st,k).map(i=>{
      if(i.e){
        const e=i.e,m=raisonDe(e);if(m)lies.add(m);
        return ligne(IC_EVT[e.type]||'·',e.type!=='propose',e.k,texteEvt(e),e.x.ts,e.attente)+(m?bulle(m,e.type==='propose'?' ajout':''):'');
      }
      const m=i.m,att=msgAttente.includes(m);
      if(lies.has(m)||st.masques.has(m))return '';
      if(m.type==='contre'&&i.mk)return ligne('👎',false,i.mk,U('eContre',{n:quiTexte(m)}),m.ts,att)+bulle(m,'');
      // La raison d'une deuxième personne qui propose un ajout encore appuyé : son geste ne crée pas de proposition, mais
      // sa raison reste dans la discussion.
      if(m.type==='ecart'&&i.mk)return ligne(IC_EVT.propose,false,i.mk,U('eEcartAjout',{n:quiTexte(m)}),m.ts,att)+bulle(m,' ajout');
      return msgHtml(m,i.mk?tag(i.mk):'',st,!k);
    }).join('');
  }
  function renderFil(){
    const st=etatComp(curComp);
    // La poignée de la discussion : un clic la déploie ou l'escamote.
    const pf=$('onglet-discussion'),ouvert=filOnglet==='discussion';
    pf.innerHTML=`💬 ${U('discussion')} <span class="compte">${st.msgs.length-st.masques.size}</span><span class="chev" aria-hidden="true">▲</span>`;
    pf.classList.toggle('active',ouvert);pf.setAttribute('aria-expanded',ouvert);
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
      etat.push(`<b>${esc(U('encMaitre'))}</b> ${esc(decompte(st,k))}`);
      if(estAdmin()&&st.probable.has(k))etat.push(`<span class="etiq-ecart probable">${U('probableCourt')}</span>`);
      if(st.attente.has(k))etat.push(`<span class="att">${esc(U('encAttente'))}</span>`);
    }else if(!st.props[k])etat.push(`<b>${esc(U('encHors'))}</b>`);
    const p=st.props[k];
    if(p){etat.push(`<span><b>${esc(U('encAjout'))}</b> ${esc(U('encPar',{c:nomDe(p.x)}))}${p.etat==='classe'?` (${esc(U('classeCourt'))})`:''}</span>`);etat.push(`<span>${esc(decompte(st,k))}</span>`);}
    // Ce que montre le survol : la pondération et les sous-critères du critère, les précisions de l'élément, les noms des
    // votants. Le séparateur « · » ouvre l'élément qui le suit : il ne reste jamais seul en bout de ligne.
    const E=ecById(ec,c),L=elById(el,c),vv=votesDe(st,k);
    const liste=l=>l.length?`<ul>${l.map(x=>`<li>${esc(T(x))}</li>`).join('')}</ul>`:'';
    // Les votants d'un lien qui compte ses votes (concordance ou ajout proposé), comme le décompte.
    const montrerVotes=st.maitre[k]||!!p;
    const votants=(montrerVotes?[['👍',vv.pour],['👎',vv.contre]]:[]).filter(([,l])=>l.length).map(([ic,l])=>`<span class="votants">${ic} ${esc(noms(l))}</span>`).join('');
    $('encadre-boite').innerHTML=`<div class="encadre-tete"><h2 id="encadre-titre">${esc(lienTxt(k))}</h2><button type="button" class="btn-s" id="encadre-fermer" aria-label="${esc(U('fermer'))}" title="${esc(U('fermer'))}">✕</button></div>`
      +`<div class="encadre-def"><div><b>${esc(U('critere'))}</b> ${esc(T((E||{}).label))}${E?`<span class="enc-pts">${esc(ponderation(E))}</span>`:''}${E?liste(E.subs):''}</div>`
      +`<div><b>${esc(U('element'))}</b> ${esc(libEl(el,c))}${L?liste(L.pcs.map(p=>p.t)):''}</div></div>`
      +`<div class="encadre-etat">${etat.map((x,i)=>`<span class="et">${i?'<span class="sep">·</span>':''}${x}</span>`).join('')}${votants}</div>`
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
    const b=ev.target.closest('[data-cible]');if(!b)return;
    const ec=deK(b.dataset.cible)[0];if(!ecById(ec))return;
    comp().indicateurs.forEach((ind,si)=>{if(ind.ecs.includes(ec))collapsedInds.delete(curComp+':'+si);});
    if(!vues.ref){vues.ref=true;garder('vues',JSON.stringify(vues));}
    expandedEcs.add(ec);render();
    const card=R.querySelector(`#sheet-ref [data-eckey="${ec}"]`);if(card)card.scrollIntoView({block:'nearest',behavior:'smooth'});
  });
  R.querySelectorAll('.poignee-fil').forEach(b=>b.addEventListener('click',()=>{if(filOnglet===b.dataset.onglet){filOnglet=null;render();}else{ouvrirFil(b.dataset.onglet);if(pret)charger(true);}}));
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
        else{const p=st.props[k];if(p&&p.etat==='attente')lignes.push({c,k,type:'ajout',p,st});}
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
    if(l.p){const parV={};msgsLien(st,l.k).forEach(m=>{if(m.type==='ecart'&&m.ts>=l.p.x.ts&&!st.masques.has(m))parV[m.participant]=m;});Object.values(parV).forEach(m=>items.push({m,cls:'ajout'}));}
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
    if(s2.length)h+=`<div class="section-t"><h3>${esc(U('traiterS2'))} <span class="compteur">${s2.length}</span></h3>${s2.map(x=>ligne(x,[`<span class="tag-t e">⇄ ${esc(U('ajoutePar',{c:nomDe(x.p.x)}))}</span>`],`<button type="button" class="btn-p" data-adopter-t="${x.c}|${x.k}">${esc(U('adopterAjout'))}</button><button type="button" class="btn-s" data-classer-t="${x.c}|${x.k}" title="${esc(U('classerTip'))}">${U('classer')}</button>`)).join('')}</div>`;
    const P=$('page-traiter');
    P.innerHTML=h;
    const parts=s=>{const [c,ec,el]=s.split('|');return {c,k:K(ec,el)};};
    P.querySelectorAll('[data-maintenir]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.maintenir);maintenir(p.c,p.k);}));
    P.querySelectorAll('[data-retirer]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.retirer);retirerMaitre(p.c,p.k);}));
    P.querySelectorAll('[data-adopter-t]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.adopterT);adopter(p.c,p.k);}));
    P.querySelectorAll('[data-classer-t]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.classerT);classer(p.c,p.k);}));
    P.querySelectorAll('[data-ouvrir]').forEach(b=>b.addEventListener('click',()=>{const p=parts(b.dataset.ouvrir);ouvrirCritere(p.c,deK(p.k)[0]);}));
  }
  // ---- Membres : regroupés par centre, pour tous. Le titre d'un centre porte, pour les administrateurs, ✎ (renommer)
  // et « Fusionner avec… » (fusionner un doublon). Pas de courriel. ----
  // « Membres ». Participants : les membres regroupés par centre. Administrateurs : le tableau des comptes, avec leur
  // activité et leurs gestes d'administration, puis les centres (renommer, retirer un centre vide).
  function renderMembres(){
    const parNom=(a,b)=>a.nom.localeCompare(b.nom,lang,{sensitivity:'base'});
    const tri=centres.slice().sort(parNom);
    let h=`<h2>${esc(U('membres'))}</h2>`;
    h+=estAdmin()?comptesAdmin(tri,parNom)+centresAdmin(tri):membresParCentre(tri,parNom);
    const P=$('page-membres');
    P.innerHTML=h;
    if(estAdmin()){lierCentres(P);lierMembres(P);}
  }
  // Captures du mode d'emploi : publiées verrouillées dans aide-5319.json (elles montrent des bouts du référentiel),
  // chargées à la première ouverture de la page; en local, le référentiel en clair va avec les images du dossier aide/.
  // Une capture introuvable : sa figure disparaît.
  let captures=null;
  function chargerCaptures(){
    if(!captures)captures=verrouille
      ?fetch(BASE+'aide-5319.json').then(r=>{if(!r.ok)throw new Error('captures');return r.json();}).then(dechiffrer).then(m=>n=>m[n]||'').catch(()=>{captures=null;return ()=>'';})
      :Promise.resolve(n=>BASE+'aide/'+n+'.webp');
    return captures;
  }
  function renderAide(){
    const P=$('page-aide');
    P.innerHTML=`<h2>${esc(U('aide'))}</h2><div class="aide">${AIDE[lang].split('{courriel}').join(esc(COURRIEL_SOUTIEN))}</div>`;
    chargerCaptures().then(src=>P.querySelectorAll('img[data-capture]').forEach(i=>{
      const s=src(lang+'-'+i.dataset.capture);
      if(!s){i.closest('figure').hidden=true;return;}
      i.addEventListener('error',()=>{i.closest('figure').hidden=true;});i.src=s;
    }));
  }
  function membresParCentre(tri,parNom){
    const liste=l=>`<ul class="membres">${l.slice().sort(parNom).map(p=>`<li><b>${esc(p.nom)}</b>${p.role==='administrateur'?`<span class="role">admin</span>`:''}</li>`).join('')}</ul>`;
    const titre=(nom,n)=>`<div class="ligne-c"><span class="nom-c">${esc(nom)}</span><span class="detail">${esc(U(n===1?'nCompte':'nComptes',{n}))}</span></div>`;
    // Un compte dont le centre n'est plus dans la liste (ou sans centre) : groupe « Sans centre », à la fin.
    const sans=participants.filter(p=>!tri.some(c=>c.id===p.centre));
    let h=tri.map(c=>{const l=participants.filter(p=>p.centre===c.id);return `<div class="groupe-m" data-centre="${esc(c.id)}">${titre(c.nom,l.length)}${liste(l)}</div>`;}).join('');
    if(sans.length)h+=`<div class="groupe-m">${titre(U('sansCentre'),sans.length)}${liste(sans)}</div>`;
    return h;
  }
  // Centres : ✎ pour renommer; « Retirer » pour un centre qui n'a plus aucun compte.
  function centresAdmin(tri){
    const ligneC=c=>{
      const n=participants.filter(p=>p.centre===c.id).length;
      const err=centreErreur&&centreErreur.id===c.id?`<span class="ident-erreur" role="alert">${esc(U(centreErreur.cle))}</span>`:'';
      if(centreEdition&&centreEdition.id===c.id)return `<form class="ligne-c" data-centre-form="${esc(c.id)}"><input data-champ="centre" maxlength="80" value="${esc(centreEdition.nom)}" aria-label="${esc(U('renommer'))}"><span class="actions"><button type="submit" class="btn-p">${U('enregistrer')}</button><button type="button" class="btn-s" data-centre-annuler>${U('annuler')}</button></span>${err}</form>`;
      const outils=`<span class="actions"><button type="button" class="btn-s" data-centre-renommer="${esc(c.id)}" title="${esc(U('renommer'))}" aria-label="${esc(U('renommer'))}">✎</button>${n?'':`<button type="button" class="btn-s" data-centre-retirer="${esc(c.id)}" title="${esc(U('retirerCentreTip'))}">${U('retirerCentre')}</button>`}</span>`;
      return `<div class="ligne-c"><span class="nom-c">${esc(c.nom)}</span><span class="detail">${esc(U(n===1?'nCompte':'nComptes',{n}))}</span>${outils}${err}</div>`;
    };
    return `<h3 class="titre-m">${esc(U('centresTitre'))}</h3>${tri.map(ligneC).join('')}`;
  }
  // Activité de chaque compte : ses votes qui comptent (le dernier sur chaque lien), ses messages (sans les raisons,
  // les modifications ni les messages qu'il a supprimés) et ses propositions d'ajout.
  function activite(){
    const act={},a=id=>act[id]||(act[id]={pour:0,contre:0,comm:0,ajouts:0});
    const dernier={};votes.forEach(v=>{dernier[v.participant+'#'+v.comp+'|'+K(v.ec,v.el)]=v;});
    Object.values(dernier).forEach(v=>{if(v.sens==='pour')a(v.participant).pour++;else if(v.sens==='contre')a(v.participant).contre++;});
    const retires=new Set(messages.filter(m=>m.type==='supprime').map(m=>m.ref));
    messages.forEach(m=>{if(m.type===''&&!retires.has(m.ts))a(m.participant).comm++;});
    journal.forEach(x=>{if(x.geste==='proposé')a(x.participant).ajouts++;});
    return id=>a(id);
  }
  // Comptes : une ligne par compte. Le centre se corrige dans la ligne; fusionner, promouvoir ou retirer le rôle, et
  // supprimer demandent une confirmation, sous la ligne. Ni fusion ni suppression pour son propre compte ou celui d'un
  // autre administrateur; on ne se retire pas soi-même le rôle.
  function comptesAdmin(tri,parNom){
    const act=activite(),dateI=x=>x?new Date(x).toLocaleDateString(lang==='fr'?'fr-CA':'en-CA',{day:'numeric',month:'short',year:'numeric'}):'';
    const nomC=p=>{const nc=nomCentre(p.centre);return nc?`${p.nom} (${nc})`:p.nom;};
    const tous=participants.slice().sort(parNom);
    const ligne=p=>{
      const moi=p.id===participant,adm=p.role==='administrateur',x=act(p.id);
      const centreSel=`<select data-compte-centre="${esc(p.id)}" aria-label="${esc(U('colCentre')+' — '+p.nom)}">${tri.some(c=>c.id===p.centre)?'':`<option value="" selected>${esc(U('sansCentre'))}</option>`}${tri.map(c=>`<option value="${esc(c.id)}"${c.id===p.centre?' selected':''}>${esc(c.nom)}</option>`).join('')}</select>`;
      const fusion=moi||adm?'':`<select data-compte-fusion="${esc(p.id)}" aria-label="${esc(U('fusionnerDans')+' — '+p.nom)}"><option value="">${esc(U('fusionnerDans'))}</option>${tous.filter(q=>q.id!==p.id).map(q=>`<option value="${esc(q.id)}">${esc(nomC(q))}</option>`).join('')}</select>`;
      const role=moi?'':`<button type="button" class="btn-s" data-compte-role="${esc(p.id)}" data-admin="${adm?'0':'1'}" title="${esc(U(adm?'retirerRole':'promouvoir'))}">${esc(U(adm?'retirerRoleBtn':'promouvoirBtn'))}</button>`;
      const suppr=moi||adm?'':`<button type="button" class="suppr-m" data-membre-suppr="${esc(p.id)}" title="${esc(U('supprimerMembre'))}" aria-label="${esc(U('supprimerMembre'))}">🗑</button>`;
      const tr=`<tr data-compte="${esc(p.id)}"><td><b>${esc(p.nom)}</b>${adm?` <span class="role">admin</span>`:''}</td><td>${centreSel}</td><td>${esc(dateI(p.inscription))}</td>`
        +`<td class="nb">${x.pour}</td><td class="nb">${x.contre}</td><td class="nb">${x.comm}</td><td class="nb">${x.ajouts}</td><td><span class="actions-m">${fusion}${role}${suppr}</span></td></tr>`;
      return tr+(membreAction&&membreAction.id===p.id?`<tr class="confirmer-r"><td colspan="8">${confirmerAction(p)}</td></tr>`:'');
    };
    const err=membreErreur&&!membreAction?`<p class="ident-erreur" role="alert">${esc(U(membreErreur))}</p>`:'';
    const th=k=>`<th scope="col">${esc(U(k))}</th>`,thN=k=>`<th scope="col" class="nb">${esc(U(k))}</th>`;
    return `<h3 class="titre-m">${esc(U('comptesTitre'))}</h3>${err}<div class="table-m"><table><thead><tr>${th('colNom')}${th('colCentre')}${th('colInscription')}${thN('colPour')}${thN('colContre')}${thN('colComm')}${thN('colAjouts')}<th scope="col"><span class="sr">${esc(U('colActions'))}</span></th></tr></thead>`
      +`<tbody>${tous.map(ligne).join('')}</tbody></table></div>`;
  }
  // La confirmation d'un geste sur un compte, sous sa ligne.
  function confirmerAction(p){
    const a=membreAction,err=membreErreur?`<span class="ident-erreur" role="alert">${esc(U(membreErreur))}</span>`:'';
    const boutons=(lib,danger)=>`<span class="actions"><button type="button" class="btn-p${danger?' danger':''}" data-membre-confirmer>${esc(U(lib))}</button><button type="button" class="btn-s" data-membre-annuler>${U('annuler')}</button></span>`;
    if(a.type==='suppr')return confirmerSuppr(p);
    if(a.type==='fusion'){const v=participants.find(q=>q.id===a.vers);return `<div class="ligne-c confirmer-m"><span>${esc(U('confirmerFusionCompte',{a:p.nom,b:v?v.nom:''}))} <b>${esc(U('definitif'))}</b></span>${boutons('fusionner',true)}${err}</div>`;}
    return `<div class="ligne-c confirmer-m"><span>${esc(U(a.admin?'confirmerPromo':'confirmerRetraitRole',{n:p.nom}))}</span>${boutons(a.admin?'promouvoirBtn':'retirerRoleBtn',!a.admin)}${err}</div>`;
  }
  // Ce que la suppression d'un compte efface : ses messages (raisons comprises), les liens où il a voté, ses propositions.
  function confirmerSuppr(p){
    const nb=(n,un,plus)=>n===1?U(un):U(plus,{n});
    const m=messages.filter(x=>x.participant===p.id&&x.type!=='modif'&&x.type!=='supprime').length;
    const v=new Set(votes.filter(x=>x.participant===p.id).map(x=>x.comp+'|'+K(x.ec,x.el))).size;
    const pr=journal.filter(x=>x.participant===p.id&&x.geste==='proposé').length;
    const l=[m&&nb(m,'n1Message','nMessages'),v&&nb(v,'n1Vote','nVotes'),pr&&nb(pr,'n1Prop','nProps')].filter(Boolean);
    const liste=l.length>1?l.slice(0,-1).join(', ')+' '+U('et')+' '+l[l.length-1]:l[0];
    const nc=nomCentre(p.centre),err=membreErreur?`<span class="ident-erreur" role="alert">${esc(U(membreErreur))}</span>`:'';
    return `<div class="ligne-c confirmer-m"><span>${esc(U('confirmerSupprMembre',{n:p.nom,c:nc?' ('+nc+')':''}))} ${esc(l.length?U('tracesSuppr',{l:liste}):U('aucuneTrace'))} <b>${esc(U('definitif'))}</b></span>`
      +`<span class="actions"><button type="button" class="btn-p danger" data-membre-confirmer>${U('supprimer')}</button><button type="button" class="btn-s" data-membre-annuler>${U('annuler')}</button></span>${err}</div>`;
  }
  function lierMembres(P){
    const ouvrir=a=>{membreAction=a;membreErreur=null;render();const c=P.querySelector('[data-membre-annuler]');if(c)c.focus();};
    P.querySelectorAll('[data-membre-suppr]').forEach(b=>b.addEventListener('click',()=>ouvrir({type:'suppr',id:b.dataset.membreSuppr})));
    P.querySelectorAll('[data-compte-fusion]').forEach(s=>s.addEventListener('change',()=>{if(s.value)ouvrir({type:'fusion',id:s.dataset.compteFusion,vers:s.value});}));
    P.querySelectorAll('[data-compte-role]').forEach(b=>b.addEventListener('click',()=>ouvrir({type:'role',id:b.dataset.compteRole,admin:b.dataset.admin==='1'})));
    P.querySelectorAll('[data-compte-centre]').forEach(s=>s.addEventListener('change',()=>{if(s.value)gererComptes({centre:{id:s.dataset.compteCentre,centre:s.value}});}));
    P.querySelectorAll('[data-membre-annuler]').forEach(b=>b.addEventListener('click',()=>{membreAction=null;membreErreur=null;render();}));
    const ok=P.querySelector('[data-membre-confirmer]');
    if(ok)ok.addEventListener('click',()=>{
      const a=membreAction;if(!a)return;
      if(a.type==='suppr')supprimerCompte(a.id);
      else if(a.type==='fusion')gererComptes({fusionner:{de:a.id,vers:a.vers}});
      else gererComptes({role:{id:a.id,admin:a.admin}});
    });
  }
  // La feuille répond avec tout : le compte et ses traces disparaissent de l'affichage.
  function supprimerCompte(id){
    sync='envoi';render();
    return enFile(()=>backend.supprimerCompte(id).then(d=>{appliquer(d);cache=null;sync='';membreAction=null;membreErreur=null;},e=>{
      if(e.message==='compte-admin'){sync='';membreErreur='eCompteAdmin';return;}
      sync=erreur(e);membreAction=null;
    }).then(()=>render()));
  }
  // Centre d'un compte, fusion de deux comptes, rôle d'administrateur : la feuille répond avec tout.
  function gererComptes(op){
    sync='envoi';render();
    return enFile(()=>backend.comptes(op).then(d=>{appliquer(d);cache=null;sync='';membreAction=null;membreErreur=null;},e=>{
      if(e.message==='compte-admin'||e.message==='compte-cible'||e.message==='centre'){sync='';membreErreur='eRefuse';return;}
      sync=erreur(e);membreAction=null;
    }).then(()=>render()));
  }
  function lierCentres(P){
    const raz=()=>{centreEdition=null;centreErreur=null;};
    P.querySelectorAll('[data-centre-renommer]').forEach(b=>b.addEventListener('click',()=>{
      const c=centres.find(x=>x.id===b.dataset.centreRenommer);if(!c)return;
      raz();centreEdition={id:c.id,nom:c.nom};render();
      const i=P.querySelector('[data-champ="centre"]');if(i){i.focus();i.select();}
    }));
    P.querySelectorAll('[data-centre-retirer]').forEach(b=>b.addEventListener('click',()=>{raz();gererCentres({retirer:{id:b.dataset.centreRetirer}},b.dataset.centreRetirer);}));
    P.querySelectorAll('[data-centre-annuler]').forEach(b=>b.addEventListener('click',()=>{raz();render();}));
    const f=P.querySelector('[data-centre-form]');
    if(f){
      f.querySelector('input').addEventListener('input',ev=>{centreEdition.nom=ev.target.value;});
      f.addEventListener('submit',ev=>{
        ev.preventDefault();const id=f.dataset.centreForm,nomC=centreEdition.nom.trim(),c=centres.find(x=>x.id===id);
        if(!nomC)return;
        if(c&&c.nom===nomC){raz();render();return;}
        gererCentres({renommer:{id,nom:nomC}},id);
      });
    }
  }
  // Une opération sur les centres : la feuille répond avec tout, comme pour un geste. Un nom déjà pris est refusé, comme
  // le retrait d'un centre qui a encore des comptes.
  function gererCentres(op,id){
    sync='envoi';render();
    return enFile(()=>backend.centres(op).then(d=>{appliquer(d);sync='';centreEdition=null;centreErreur=null;},e=>{
      if(e.message==='doublon'){sync='';centreErreur={id,cle:'eDoublon'};return;}
      if(e.message==='centre-occupe'){sync='';centreErreur={id,cle:'eCentreOccupe'};return;}
      sync=erreur(e);
    }).then(()=>render()));
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
        if((eff==='maintenu'||eff==='retrait')&&v&&v.sens==='contre'&&e.x.ts>v.ts)l.push({ts:e.x.ts,c,k:e.k,ic:'⚖',txt:U(eff==='maintenu'?'nDecisionMaintenu':'nDecisionRetrait',{n:quiTexte(e.x),l:lienTxt(e.k),comp:c})});
        if(eff==='remis'&&v&&v.sens!=='retrait'&&e.x.ts>v.ts)l.push({ts:e.x.ts,c,k:e.k,ic:'↺',txt:U('nRemis',{l:lienTxt(e.k),comp:c})});
        if(e.prop&&e.prop.participant===moi()&&(e.type==='adopte'||e.type==='classe'))l.push({ts:e.x.ts,c,k:e.k,ic:'⇄',txt:U(e.type==='adopte'?'nAdopte':'nClasse',{n:quiTexte(e.x),l:lienTxt(e.k),comp:c})});
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
    ev.stopPropagation();ouvrirReglages(false);
    if(notifsOuvert)garder('notifs_lu',new Date().toISOString());
    notifsOuvert=!notifsOuvert;render();
  });
  document.addEventListener('click',ev=>{if(notifsOuvert&&!ev.composedPath().includes($('cloche'))){notifsOuvert=false;garder('notifs_lu',new Date().toISOString());render();}});

  // ---- Menu ⋮ (en-tête sur une rangée, même seuil que la règle @container de 760 px) : le bouton du compte, « À
  // traiter », Liens, EN, Annuler et le thème y passent; au-delà, ils restent à leur place dans l'en-tête. Fermé par un
  // toucher ailleurs, Échap, ou après l'usage d'un de ses boutons; jamais ouvert en même temps que les notifications. ----
  const identEntete=R.querySelector('.header-actions .ident-btn'),racine=R.querySelector('.racine');
  function ouvrirReglages(o){reglagesOuvert=o;$('menu-reglages').hidden=!o;$('btn-reglages').setAttribute('aria-expanded',String(o));}
  // Le seuil se lit dans la règle @container elle-même (⋮ affiché), à la largeur exacte du conteneur.
  function placerReglages(){
    const m=$('menu-reglages'),tel=racine.getBoundingClientRect().width>0&&getComputedStyle($('reglages')).display!=='none';
    if(tel&&identEntete.parentNode!==m)m.append(identEntete,$('btn-traiter'),$('links-wrap'),$('lang-btn'),$('undo-btn'),$('theme-btn'));
    else if(!tel&&identEntete.parentNode===m){
      ouvrirReglages(false);
      $('sync').before($('links-wrap'));$('sync').after($('btn-traiter'));$('cloche').after(identEntete,$('lang-btn'),$('undo-btn'),$('theme-btn'));
    }
  }
  placerReglages();
  // Passage de côte à côte à empilés, ou l'inverse : les documents se redessinent (poignées ou accordéons).
  const surRedim=()=>{
    placerReglages();
    if($('app').hidden||$('content-row').hidden||pileRendu===null)return;
    if(empile()!==pileRendu)render();
  };
  if(window.ResizeObserver)new ResizeObserver(surRedim).observe(racine);else window.addEventListener('resize',surRedim);
  $('btn-reglages').addEventListener('click',()=>{
    if(!reglagesOuvert&&notifsOuvert){notifsOuvert=false;garder('notifs_lu',new Date().toISOString());render();}
    ouvrirReglages(!reglagesOuvert);
  });
  // Après EN ou le thème, le focus revient à ⋮; le bouton du compte ouvre « Mon compte », qui prend le focus.
  $('menu-reglages').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;ouvrirReglages(false);if(!b.classList.contains('ident-btn'))$('btn-reglages').focus();});
  // En phase de capture : un toucher sur le contenu le ferme même quand ce contenu arrête la propagation du clic.
  document.addEventListener('click',ev=>{if(reglagesOuvert&&!ev.composedPath().includes($('reglages')))ouvrirReglages(false);},true);
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&reglagesOuvert&&!ev.composedPath().includes(host))ouvrirReglages(false);});

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
    if(!pret)return;
    if(!connecte()){if(!porte)ouvrirPorte();return;}
    renderEncadre();
    if(!$('landing').hidden){renderAccueil();return;}
    buildNav();updateHeader();
    const traiter=page==='traiter'&&estAdmin(),membres=page==='membres',aide=page==='aide';
    if(page==='traiter'&&!traiter)page='';
    $('content-row').hidden=traiter||membres||aide;$('fil').hidden=traiter||membres||aide;$('page-traiter').hidden=!traiter;$('page-membres').hidden=!membres;$('page-aide').hidden=!aide;

    renderNotifs();
    if(traiter){renderTraiter();return;}
    if(membres){renderMembres();return;}
    if(aide){renderAide();return;}
    if(selectedEc&&(!vues.prog||!estAdmin()))selectedEc=null;
    if(ajoutOuvert&&(!vues.prog||!proposeur()||!ecById(ajoutOuvert)))ajoutOuvert=null;
    // Côte à côte : un document refermé devient une boîte flottante sur sa marge; la languette d'un document ouvert
    // n'apparaît que si l'autre l'est aussi (un document reste toujours ouvert). Empilés
    // (téléphone) : les deux documents restent, chacun replié sur son titre ou déplié.
    const pile=empile();pileRendu=pile;
    if(!pile&&!vues.prog&&!vues.ref){vues={prog:true,ref:true};garder('vues',JSON.stringify(vues));}
    const voir={prog:pile||vues.prog,ref:pile||vues.ref};
    $('pane-prog').hidden=!voir.prog;$('pane-ref').hidden=!voir.ref;
    $('fermer-prog').hidden=$('fermer-ref').hidden=pile||!(vues.prog&&vues.ref);
    $('poignee-prog').hidden=pile||vues.prog;$('poignee-ref').hidden=pile||vues.ref;
    if(voir.prog)renderProgramme($('sheet-prog'));else $('sheet-prog').innerHTML='';
    if(voir.ref)renderReferentiel($('sheet-ref'));else $('sheet-ref').innerHTML='';
    bindCrossHover();
    renderFil();
  }

  function goToComp(k){
    curComp=k;garder('comp',k);expandedEcs.clear();expandedEls.clear();collapsedInds.clear();selectedEc=null;voteContre=null;encadre=null;msgEdition=null;msgSuppr=null;ajoutOuvert=null;
    if(etroit())navOpen=false;   // sur petit écran, le menu se superpose au contenu
    vueActive='app';$('landing').hidden=true;$('app').hidden=false;
    render();R.querySelectorAll('.pane,.content-row').forEach(p=>p.scrollTop=0);
  }
  function goHome(){
    vueActive='landing';$('app').hidden=true;$('landing').hidden=false;page='';
    expandedEcs.clear();expandedEls.clear();collapsedInds.clear();selectedEc=null;filOnglet=null;voteContre=null;encadre=null;ajoutOuvert=null;
    render();
  }

  $('comp-grille').addEventListener('click',ev=>{const b=ev.target.closest('[data-comp]');if(b)goToComp(b.dataset.comp);});
  // La languette d'un document ouvert le referme, et sa boîte flottante prend le focus; la boîte le rouvre. Le
  // titre d'un document empilé le replie ou le déplie.
  function basculerDoc(d,o){
    vues[d]=o;garder('vues',JSON.stringify(vues));render();
    const p=$('poignee-'+d);if(!o&&!p.hidden)p.focus();
  }
  $('fermer-prog').addEventListener('click',()=>basculerDoc('prog',false));
  $('fermer-ref').addEventListener('click',()=>basculerDoc('ref',false));
  $('poignee-prog').addEventListener('click',()=>basculerDoc('prog',true));
  $('poignee-ref').addEventListener('click',()=>basculerDoc('ref',true));
  $('content-row').addEventListener('click',ev=>{const b=ev.target.closest('[data-plier]');if(b)basculerDoc(b.dataset.plier,!vues[b.dataset.plier]);});
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
      else if(reglagesOuvert){ouvrirReglages(false);$('btn-reglages').focus();}
      else if(ajoutOuvert){ajoutOuvert=null;ajoutTexte='';ajoutEl='';render();}
      else if(membreAction){membreAction=null;membreErreur=null;render();}
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
  // « Membres » et « Mode d'emploi » : depuis le menu de gauche ou depuis l'accueil.
  function ouvrirPage(p){
    page=p;selectedEc=null;centreEdition=null;centreFusion=null;centreErreur=null;membreAction=null;membreErreur=null;
    if(etroit())navOpen=false;
    vueActive='app';$('landing').hidden=true;$('app').hidden=false;
    render();$('page-'+p).scrollTop=0;
  }
  $('nav-membres').addEventListener('click',()=>ouvrirPage('membres'));
  $('landing-membres').addEventListener('click',()=>ouvrirPage('membres'));
  $('nav-aide').addEventListener('click',()=>ouvrirPage('aide'));
  $('landing-aide').addEventListener('click',()=>ouvrirPage('aide'));
  $('crossref-cb').addEventListener('change',ev=>{crossRef=ev.target.checked;render();});

  applyUI();
  afficherVerrou('verrouChargement');charger();
  setInterval(()=>{if(pret&&!document.hidden&&!enAttente.length&&!msgAttente.length&&!voteAttente.length)charger(true);},60000);
  document.addEventListener('visibilitychange',()=>{if(pret&&!document.hidden)charger(true);});
}

customElements.define('concordance-5319',class extends HTMLElement{connectedCallback(){if(!this.shadowRoot)monter(this);}});
})();
