import { PrismaClient } from '@prisma/client';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseNursingRoomsData } from './utils/parseNursingRooms.js';
import { parsePlaygroundsCSV, parseTaipeiPlaygroundsJSON } from './utils/parsePlaygrounds.js';
import { parseToiletsData } from './utils/parseToilets.js';
import { parseNewTaipeiParksHTML } from './utils/scrapeNewTaipeiParks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

// Facility type keys
const FACILITY_KEYS = {
  NURSING_ROOM: 'nursing_room',
  FAMILY_TOILET: 'family_toilet',
  PLAYGROUND: 'playground',
} as const;

// Cache for City and District IDs
const cityCache = new Map<string, number>();
const districtCache = new Map<string, number>();

/**
 * 取得或建立 City
 */
async function getOrCreateCity(cityName: string | null): Promise<number | null> {
  if (!cityName) return null;

  // 標準化都市名稱（統一使用「臺」而非「台」）
  const normalizedCity = cityName.replace(/台/g, '臺');

  if (cityCache.has(normalizedCity)) {
    return cityCache.get(normalizedCity)!;
  }

  const city = await prisma.city.upsert({
    where: { name: normalizedCity },
    update: {},
    create: {
      name: normalizedCity,
    },
  });

  cityCache.set(normalizedCity, city.id);
  return city.id;
}

/**
 * 取得或建立 District
 */
async function getOrCreateDistrict(
  cityId: number | null,
  districtName: string | null
): Promise<number | null> {
  if (!cityId || !districtName) return null;

  const normalizedDistrict = districtName.trim();
  const cacheKey = `${cityId}_${normalizedDistrict}`;

  if (districtCache.has(cacheKey)) {
    return districtCache.get(cacheKey)!;
  }

  const district = await prisma.district.upsert({
    where: {
      cityId_name: {
        cityId,
        name: normalizedDistrict,
      },
    },
    update: {},
    create: {
      cityId,
      name: normalizedDistrict,
    },
  });

  districtCache.set(cacheKey, district.id);
  return district.id;
}

async function seedFacilityTypes() {
  console.log('Seeding facility types...');

  const facilityTypes = [
    {
      key: FACILITY_KEYS.NURSING_ROOM,
      name: '哺集乳室',
      nameEn: 'Nursing Room',
      icon: 'breastfeeding',
    },
    {
      key: FACILITY_KEYS.FAMILY_TOILET,
      name: '親子廁所',
      nameEn: 'Family Toilet',
      icon: 'toilet',
    },
    {
      key: FACILITY_KEYS.PLAYGROUND,
      name: '遊戲場',
      nameEn: 'Playground',
      icon: 'playground',
    },
  ];

  for (const type of facilityTypes) {
    await prisma.facilityType.upsert({
      where: { key: type.key },
      update: type,
      create: type,
    });
  }

  console.log(`✓ Seeded ${facilityTypes.length} facility types`);
}

