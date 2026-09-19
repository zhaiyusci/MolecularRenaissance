'use strict';
// Historical artistic radii, solely for frozen algorithm/migration fixtures.
// Production defaults are scientific covalent radii; this helper never auto-fits.
const radii={H:.27,C:.48,N:.46,O:.44,S:.55,P:.55};
module.exports=model=>({...model,atoms:model.atoms.map(atom=>({...atom,radius:radii[atom.element]||.48}))});
