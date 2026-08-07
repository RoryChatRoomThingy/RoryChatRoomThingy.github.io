window.EMOTES = {
  ':Happi:': 'assets/gifs/happi.gif',
  ':Crazy:': 'assets/gifs/crazy.gif',
  ':qt1:': 'assets/gifs/qt1.gif',
  ':qt2:': 'assets/gifs/qt2.gif',
  ':qt3:': 'assets/gifs/qt3.gif',
  ':qt4:': 'assets/gifs/qt4.gif',
  ':qt5:': 'assets/gifs/qt5.gif',
  ':qt6:': 'assets/gifs/qt6.gif',
  ':Knight:': 'assets/gifs/knightdance.gif',
  ':spamtenna:': 'assets/gifs/spamtenna.gif',
  ':cool:': 'assets/gifs/cool.gif',
  ':despair:': 'assets/gifs/despair.gif',
  ':mood:': 'assets/gifs/mood.gif',
  ':sans:': 'assets/gifs/sans.gif',
  ':kris:': 'assets/gifs/kris-deltarune.gif',
  ':sans2:': 'assets/gifs/sans-undertale.gif',
  ':silly:': 'assets/gifs/silly.gif',
  ':shadow:': 'assets/gifs/shadow.gif',
  ':spamton:': 'assets/gifs/spamton.gif',
  ':walter:': 'assets/gifs/walter.gif',
  ':pink:': 'assets/gifs/pink.gif',
  ':old:': 'assets/gifs/old.gif',
  ':eram:': 'assets/gifs/eram.gif',
  ':shadow:': 'assets/gifs/fish-spin-sha.gif'
};

window.parseEmotes = function parseEmotes(text) {
  let parsedText = text;
  
  // 1. Parse Emotes
  for (const [code, path] of Object.entries(window.EMOTES)) {
    const regex = new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    parsedText = parsedText.replace(regex, `<img class="chat-emote" src="${path}" alt="${code}" title="${code}" onerror="this.style.display='none'" />`);
  }
  
  // 2. Parse Mentions (Pings) - Looks for @ followed by alphanumeric characters/underscores
  parsedText = parsedText.replace(/@([a-zA-Z0-9_]+)/g, '<span class="mention">@$1</span>');

  return parsedText;
};
