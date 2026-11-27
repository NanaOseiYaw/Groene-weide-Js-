// The three fields and their spots. This is not in the database (team decision).
// The spot names must be the same as in server/src/db/seed.js.

export const FIELDS = {
  TentCaravan: {
    name: 'Kampeerveld',
    icon: 'tent',
    columns: 8, // spots per row: 5 rows of 8
    spotNames: makeNames('T', 40, 2), // T01 … T40
    nearby: 'receptie en oude melkstal', // shown on the path below the field
  },
  Camper: {
    name: 'Camperveld',
    icon: 'camper',
    columns: 4, // 3 rows of 4
    spotNames: makeNames('C', 12, 2), // C01 … C12
    nearby: 'sanitairgebouw',
  },
  Safari: {
    name: 'Safariveld',
    icon: 'safari',
    columns: 4, // 2 rows of 4
    spotNames: makeNames('S', 8, 1), // S1 … S8
    nearby: 'zwembad',
  },
};

// makeNames('T', 3, 2) gives ['T01', 'T02', 'T03']
function makeNames(letter, count, digits) {
  const names = [];
  for (let number = 1; number <= count; number++) {
    names.push(letter + String(number).padStart(digits, '0'));
  }
  return names;
}
