const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// Mongo URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.th9fx3f.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Server running ✅");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("digital-life-lesson");
    const postCollection = db.collection("posts");

    // ✅ CREATE POST
    app.post("/posts", async (req, res) => {
      const post = {
        text: req.body.text,
        email: req.body.email || "test@gmail.com",
        likes: 0,
        liked: false,
        favorite: false,
        comments: [],
        createdAt: new Date(),
      };

      const result = await postCollection.insertOne(post);
      res.send(result);
    });

    // ✅ GET POSTS
    app.get("/posts", async (req, res) => {
      const result = await postCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // Filter API
    app.get("/posts", async (req, res) => {
      const email = req.query.email;
      const query = email ? { email } : {};
      const result = await postCollection.find(query).toArray();
      res.send(result);
    });

    // ✅ UPDATE POST (edit text)
    app.patch("/posts/:id", async (req, res) => {
      const { id } = req.params;
      const { text } = req.body;

      const result = await postCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { text } },
      );

      res.send(result);
    });
    // Get API
    app.get("/posts/:id", async (req, res) => {
      const { id } = req.params;
      const post = await postCollection.findOne({ _id: new ObjectId(id) });
      res.send(post); // ✅ এটা data return করবে
    });
    // ✅ LIKE
    app.patch("/posts/like/:id", async (req, res) => {
      const { id } = req.params;
      const { liked } = req.body;

      const result = await postCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $inc: { likes: liked ? -1 : 1 },
          $set: { liked: !liked },
        },
      );

      res.send(result);
    });

    // ✅ FAVORITE
    app.patch("/posts/favorite/:id", async (req, res) => {
      const { id } = req.params;
      const { favorite } = req.body;

      const result = await postCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { favorite } },
      );

      res.send(result);
    });

    // ✅ COMMENT
    app.patch("/posts/comment/:id", async (req, res) => {
      const { id } = req.params;
      const newComment = req.body; // frontend থেকে newComment object

      try {
        // MongoDB তে push করা হচ্ছে wrapper "comment" এর ভিতরে
        const updatedPost = await postCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $push: { comments: { comment: newComment } } }, // wrapper
          { returnDocument: "after" }, // updated document ফেরত দাও
        );

        res.send(updatedPost.value); // full lesson object ফেরত
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to add comment" });
      }
    });
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error(err);
  }
}

run();

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
