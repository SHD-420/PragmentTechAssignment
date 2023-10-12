"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const express_1 = __importDefault(require("express"));
const mongodb_1 = require("mongodb");
const path_1 = require("path");
const envalid_1 = require("envalid");
const en_wordnet_1 = __importDefault(require("en-wordnet"));
const en_dictionary_1 = __importDefault(require("en-dictionary"));
// initialize the dictionary
const dictionary = new en_dictionary_1.default(en_wordnet_1.default.get("3.0"));
const dictionaryInitialized = new Promise((resolve) => dictionary.init().then(resolve));
const app = (0, express_1.default)();
// serve index.html at root
app.get("/", (_, res) => {
    res.sendFile((0, path_1.join)(__dirname, "index.html"));
});
// load and validate environment variables
(0, dotenv_1.config)();
const env = (0, envalid_1.cleanEnv)(process.env, {
    MONGODB_URI: (0, envalid_1.str)(),
    MONGODB_DB: (0, envalid_1.str)(),
    MONGODB_COLLECTION: (0, envalid_1.str)(),
});
const mongoClient = new mongodb_1.MongoClient(env.MONGODB_URI);
app.get("/dictionary", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield mongoClient.connect();
        const collection = mongoClient
            .db(env.MONGODB_DB)
            .collection(env.MONGODB_COLLECTION);
        const searchQuery = req.query.query;
        // query not provided or invalid; show all words
        if (typeof searchQuery !== "string") {
            const data = yield collection.find().project({ _id: 0 }).toArray();
            return res.json(data);
        }
        // search database for word definition
        const result = yield collection.findOne({ word: searchQuery }, { projection: { _id: 0, meaning: 1 } });
        let meaning = result === null || result === void 0 ? void 0 : result.meaning;
        // word not found in db, find its meaning from en-wordnet and insert into db
        if (!meaning) {
            yield dictionaryInitialized;
            meaning = [...dictionary.searchSimpleFor([searchQuery]).values()][0];
            if (meaning)
                yield collection.insertOne({ word: searchQuery, meaning });
        }
        return res.json(meaning);
    }
    finally {
        yield mongoClient.close();
    }
}));
app.listen(3000, () => console.log("App running on port 3000"));
