// Express.js-ஐ நமது ஃபைலில் இணைக்கிறோம்
const express = require('express');
const app = express();

// வெப்சைட்டின் முகப்புப் பக்கத்திற்கு யாராவது வந்தால் என்ன நடக்க வேண்டும்
app.get('/', (req, res) => {
  res.send('<h1>வணக்கம்! இது Node.js மற்றும் Express.js மூலம் உருவாக்கப்பட்ட வெப்சைட்.</h1>');
});

// சர்வரை 3000 என்ற போர்ட்டில் (Port) இயங்க வைக்கிறோம்
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`சர்வர் வெற்றிகரமாக http://localhost:${PORT} -ல் இயங்குகிறது`);
});