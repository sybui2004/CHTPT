import mongoose from 'mongoose';
import axios from 'axios';

const MONGO_URIS = [
    'mongodb://root:root@mongo:27017/shop_db?directConnection=true&authSource=admin',
    'mongodb://root:root@mongo:27017/auth_db?directConnection=true&authSource=admin',
];
const API_ENDPOINT = 'https://provinces.open-api.vn/api/v1?depth=3';

const ProvinceSchema = new mongoose.Schema({
    _id: Number,
    name: String,
}, { timestamps: false, versionKey: false });

const DistrictSchema = new mongoose.Schema({
    _id: Number,
    name: String,
    provinceId: Number,
}, { timestamps: false, versionKey: false });

const WardSchema = new mongoose.Schema({
    _id: String,
    name: String,
    districtId: Number,
}, { timestamps: false, versionKey: false });

async function fetchDataFromApi(url) {
    try {
        const response = await axios.get(url);
        console.log(`Fetched ${response.data.length} provinces/cities from API.`);
        return response.data;
    } catch (error) {
        console.log('Failed to fetch province data:', error.message);
        return null;
    }
}

async function checkDatabaseConnection(mongoUri) {
    try {
        console.log(`Checking database connection: ${mongoUri}`);
        const conn = await mongoose.createConnection(mongoUri).asPromise();
        await conn.close();
        return true;
    } catch (error) {
        console.log(`Cannot connect to ${mongoUri}:`, error.message);
        return false;
    }
}

async function waitForDatabase(maxAttempts = 30, delayMs = 2000) {
    console.log('Waiting for databases...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`Connection attempt ${attempt}/${maxAttempts}...`);
        const results = await Promise.all(MONGO_URIS.map(uri => checkDatabaseConnection(uri)));
        if (results.every(Boolean)) {
            console.log('Databases are ready.');
            return true;
        }

        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log('Could not connect to all databases.');
    return false;
}

function normalizeData(data) {
    const provinces = [];
    const districts = [];
    const wards = [];

    data.forEach(province => {
        provinces.push({
            _id: province.code,
            name: province.name,
        });

        if (Array.isArray(province.districts)) {
            province.districts.forEach(district => {
                districts.push({
                    _id: district.code,
                    name: district.name,
                    provinceId: province.code,
                });

                if (Array.isArray(district.wards)) {
                    district.wards.forEach(ward => {
                        wards.push({
                            _id: ward.code,
                            name: ward.name,
                            districtId: district.code,
                        });
                    });
                }
            });
        }
    });

    return { provinces, districts, wards };
}

async function processAndInsertData(data, mongoUri) {
    const conn = await mongoose.createConnection(mongoUri).asPromise();
    const Province = conn.model('Province', ProvinceSchema);
    const District = conn.model('District', DistrictSchema);
    const Ward = conn.model('Ward', WardSchema);

    try {
        const { provinces, districts, wards } = normalizeData(data);

        await Province.deleteMany({});
        await District.deleteMany({});
        await Ward.deleteMany({});

        if (provinces.length > 0) await Province.insertMany(provinces);
        if (districts.length > 0) await District.insertMany(districts);
        if (wards.length > 0) await Ward.insertMany(wards);

        console.log(`Imported address data into ${mongoUri}.`);
        return true;
    } catch (error) {
        console.log(`Import failed for ${mongoUri}:`, error.message);
        return false;
    } finally {
        await conn.close();
    }
}

async function runImporter() {
    const dbReady = await waitForDatabase();
    if (!dbReady) {
        console.log('Stopping import because databases are not ready.');
        return;
    }

    const apiData = await fetchDataFromApi(API_ENDPOINT);

    if (apiData && apiData.length > 0) {
        const results = [];
        for (const mongoUri of MONGO_URIS) {
            results.push(await processAndInsertData(apiData, mongoUri));
        }

        if (results.every(Boolean)) {
            console.log('Address data import completed.');
        } else {
            console.log('Address data import failed for at least one database.');
        }
    } else {
        console.log('No address data to import.');
    }
}

runImporter();
