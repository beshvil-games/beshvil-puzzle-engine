/*
  בקובץ הזה מחליפים את המנגינה בלבד.

  ABC notation:
  L:1/8 מגדיר ששמינית היא יחידת הבסיס.
  C A F2 = דו ולה כשמיניות, פה כרבע.
*/

window.SONG_CONFIG = {
  title: "נגנו את המנגינה",
  subtitle: "וגלו את התחנה הבאה שלכם",

  noteColors: {
    C: "#36A9E1",
    D: "#65B946",
    E: "#F2CF3A",
    F: "#F39A3D",
    G: "#8C62C6",
    A: "#E96A9B",
    B: "#58C9D5"
  },

  notes: [
    "C4","A4","F4",
    "C4","A4","F4",
    "G4","A4","G4","F4",
    "E4","D4","E4","C4"
  ],

  abc: `
X:1
M:2/4
L:1/8
K:C clef=treble
(C A) F2 | (C A) F2 | G A G F | E D E C ||
`
};
