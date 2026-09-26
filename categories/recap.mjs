// Quote every field and neutralize spreadsheet formulas in player-controlled text.
const cell=value=>{
  let text=String(value??'');
  if(/^[\s\uFEFF]*[=+@-]/u.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
};
export function recapCsv(recap){
  const rows=[['Room','Game','Round','Category','Turn','Player','Answer','Outcome','Called out by','Confirmed by','Call-out result','Round winner','Final score']];
  for(const round of recap.rounds){
    const entries=round.answers.length?round.answers:[{}];
    for(const a of entries)rows.push([recap.room,recap.id,round.round,round.category,a.turn,a.name,a.answer,a.status==='invalid'?'called out':a.status,a.callout?.caller,a.callout?.confirmedBy,a.callout?.outcome,round.winner?.name,recap.players.find(p=>p.id===a.player)?.score]);
  }
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
