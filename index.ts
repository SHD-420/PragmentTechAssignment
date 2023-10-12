import { config } from "dotenv";
import express from "express";
import { MongoClient } from "mongodb";
import { join } from "path";
import { cleanEnv, str } from "envalid";
import enWordnet from "en-wordnet";
import Dictionary from "en-dictionary";

// initialize the dictionary
const dictionary = new Dictionary(enWordnet.get("3.0"));
const dictionaryInitialized = new Promise((resolve) =>
  dictionary.init().then(resolve)
);

const app = express();

// serve index.html at root
app.get("/", (_, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

// load and validate environment variables
config();
const env = cleanEnv(process.env, {
  MONGODB_URI: str(),
  MONGODB_DB: str(),
  MONGODB_COLLECTION: str(),
});

const mongoClient = new MongoClient(env.MONGODB_URI);

const mongoConnected = new Promise((resolve) =>
  mongoClient.connect().then(resolve)
);

app.get("/dictionary", async (req, res) => {
  try {
    await mongoConnected;
    const collection = mongoClient
      .db(env.MONGODB_DB)
      .collection(env.MONGODB_COLLECTION);

    const searchQuery = req.query.query;

    // query not provided or invalid; show all words
    if (typeof searchQuery !== "string") {
      const data = await collection.find().project({ _id: 0 }).toArray();
      return res.json(data);
    }

    // search database for word definition
    const result = await collection.findOne(
      { word: searchQuery },
      { projection: { _id: 0, meaning: 1 } }
    );

    let meaning: undefined | object = result?.meaning;

    // word not found in db, find its meaning from en-wordnet and insert into db
    if (!meaning) {
      await dictionaryInitialized;
      meaning = [...dictionary.searchSimpleFor([searchQuery]).values()][0];

      // no meaning found even in dictionary
      if (!meaning) return res.json(null);
      await collection.insertOne({ word: searchQuery, meaning });
    }
    return res.json(meaning);
  } finally {
    await mongoClient.close();
  }
});

app.listen(3000, () => console.log("App running on port 3000"));