async function seedToilets() {
  console.log('Seeding toilets data...');

  const dataPath = join(__dirname, '../../data/全國公廁建檔資料.json');
  const places = parseToiletsData(dataPath);

  console.log(`Found ${places.length} family toilets`);

  const facilityType = await prisma.facilityType.findUnique({
    where: { key: FACILITY_KEYS.FAMILY_TOILET },
  });

  if (!facilityType) {
    throw new Error('Family toilet facility type not found');
  }

  let created = 0;
  let skipped = 0;

  for (const place of places) {
    try {
      // Check if place already exists
      const existing = await prisma.place.findFirst({
        where: {
          sourceId: place.sourceId,
          source: place.source,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // 取得或建立 City 和 District
      const cityId = await getOrCreateCity(place.city);
      const districtId = await getOrCreateDistrict(cityId, place.district);

      if (!cityId || !districtId) {
        console.warn(`Skipping place ${place.name}: missing city or district (city: ${place.city}, district: ${place.district})`);
        skipped++;
        continue;
      }

      await prisma.place.create({
        data: {
          name: place.name,
          address: place.address,
          cityId,
          districtId,
          latitude: place.latitude,
          longitude: place.longitude,
          metadata: place.metadata,
          source: place.source,
          sourceId: place.sourceId,
          placeFacilities: {
            create: {
              facilityTypeId: facilityType.id,
            },
          },
        },
      });

      created++;
    } catch (error) {
      console.error(`Error creating place ${place.name}:`, error);
    }
  }

  console.log(`✓ Created ${created} places, skipped ${skipped} duplicates`);
}

async function seedNursingRooms() {
  console.log('Seeding nursing rooms data...');

  const dataPath1 = join(__dirname, '../../data/全國依法設置哺集乳室名單(截至115年1月).csv');
  const dataPath2 = join(__dirname, '../../data/全國自願設置哺集乳室名單(截至115年1月).csv');

  const places1 = parseNursingRoomsData(dataPath1, '依法設置');
  const places2 = parseNursingRoomsData(dataPath2, '自願設置');

  const allPlaces = [...places1, ...places2];

  console.log(`Found ${allPlaces.length} nursing rooms (${places1.length} mandatory + ${places2.length} voluntary)`);

  // Filter out places without coordinates (they need geocoding)
  const placesWithCoords = allPlaces.filter((p) => p.latitude !== null && p.longitude !== null);
  const placesNeedingGeocoding = allPlaces.filter((p) => p.latitude === null || p.longitude === null);

  console.log(`  - ${placesWithCoords.length} with coordinates`);
  console.log(`  - ${placesNeedingGeocoding.length} need geocoding (skipped)`);

  const facilityType = await prisma.facilityType.findUnique({
    where: { key: FACILITY_KEYS.NURSING_ROOM },
  });

  if (!facilityType) {
    throw new Error('Nursing room facility type not found');
  }

  let created = 0;
  let skipped = 0;

  for (const place of placesWithCoords) {
    try {
      const existing = await prisma.place.findFirst({
        where: {
          sourceId: place.sourceId,
          source: place.source,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // 取得或建立 City 和 District
      const cityId = await getOrCreateCity(place.city);
      const districtId = await getOrCreateDistrict(cityId, place.district);

      if (!cityId || !districtId) {
        console.warn(`Skipping place ${place.name}: missing city or district (city: ${place.city}, district: ${place.district})`);
        skipped++;
        continue;
      }

      await prisma.place.create({
        data: {
          name: place.name,
          address: place.address,
          cityId,
          districtId,
          latitude: place.latitude!,
          longitude: place.longitude!,
          metadata: place.metadata,
          source: place.source,
          sourceId: place.sourceId,
          placeFacilities: {
            create: {
              facilityTypeId: facilityType.id,
            },
          },
        },
      });

      created++;
    } catch (error) {
      console.error(`Error creating place ${place.name}:`, error);
    }
  }

  console.log(`✓ Created ${created} places, skipped ${skipped} duplicates`);
}

async function seedPlaygrounds() {
  console.log('Seeding playgrounds data...');

  // Parse CSV playgrounds
  const csvPath = join(__dirname, '../../data/台北市共融式遊戲場.csv');
  const csvPlaces = parsePlaygroundsCSV(csvPath);

  // Parse Taipei JSON playgrounds
  const jsonPath = join(__dirname, '../../data/台北市兒童遊戲場.json');
  const jsonPlaces = parseTaipeiPlaygroundsJSON(jsonPath);

  // Parse New Taipei HTML
  const htmlPath = join(__dirname, '../../data/新北市共融_特色公園.html');
  const htmlPlaces = parseNewTaipeiParksHTML(htmlPath);

  const allPlaces = [...csvPlaces, ...jsonPlaces, ...htmlPlaces.filter((p) => p.latitude !== null && p.longitude !== null)];

  console.log(`Found ${allPlaces.length} playgrounds (${csvPlaces.length} CSV + ${jsonPlaces.length} Taipei JSON + ${htmlPlaces.filter(p => p.latitude !== null).length} New Taipei HTML)`);

  const facilityType = await prisma.facilityType.findUnique({
    where: { key: FACILITY_KEYS.PLAYGROUND },
  });

  if (!facilityType) {
    throw new Error('Playground facility type not found');
  }

  let created = 0;
  let skipped = 0;

  for (const place of allPlaces) {
    try {
      if (place.latitude === null || place.longitude === null) {
        skipped++;
        continue;
      }

      const existing = await prisma.place.findFirst({
        where: {
          sourceId: place.sourceId,
          source: place.source,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // 取得或建立 City 和 District
      const cityId = await getOrCreateCity(place.city);
      const districtId = await getOrCreateDistrict(cityId, place.district);

      if (!cityId || !districtId) {
        console.warn(`Skipping place ${place.name}: missing city or district (city: ${place.city}, district: ${place.district})`);
        skipped++;
        continue;
      }

      await prisma.place.create({
        data: {
          name: place.name,
          address: place.address,
          cityId,
          districtId,
          latitude: place.latitude,
          longitude: place.longitude,
          metadata: place.metadata,
          source: place.source,
          sourceId: place.sourceId,
          placeFacilities: {
            create: {
              facilityTypeId: facilityType.id,
            },
          },
        },
      });

      created++;
    } catch (error) {
      console.error(`Error creating place ${place.name}:`, error);
    }
  }

  console.log(`✓ Created ${created} places, skipped ${skipped} duplicates`);
}

async function main() {
  console.log('Starting database seeding...\n');

  try {
    await seedFacilityTypes();
    console.log('');

    await seedToilets();
    console.log('');

    await seedNursingRooms();
    console.log('');

    await seedPlaygrounds();
    console.log('');

    console.log('✓ Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
