const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());
// Token VeryFy
const verifyFBToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  // TODO: Firebase verify করা লাগবে
  req.decoded = { email: "" }; // temporary

  next();
};
// Admin VeryFy
const veryfyAdmin = async (req, res, next) => {
  const email = req.decoded.email;

  const user = await userCollection.findOne({ email });

  if (user?.role !== "admin") {
    return res.status(403).send({ message: "Admin Only" });
  }
  next();
};
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
  res.send("Server running ");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("digital-life-lesson");
    const postCollection = db.collection("posts");
    const userCollection = db.collection("users");
    const userPaymentCollection = db.collection("payments");

    //  CREATE POST
    app.post("/posts", verifyFBToken, async (req, res) => {
      const post = {
        text: req.body.text,
        email: req.body.email,
        userName: req.body.userName,
        userPhoto: req.body.userPhoto,
        likes: 0,
        liked: false,
        favorite: [],
        visibility: "public",
        comments: [],
        createdAt: new Date(),
        postPhoto: req.body.postPhoto,
      };

      const result = await postCollection.insertOne(post);
      res.send(result);
    });
    // Payment mathods
    app.post("/payments", async (req, res) => {
      const {
        uid,
        email,
        planName,
        price,
        month,
        total,
        cardNumber,
        name,
        transactionId,
      } = req.body;

      if (!uid || !email) {
        return res.status(400).send({ error: "UID or email missing" });
      }

      const planData = {
        planName,
        price,
        month,
        total,
        cardLast4: cardNumber,
        name,
        createdAt: new Date(),
        transactionId: transactionId || null,
      };

      // Update existing user document or create new one
      const result = await userPaymentCollection.updateOne(
        { uid, email }, // match user
        { $set: { plan: planData } }, // set (replace) plan
        { upsert: true }, // create if doesn't exist
      );

      res.send({ success: true, result });
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
          role: "user",
        },
      };
      const result = await userCollection.updateOne(filter, userData, options);
      res.send(result);
    });
    // user role API

    //  USER GET POSTS
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
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });
    // সব পোস্ট, নিজের পোস্ট এবং ফেভারিট পোস্ট দেখার জন্য একটি স্মার্ট API
    app.get("/posts", verifyFBToken, async (req, res) => {
      try {
        const { email, favorite, visibility } = req.query;

        let query = {};

        // 🔥 login user email (token থেকে)
        const userEmail = req.decoded.email;

        // ১. নিজের পোস্ট
        if (email) {
          query.email = email;
        }

        // ২. favorite পোস্ট (main fix)
        if (favorite === "true") {
          query.favorites = { $in: [userEmail] };
        }

        // ৩. visibility filter
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

    //  UPDATE POST (edit text)
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
    // LIKE
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

    //  FAVORITE
    app.patch("/posts/favorite/:id", async (req, res) => {
      const { id } = req.params;

      const { email } = req.body;

      const post = await postCollection.findOne({
        _id: new ObjectId(id),
      });

      let updateDoc;

      if (post.favorite.includes(email)) {
        // remove
        updateDoc = {
          $pull: { favorite: email },
        };
      } else {
        // add
        updateDoc = {
          $addToSet: { favorite: email },
        };
      }

      const result = await postCollection.updateOne(
        { _id: new ObjectId(id) },
        updateDoc,
      );
      res.send(result);
    });

    // COMMENT
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

        console.log(updatedPost.value);
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
    console.log("MongoDB Connected");
  } catch (err) {
    console.error(err);
  }
}

run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
