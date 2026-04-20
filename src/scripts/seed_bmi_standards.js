require('dotenv').config();
const prisma = require('../config/database');

const BMI_WHO_DATA = [
  { month: 0, boy: [13.4, 11.3, 16.1], girl: [13.3, 11.2, 16.1] },
  { month: 3, boy: [16.6, 14.9, 18.8], girl: [16.4, 14.6, 18.8] },
  { month: 6, boy: [17.5, 15.6, 19.8], girl: [17.3, 15.3, 19.9] },
  { month: 9, boy: [17.9, 16.1, 20.2], girl: [17.7, 15.7, 20.3] },
  { month: 12, boy: [18.2, 16.3, 20.6], girl: [18.0, 15.9, 20.7] },
  { month: 18, boy: [17.4, 15.6, 19.6], girl: [17.2, 15.4, 19.6] },
  { month: 24, boy: [16.6, 14.9, 18.8], girl: [16.3, 14.5, 18.7] },
  { month: 36, boy: [15.8, 14.1, 18.0], girl: [15.5, 13.8, 17.9] },
  { month: 48, boy: [15.4, 13.7, 17.6], girl: [15.2, 13.4, 17.6] },
  { month: 60, boy: [15.2, 13.5, 17.6], girl: [15.0, 13.1, 17.7] },
];

function interpolate(day, key) {
  const month = day / 30.4375;
  let lower = BMI_WHO_DATA[0];
  let upper = BMI_WHO_DATA[BMI_WHO_DATA.length - 1];

  for (let i = 0; i < BMI_WHO_DATA.length - 1; i++) {
    if (month >= BMI_WHO_DATA[i].month && month <= BMI_WHO_DATA[i + 1].month) {
      lower = BMI_WHO_DATA[i];
      upper = BMI_WHO_DATA[i + 1];
      break;
    }
  }

  if (lower === upper) return lower[key];

  const t = (month - lower.month) / (upper.month - lower.month);
  return lower[key].map((v, i) => v + t * (upper[key][i] - v));
}

async function main() {
  console.log('Seeding BMI SD columns...');
  const allBmi = await prisma.bmi.findMany({ orderBy: { day: 'asc' } });
  
  if (allBmi.length === 0) {
    console.log('No records found in BMI table. Generating initial set for 0-60 months...');
    for (let day = 0; day <= 1826; day++) {
       const [mB, nB, pB] = interpolate(day, 'boy');
       const [mG, nG, pG] = interpolate(day, 'girl');
       await prisma.bmi.create({
         data: {
           day,
           bmi_boy: mB, sd2neg_boy: nB, sd2pos_boy: pB,
           bmi_girl: mG, sd2neg_girl: nG, sd2pos_girl: pG
         }
       });
       if (day % 100 === 0) console.log(`Created day ${day}...`);
    }
  } else {
    for (const record of allBmi) {
      const [mB, nB, pB] = interpolate(record.day, 'boy');
      const [mG, nG, pG] = interpolate(record.day, 'girl');
      
      await prisma.bmi.update({
        where: { id: record.id },
        data: {
          sd2neg_boy: parseFloat(nB.toFixed(2)),
          sd2pos_boy: parseFloat(pB.toFixed(2)),
          sd2neg_girl: parseFloat(nG.toFixed(2)),
          sd2pos_girl: parseFloat(pG.toFixed(2)),
          // Optionally refresh median too for consistency
          bmi_boy: parseFloat(mB.toFixed(2)),
          bmi_girl: parseFloat(mG.toFixed(2)),
        }
      });
      if (record.day % 100 === 0) console.log(`Updated day ${record.day}...`);
    }
  }
  console.log('BMI Seeding complete.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
