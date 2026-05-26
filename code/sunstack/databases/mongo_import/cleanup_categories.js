/**
 * cleanup_categories.js
 * Script to remove all category-related data from MongoDB
 * Run this after deploying the updated code
 * 
 * Usage: node cleanup_categories.js
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://root:root@localhost:27017';

async function cleanupCategories() {
    const client = new MongoClient(MONGO_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB\n');

        // ===== product_db =====
        const productDb = client.db('product_db');

        // Drop categories collection
        console.log('Dropping product_db.categories collection...');
        try {
            await productDb.collection('categories').drop();
            console.log('✓ product_db.categories dropped');
        } catch (e) {
            if (e.codeName === 'NamespaceNotFound') {
                console.log('- product_db.categories did not exist');
            } else {
                console.log('✗ Error dropping product_db.categories:', e.message);
            }
        }

        // Drop shop_categories collection
        console.log('Dropping product_db.shop_categories collection...');
        try {
            await productDb.collection('shop_categories').drop();
            console.log('✓ product_db.shop_categories dropped');
        } catch (e) {
            if (e.codeName === 'NamespaceNotFound') {
                console.log('- product_db.shop_categories did not exist');
            } else {
                console.log('✗ Error dropping product_db.shop_categories:', e.message);
            }
        }

        // Remove category field from all products
        console.log('Removing category field from product_db.products...');
        const productsResult = await productDb.collection('products').updateMany(
            {},
            { $unset: { category: '' } }
        );
        console.log(`✓ Removed category field from ${productsResult.modifiedCount} products`);

        // Remove searchCategoryName field from all products
        console.log('Removing searchCategoryName field from product_db.products...');
        const searchNameResult = await productDb.collection('products').updateMany(
            {},
            { $unset: { searchCategoryName: '' } }
        );
        console.log(`✓ Removed searchCategoryName field from ${searchNameResult.modifiedCount} products`);

        // ===== shop_db =====
        const shopDb = client.db('shop_db');

        // Drop shop_categories collection
        console.log('\nDropping shop_db.shop_categories collection...');
        try {
            await shopDb.collection('shop_categories').drop();
            console.log('✓ shop_db.shop_categories dropped');
        } catch (e) {
            if (e.codeName === 'NamespaceNotFound') {
                console.log('- shop_db.shop_categories did not exist');
            } else {
                console.log('✗ Error dropping shop_db.shop_categories:', e.message);
            }
        }

        console.log('\n========================================');
        console.log('Category cleanup completed successfully!');
        console.log('========================================\n');

    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

cleanupCategories();
