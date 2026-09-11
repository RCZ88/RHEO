(async () => {
  const activeWin = require("active-win");
  try {
    const r = await activeWin();
    console.log("active_win OK:", JSON.stringify(r && {app: r.owner && r.owner.name, title: r.title && r.title.substring(0,60)}));
  } catch(e) {
    console.log("active_win ERROR:", e.message);
  }
})();
