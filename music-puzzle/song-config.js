/*
  זה הקובץ היחיד שמחליפים כאשר יוצרים משחק עם מנגינה חדשה.

  שמות התווים:
  C4 = דו
  D4 = רה
  E4 = מי
  F4 = פה
  G4 = סול
  A4 = לה
  B4 = סי

  duration:
  1 = רבע
  0.5 = שמינית
  2 = חצי

  measureEnd:
  true = קו תיבה אחרי התו
*/

window.SONG_CONFIG = {
  title: "נגנו את המנגינה",
  subtitle: "וגלו את התחנה הבאה שלכם",
  timeSignature: [2, 4],

  noteColors: {
    C: "#36A9E1",
    D: "#65B946",
    E: "#F2CF3A",
    F: "#F39A3D",
    G: "#8C62C6",
    A: "#E96A9B",
    B: "#58C9D5"
  },

  melody: [
    { note: "C4", duration: 1 },
    { note: "A4", duration: 1, measureEnd: true },

    { note: "F4", duration: 1 },
    { note: "C4", duration: 1, measureEnd: true },

    { note: "G4", duration: 0.5 },
    { note: "A4", duration: 0.5 },
    { note: "G4", duration: 0.5 },
    { note: "F4", duration: 0.5, measureEnd: true },

    { note: "E4", duration: 0.5 },
    { note: "D4", duration: 0.5 },
    { note: "E4", duration: 0.5 },
    { note: "C4", duration: 0.5, measureEnd: true }
  ]
};
