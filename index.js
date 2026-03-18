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
    const userCollection = db.collection("users");

    //  CREATE POST
    app.post("/posts", async (req, res) => {
      const post = {
        text: req.body.text,
        email: req.body.email ,
        userName: req.body.userName ,
        userPhoto: req.body.userPhoto ,
        likes: 0,
        liked: false,
        favorite: false,
        visibility: "public",
        comments: [],
        createdAt: new Date(),
        postPhoto: req.body.postPhoto,
        roll : "user"
      };

      const result = await postCollection.insertOne(post);
      res.send(result);
    });
    // user Profile Details API
    app.put("/users", async (req, res) => {
      const user = req.body;

      const filter = { uid: user.uid };
      const options = { upsert: true };
      const userData = {
        $set: {
          phone: user.mobile,
          gender: user.gender,
          education: user.education,
          language: user.language,
          bio: user.about || "",
        },
      };
      const result = await userCollection.updateOne(filter, userData, options);
      res.send(result);
    });
    // ✅ USER GET POSTS
    app.get("/users", async (req, res) => {
      const result = await userCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/users/:uid", async (req, res) => {
      const { uid } = req.params;
      const result = await userCollection.findOne({ uid });
      res.send(result);
    });

    // ✅ সব পোস্ট, নিজের পোস্ট এবং ফেভারিট পোস্ট দেখার জন্য একটি স্মার্ট API
    app.get("/posts", async (req, res) => {
      try {
        const { email, favorite, visibility } = req.query;
        let query = {};

        // ১. যদি ইমেইল থাকে (নিজের পোস্ট দেখার জন্য)
        if (email) {
          query.email = email;
        }
        console.log(email);
        // ২. যদি ফেভারিট ফিল্টার থাকে (ইমেইল ও ফেভারিট একসাথে)
        if (favorite === "true") {
          query.favorite = true;
        }

        // ৩. যদি ভিজিবিলিটি ফিল্টার থাকে
        if (visibility) {
          query.visibility = visibility;
        }

        const result = await postCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch posts", error });
      }
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
    // Delte Post
    app.delete("/posts/:id", async (req, res) => {
      const result = await postCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });

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
      const newComment = req.body;

      try {
        const updatedPost = await postCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          {
            $push: {
              comments: {
                $each: [{ comment: newComment }],
                $position: 0,
              },
            },
          },
          { returnDocument: "after" },
        );

        res.send(updatedPost.value);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to add comment" });
      }
    });
    // Comment Edite
    app.patch("/posts/comment/edit/:id", async (req, res) => {
      const { id } = req.params;
      const { index, Text } = req.body;

      try {
        const updatedPost = await postCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          {
            $set: {
              [`comments.${index}.comment.Text`]: Text,
              [`comments.${index}.comment.UpdatedAt`]: new Date(),
            },
          },
          { returnDocument: "after" },
        );

        res.send(updatedPost.value);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to edit comment" });
      }
    });

    // Delete Comment
    app.patch("/posts/comment/delete/:id", async (req, res) => {
      const { id } = req.params;
      const { index } = req.body;

      try {
        const updatedPost = await postCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          {
            $unset: { [`comments.${index}`]: 1 },
          },
          { returnDocument: "after" },
        );

        // null clean-up
        await postCollection.updateOne(
          { _id: new ObjectId(id) },
          { $pull: { comments: null } },
        );

        res.send(updatedPost.value);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to delete comment" });
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
