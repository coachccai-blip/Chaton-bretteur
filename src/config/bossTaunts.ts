/** Petits dialogues chaton ↔ boss joués avant chaque combat (tirés au hasard). */
export interface Taunt { cat: string; boss: string; }

export const BOSS_TAUNTS: Record<string, Taunt[]> = {
  // Sylvaan — Centaure Archer (Forêt)
  araignee: [
    { cat: 'Tu vises bien… pour un poney à bois.', boss: 'Je vais te clouer au sol, matou !' },
    { cat: 'Belles cornes ! Ça sert de porte-manteau ?', boss: 'Insolent ! Mes flèches te feront ronronner de douleur.' },
    { cat: 'J’ai laissé mes croquettes au chaud, finissons vite.', boss: 'La forêt sera ton tombeau, petit chat.' },
    { cat: 'Un centaure-chat ? On se ressemble presque.', boss: 'Ne me compare pas à toi, boule de poils !' },
    { cat: 'Mi-cheval, mi-chat… t’as pris quoi au petit-déj ?', boss: 'Assez ! Encoche, vise, adieu.' },
  ],
  // Gorbak — Gobu Géant (Marais)
  crapaudroi: [
    { cat: 'Ça sent le fromage oublié… c’est toi ?', boss: 'GORBAK écrase le petit chat !' },
    { cat: 'T’as pris un bain de boue ? Très classe.', boss: 'Gorbak va te rouler dessus. SPLATCH !' },
    { cat: 'Gros mais lent : mon combo préféré.', boss: 'Grrr… Gorbak PAS lent ! Gorbak SMASH !' },
    { cat: 'Tu craches vraiment partout, quelle éducation.', boss: 'Gorbak faim. Gorbak mange chaton.' },
  ],
  // Ignis — Serpent de Lave (Forge)
  golem: [
    { cat: 'Un serpent de lave ? J’espère que t’as pas froid.', boss: 'Tu vas fondre, misérable félin.' },
    { cat: 'Sssuper, un chauffage ambulant.', boss: 'Ssssilence ! Mes flammes te réduiront en cendres.' },
    { cat: 'Je préfère les serpentins de fête, sans rancune.', boss: 'Ta toute dernière plaisanterie, chaton.' },
    { cat: 'Tu mues souvent ? J’ai le même souci avec les poils.', boss: 'Rampe hors de mon antre… ou brûle.' },
  ],
  // Mortis — Archimage Mort-vivant (Citadelle)
  roi: [
    { cat: 'L’archimage… encore debout à cette heure ?', boss: 'Ton âme rejoindra mon armée, chaton.' },
    { cat: 'T’as une tête de déterré. Littéralement.', boss: 'Je danserai sur ta tombe, petit chat.' },
    { cat: 'Invoque ce que tu veux, j’ai neuf vies.', boss: 'Alors je les prendrai… toutes les neuf.' },
    { cat: 'Chapeau pointu, blagues plates.', boss: 'Insolence ! Meurs dans les ombres !' },
    { cat: 'Tu sens le vieux grimoire moisi, tu sais ?', boss: 'Le silence éternel t’apprendra le respect.' },
  ],
};
