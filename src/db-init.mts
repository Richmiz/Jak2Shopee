import { closeCatalogDatabase, databasePath, getCatalogDatabase } from "./server/catalog-store.mts";

getCatalogDatabase();
console.log(`[CatalogBridge] Database ready: ${databasePath()}`);
closeCatalogDatabase();
