const { MongoClient } = require('mongodb');

// REPLACE YOUR PASSWORD HERE to test locally:
const uri = "mongodb+srv://111fasin_db_user:fasin@cluster0.etz1swl.mongodb.net/?appName=Cluster0";

console.log("Testing connection to MongoDB Atlas...");
console.log("Connecting to:", uri.replace(/:([^@:]+)@/, ':****@'));

MongoClient.connect(uri)
  .then(client => {
    console.log("\n===========================================");
    console.log(" SUCCESS: Connected to MongoDB Atlas!");
    console.log("===========================================");
    client.close();
    process.exit(0);
  })
  .catch(err => {
    console.log("\n===========================================");
    console.log(" FAILED: Connection Error Details:");
    console.log("===========================================");
    console.log(err.message);
    process.exit(1);
  });
